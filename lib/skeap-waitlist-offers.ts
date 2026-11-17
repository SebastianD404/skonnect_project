import { ReminderType, type Prisma } from "@prisma/client";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";
import { getAcademicYearDateRange } from "@/lib/semester";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SKEAP_WAITLIST_OFFER_DAYS,
  MAX_SKEAP_WAITLIST_OFFER_DAYS,
  SKEAP_WAITLIST_OFFER_DAYS_KEY,
} from "@/lib/skeap-capacity-constants";
import {
  lockSkeapCapacity,
} from "@/lib/skeap-capacity";
import { getSkeapWaitlistCycle } from "@/lib/skeap-waitlist-cycle";

const HOUR_MS = 60 * 60 * 1000;
const REMINDER_OFFSETS_HOURS = [48, 24] as const;
const OFFER_SUBJECT = "A SKEAP scholarship slot is available";
const MANILA_TIME_ZONE = "Asia/Manila";
const OFFICE_HOURS = "8:00 AM – 5:00 PM";
const OFFICE_DAYS = "Monday – Friday";
const OFFICE_SCHEDULE = `${OFFICE_HOURS} (${OFFICE_DAYS})`;
const OFFICE_VENUE = "Barangay Pico SK Office, Km. 5, Pico, La Trinidad, Benguet";
const VERIFICATION_DOCUMENTS = [
  "Original & Photocopy of Birth Certificate",
  "Certificate of Low-Income of Parents/Guardian (for SKEAP)",
  "Certificate of Residency",
  "Certified True Copy (CTC) of Certificate of Enrollment / Registration Form",
  "Registrar-Issued Grades (College/Tech-Voc) or CTC of Report Card / Form 138 (High School)",
] as const;

type SettingsClient = typeof prisma | Prisma.TransactionClient;

export function formatWaitlistOfferDeadline(value: Date) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: MANILA_TIME_ZONE,
    dateStyle: "long",
  }).format(value);
}

function getTimeZoneDateParts(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((item) => item.type === type)?.value);

  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second"),
  };
}

function getTimeZoneOffsetMs(value: Date, timeZone: string) {
  const parts = getTimeZoneDateParts(value, timeZone);
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  ) - value.getTime();
}

function getDateAtTimeZone(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string,
) {
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hour);
  let timestamp = wallClockAsUtc;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    timestamp = wallClockAsUtc - getTimeZoneOffsetMs(new Date(timestamp), timeZone);
  }
  return new Date(timestamp);
}

export function getWaitlistOfferExpiresAt(offeredAt: Date, waitlistOfferDays: number) {
  const offered = getTimeZoneDateParts(offeredAt, MANILA_TIME_ZONE);
  const deadlineDay = new Date(
    Date.UTC(offered.year, offered.month - 1, offered.day + waitlistOfferDays),
  );
  return getDateAtTimeZone(
    deadlineDay.getUTCFullYear(),
    deadlineDay.getUTCMonth() + 1,
    deadlineDay.getUTCDate(),
    17,
    MANILA_TIME_ZONE,
  );
}

export function getDueWaitlistOfferReminderOffsets(expiresAt: Date, now: Date) {
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs <= 0) return [];
  return REMINDER_OFFSETS_HOURS.filter(
    (hours) => remainingMs <= hours * HOUR_MS,
  );
}

export async function getSkeapWaitlistOfferDays(
  client: SettingsClient = prisma,
) {
  const setting = await client.systemSetting.findUnique({
    where: { key: SKEAP_WAITLIST_OFFER_DAYS_KEY },
    select: { value: true },
  });
  const value = setting?.value;
  return typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_SKEAP_WAITLIST_OFFER_DAYS
    ? value
    : DEFAULT_SKEAP_WAITLIST_OFFER_DAYS;
}

export async function setSkeapWaitlistOfferDays(
  value: number,
  client: SettingsClient = prisma,
) {
  if (
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_SKEAP_WAITLIST_OFFER_DAYS
  ) {
    throw new Error(
      `Waitlist offer window must be a whole number between 1 and ${MAX_SKEAP_WAITLIST_OFFER_DAYS} days.`,
    );
  }

  return client.systemSetting.upsert({
    where: { key: SKEAP_WAITLIST_OFFER_DAYS_KEY },
    create: { key: SKEAP_WAITLIST_OFFER_DAYS_KEY, value },
    update: { value },
  });
}

function escapeEmailHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getSkeapDashboardUrl() {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (vercelUrl ? `https://${vercelUrl}` : null) ||
    (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : null);
  if (!configuredUrl) {
    throw new Error("Set NEXT_PUBLIC_APP_URL or VERCEL_URL to create SKEAP waitlist links.");
  }

  const appUrl = new URL(configuredUrl);
  if (appUrl.protocol !== "https:" && appUrl.protocol !== "http:") {
    throw new Error("The SKEAP dashboard URL must use HTTP or HTTPS.");
  }
  return new URL("/youth-dashboard", appUrl).toString();
}

export function buildWaitlistOfferEmailTemplate({
  applicantName,
  queuePosition,
  waitlistOfferDays,
  expiresAt,
  dashboardUrl,
}: {
  applicantName: string;
  queuePosition: number;
  waitlistOfferDays: number;
  expiresAt: Date;
  dashboardUrl: string;
}) {
  const firstName = applicantName.trim().split(/\s+/)[0] || "SKEAP applicant";
  const safeFirstName = escapeEmailHtml(firstName);
  const deadlineDate = formatWaitlistOfferDeadline(expiresAt);
  const safeDeadlineDate = escapeEmailHtml(deadlineDate);
  const safeDashboardUrl = escapeEmailHtml(dashboardUrl);
  const documentList = VERIFICATION_DOCUMENTS
    .map((document) => `<li style="margin:0 0 9px;padding-left:2px;">${escapeEmailHtml(document)}</li>`)
    .join("");
  const text = [
    `Hello ${firstName},`,
    "",
    `Scholarship slot offer · Queue #${queuePosition}`,
    "A SKEAP Scholarship Slot Is Available for You",
    "",
    `Submission Deadline: On or before ${deadlineDate} (${waitlistOfferDays} days)`,
    `Office Hours: ${OFFICE_SCHEDULE}`,
    `Venue: ${OFFICE_VENUE}`,
    "",
    "Bring these documents for physical verification under Barangay Ordinance No. 1 - 2022:",
    ...VERIFICATION_DOCUMENTS.map((document) => `- ${document}`),
    "",
    "If the offer expires, the slot will return to open availability. Your application remains on the waitlist, and an SK Official must manually send any new offer.",
    "",
    `View Application in SKonnect: ${dashboardUrl}`,
    "",
    "Prepared by SKonnect · Sangguniang Kabataan of Barangay Pico, La Trinidad, Benguet.",
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      @media only screen and (max-width:620px) {
        .offer-shell { width:100% !important; }
        .offer-pad { padding-left:20px !important; padding-right:20px !important; }
        .offer-brand,.offer-badge { display:block !important; width:100% !important; text-align:left !important; }
        .offer-badge { padding-top:12px !important; }
        .offer-detail { display:block !important; width:100% !important; padding:0 0 12px !important; }
        .offer-detail-last { padding-bottom:0 !important; }
        .offer-cta { display:block !important; text-align:center !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table class="offer-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border:1px solid #dbe3eb;border-radius:16px;background:#ffffff;overflow:hidden;">
            <tr>
              <td style="padding:20px 28px;background:#0f3d5c;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
                  <tr>
                    <td class="offer-brand" style="font-size:15px;font-weight:bold;line-height:22px;color:#ffffff;">
                      SKonnect <span style="color:#9fe4eb;">·</span> Barangay Pico
                    </td>
                    <td class="offer-badge" align="right" style="text-align:right;">
                      <span style="display:inline-block;padding:7px 10px;border:1px solid #6ee7b7;border-radius:999px;background:#d1fae5;color:#065f46;font-size:10px;font-weight:bold;letter-spacing:.5px;line-height:14px;">
                        SCHOLARSHIP SLOT OFFER · QUEUE #${queuePosition}
                      </span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="offer-pad" style="padding:30px 36px 12px;">
                <p style="margin:0 0 8px;font-size:15px;line-height:22px;color:#334155;">Hello ${safeFirstName},</p>
                <h1 style="margin:0;font-size:25px;line-height:1.25;color:#0f172a;">A SKEAP Scholarship Slot Is Available for You</h1>
                <p style="margin:12px 0 0;font-size:14px;line-height:22px;color:#475569;">
                  Your place in the waitlist has opened. Complete in-person verification at the Barangay Pico SK Office before the deadline to finalize your promotion.
                </p>
              </td>
            </tr>
            <tr>
              <td class="offer-pad" style="padding:18px 36px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #dbe3eb;border-radius:12px;background:#f8fafc;border-collapse:separate;">
                  <tr>
                    <td style="padding:16px 16px 4px;">
                      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td class="offer-detail" width="50%" valign="top" style="width:50%;padding:0 10px 12px 0;">
                            <p style="margin:0 0 5px;font-size:11px;font-weight:bold;letter-spacing:.6px;text-transform:uppercase;color:#64748b;">Submission Deadline</p>
                            <p style="margin:0;font-size:14px;font-weight:bold;line-height:21px;color:#0f172a;">On or before ${safeDeadlineDate} (${waitlistOfferDays} days)</p>
                          </td>
                          <td class="offer-detail offer-detail-last" width="50%" valign="top" style="width:50%;padding:0 0 12px 10px;">
                            <p style="margin:0 0 5px;font-size:11px;font-weight:bold;letter-spacing:.6px;text-transform:uppercase;color:#64748b;">Office Hours</p>
                            <p style="margin:0;font-size:14px;font-weight:bold;line-height:21px;color:#0f172a;">${OFFICE_SCHEDULE}</p>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding:0 16px 16px;">
                      <p style="margin:0 0 5px;font-size:11px;font-weight:bold;letter-spacing:.6px;text-transform:uppercase;color:#64748b;">Venue</p>
                      <p style="margin:0;font-size:14px;line-height:21px;color:#0f172a;">${OFFICE_VENUE}</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="offer-pad" style="padding:20px 36px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:1px solid #bfdbfe;border-radius:12px;background:#eff6ff;">
                  <tr>
                    <td style="padding:17px 18px;">
                      <p style="margin:0 0 5px;font-size:14px;font-weight:bold;line-height:20px;color:#1e3a8a;">Documents to bring</p>
                      <p style="margin:0 0 10px;font-size:12px;line-height:18px;color:#475569;">For physical verification under Barangay Ordinance No. 1 - 2022:</p>
                      <ul style="margin:0;padding-left:19px;font-size:13px;line-height:19px;color:#334155;">${documentList}</ul>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="offer-pad" align="center" style="padding:24px 36px 28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td align="center" style="border-radius:9px;background:#0f3d5c;">
                      <a class="offer-cta" href="${safeDashboardUrl}" style="display:inline-block;padding:13px 22px;border:1px solid #0f3d5c;border-radius:9px;background:#0f3d5c;color:#ffffff;font-size:14px;font-weight:bold;line-height:20px;text-decoration:none;">
                        View Application in SKonnect →
                      </a>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td class="offer-pad" style="border-top:1px solid #e2e8f0;padding:17px 36px 20px;font-size:11px;line-height:17px;color:#64748b;">
                Prepared by SKonnect · Sangguniang Kabataan of Barangay Pico, La Trinidad, Benguet.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { text, html };
}

export function buildCustomWaitlistOfferEmailTemplate({
  message,
  dashboardUrl,
  queuePosition,
  deadline,
}: {
  message: string;
  dashboardUrl: string;
  queuePosition: number | null;
  deadline: Date;
}) {
  const safeDashboardUrl = escapeEmailHtml(dashboardUrl);
  const formattedDeadline = new Intl.DateTimeFormat("en-US", {
    timeZone: MANILA_TIME_ZONE,
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(deadline).replace(" at ", ", ");
  const queuePositionLabel = `#${queuePosition ?? "—"}`;
  const messageText = message.trim();
  const messageParagraphs = messageText
    .split(/\r?\n\s*\r?\n/)
    .filter((paragraph) => paragraph.trim().length > 0)
    .map((paragraph) => paragraph.trim());
  const footer = "Sangguniang Kabataan of Barangay Pico · La Trinidad, Benguet";
  if (messageParagraphs[messageParagraphs.length - 1] === "Sangguniang Kabataan of Barangay Pico") {
    messageParagraphs.pop();
  }
  const messageBodyText = messageParagraphs.join("\n\n");
  const messageHtml = messageParagraphs
    .map((paragraph) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#334155;">${escapeEmailHtml(paragraph).replace(/\r?\n/g, "<br>")}</p>`)
    .join("");
  const verificationDetails = [
    ["Queue Position", queuePositionLabel],
    ["Compliance Deadline", `${formattedDeadline} PHT`],
    ["Location", "Barangay Pico Hall, La Trinidad, Benguet"],
    ["Documents", "Original / Certified True Copy (CTC) Requirements"],
  ] as const;
  const detailRows = verificationDetails.map(([label, value], index) => `
            <tr>
              <td class="detail-label" valign="top" style="width:38%;padding:${index === 0 ? "0" : "9px"} 12px 0 0;font-size:12px;line-height:18px;color:#64748b;">${escapeEmailHtml(label)}</td>
              <td valign="top" style="padding:${index === 0 ? "0" : "9px"} 0 0;font-size:13px;font-weight:bold;line-height:18px;color:#0f172a;">${escapeEmailHtml(value)}</td>
            </tr>`).join("");
  const plainText = [
    "SKEAP SCHOLARSHIP NOTICE",
    "Scholarship Slot Available",
    "",
    messageBodyText,
    "",
    "Verification Details",
    ...verificationDetails.map(([label, value]) => `${label}: ${value}`),
    "",
    `View Application in SKonnect: ${dashboardUrl}`,
    "",
    footer,
  ].join("\n");

  return {
    text: plainText,
    html: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <style>
      @media only screen and (max-width:620px) {
        .offer-shell { width:100% !important; }
        .offer-pad { padding-left:20px !important; padding-right:20px !important; }
        .detail-label { width:38% !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:24px 12px;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">
      <tr><td align="center">
        <table class="offer-shell" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;border:1px solid #dbe3eb;border-radius:16px;background:#ffffff;overflow:hidden;">
          <tr>
            <td style="padding:18px 24px;background:#0f3d5c;color:#ffffff;font-size:15px;font-weight:bold;line-height:22px;">
              SKonnect <span style="color:#9fe4eb;">·</span> Barangay Pico
            </td>
          </tr>
          <tr>
            <td class="offer-pad" style="padding:26px 28px 10px;">
              <p style="margin:0 0 6px;font-size:11px;font-weight:bold;letter-spacing:1px;color:#0891b2;">SKEAP SCHOLARSHIP NOTICE</p>
              <h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0f172a;">Scholarship Slot Available</h1>
              ${messageHtml}
            </td>
          </tr>
          <tr>
            <td class="offer-pad" style="padding:4px 28px 0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
                <tr>
                  <td style="padding:14px 16px;">
                    <p style="margin:0 0 10px;font-size:13px;font-weight:bold;line-height:18px;color:#0f172a;">Verification Details</p>
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      ${detailRows}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="offer-pad" style="padding:20px 28px 24px;">
              <a href="${safeDashboardUrl}" style="display:inline-block;padding:12px 18px;border-radius:9px;background:#0f3d5c;color:#ffffff;font-size:14px;font-weight:bold;line-height:20px;text-decoration:none;">View Application in SKonnect</a>
            </td>
          </tr>
          <tr>
            <td class="offer-pad" style="border-top:1px solid #e2e8f0;padding:15px 28px;color:#64748b;font-size:11px;line-height:17px;">
              ${escapeEmailHtml(footer)}
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`,
  };
}

export async function sendWaitlistSlotOfferEmail({
  applicationId,
  email,
  message,
  sentAt,
  queuePosition,
  deadline,
}: {
  applicationId: string;
  email: string;
  message: string;
  sentAt: Date;
  queuePosition: number | null;
  deadline: Date;
}) {
  const template = buildCustomWaitlistOfferEmailTemplate({
    message,
    dashboardUrl: getSkeapDashboardUrl(),
    queuePosition,
    deadline,
  });
  const transporter = createGmailTransporter();
  return sendTransactionalEmail(
    transporter,
    email,
    OFFER_SUBJECT,
    template.text,
    `waitlist-offer-${applicationId}-${sentAt.toISOString()}`,
    template.html,
  );
}

type OfferReminderEmail = {
  logId: string;
  applicationId: string;
  applicantName: string;
  email: string | null;
  subject: string;
  message: string;
  expiresAt: Date;
  offsetHours: number;
};

export async function processWaitlistOfferReminders(now = new Date()) {
  const reminders = await prisma.$transaction(async (tx) => {
    await lockSkeapCapacity(tx);
    const cycle = getSkeapWaitlistCycle();
    const cycleRange = getAcademicYearDateRange(cycle);
    if (!cycleRange) throw new Error("Unable to determine the active SKEAP waitlist cycle.");

    const applications = await tx.skeapApplication.findMany({
      where: {
        status: "WAITLISTED",
        waitlistOfferStatus: "OFFERED",
        waitlistOfferExpiresAt: { gt: now },
        submittedAt: { gte: cycleRange.start, lt: cycleRange.end },
      },
      select: {
        id: true,
        userId: true,
        applicantName: true,
        emailAddress: true,
        waitlistOfferedAt: true,
        waitlistOfferExpiresAt: true,
        user: { select: { fullName: true, email: true } },
      },
    });
    const pendingEmails: OfferReminderEmail[] = [];

    for (const application of applications) {
      const expiresAt = application.waitlistOfferExpiresAt;
      if (!expiresAt) continue;
      const dueOffsets = getDueWaitlistOfferReminderOffsets(expiresAt, now);
      for (const offsetHours of dueOffsets) {
        const triggerDate = new Date(expiresAt.getTime() - offsetHours * HOUR_MS);
        const targetType = `SKEAP_WAITLIST_OFFER_${offsetHours}H`;
        const metadata = {
          applicationId: application.id,
          offerExpiresAt: expiresAt.toISOString(),
          offsetHours,
        } satisfies Prisma.InputJsonObject;
        const subject = `SKEAP slot offer expires in ${offsetHours} hours`;
        const applicantName =
          application.applicantName || application.user.fullName || "SKEAP applicant";
        const message =
          `Your SKEAP slot offer expires on ${formatWaitlistOfferDeadline(expiresAt)}. Please present your Original / Certified True Copy (CTC) documents at the Barangay Pico SK Office during office hours: ${OFFICE_SCHEDULE}, before the deadline to finalize your promotion.`;

        const existingInAppLog = await tx.reminderLog.findFirst({
          where: {
            userId: application.userId,
            reminderType: ReminderType.SKEAP_APPLICATION,
            targetType,
            targetId: application.id,
            triggerDate,
            channel: "in-app",
          },
          select: { id: true },
        });
        if (!existingInAppLog) {
          const inAppLog = await tx.reminderLog.create({
            data: {
              userId: application.userId,
              reminderType: ReminderType.SKEAP_APPLICATION,
              targetType,
              targetId: application.id,
              triggerDate,
              channel: "in-app",
              success: true,
              metadata: { ...metadata, subject, body: message },
            },
            select: { id: true },
          });
          const sourceKey = `reminder:${inAppLog.id}`;
          await tx.notification.upsert({
            where: {
              userId_sourceKey: { userId: application.userId, sourceKey },
            },
            create: {
              userId: application.userId,
              sourceKey,
              message: `${subject}: ${message}`,
            },
            update: { message: `${subject}: ${message}` },
          });
        }

        const existingEmailLog = await tx.reminderLog.findFirst({
          where: {
            userId: application.userId,
            reminderType: ReminderType.SKEAP_APPLICATION,
            targetType,
            targetId: application.id,
            triggerDate,
            channel: "email",
          },
          select: { id: true, success: true, metadata: true },
        });
        const existingMetadata =
          typeof existingEmailLog?.metadata === "object" &&
          existingEmailLog.metadata !== null &&
          !Array.isArray(existingEmailLog.metadata)
            ? existingEmailLog.metadata as Record<string, unknown>
            : {};
        const deliveryStatus = existingMetadata.deliveryStatus;
        if (
          existingEmailLog?.success &&
          (deliveryStatus === "sent" || deliveryStatus === "skipped")
        ) {
          continue;
        }

        const emailLog = existingEmailLog
          ? await tx.reminderLog.update({
              where: { id: existingEmailLog.id },
              data: {
                success: false,
                sentAt: now,
                metadata: { ...metadata, subject, body: message, deliveryStatus: "pending" },
              },
              select: { id: true },
            })
          : await tx.reminderLog.create({
              data: {
                userId: application.userId,
                reminderType: ReminderType.SKEAP_APPLICATION,
                targetType,
                targetId: application.id,
                triggerDate,
                channel: "email",
                success: false,
                sentAt: now,
                metadata: { ...metadata, subject, body: message, deliveryStatus: "pending" },
              },
              select: { id: true },
            });
        pendingEmails.push({
          logId: emailLog.id,
          applicationId: application.id,
          applicantName,
          email: application.emailAddress || application.user.email || null,
          subject,
          message,
          expiresAt,
          offsetHours,
        });
      }

      if (dueOffsets.length > 0) {
        await tx.skeapApplication.update({
          where: { id: application.id },
          data: { waitlistOfferReminderSentAt: now },
        });
      }
    }

    return pendingEmails;
  });

  let emailSent = 0;
  let emailFailed = 0;
  let emailSkipped = 0;
  let transporter: ReturnType<typeof createGmailTransporter> | null = null;
  for (const reminder of reminders) {
    if (!reminder.email) {
      emailSkipped += 1;
      await prisma.reminderLog.update({
        where: { id: reminder.logId },
        data: {
          success: true,
          metadata: {
            applicationId: reminder.applicationId,
            offerExpiresAt: reminder.expiresAt.toISOString(),
            offsetHours: reminder.offsetHours,
            subject: reminder.subject,
            body: reminder.message,
            deliveryStatus: "skipped",
          },
        },
      });
      continue;
    }

    try {
      transporter ??= createGmailTransporter();
      await sendTransactionalEmail(
        transporter,
        reminder.email,
        reminder.subject,
        reminder.message,
        `waitlist-reminder-${reminder.applicationId}-${reminder.offsetHours}h-${reminder.expiresAt.toISOString()}`,
      );
      await prisma.reminderLog.update({
        where: { id: reminder.logId },
        data: {
          success: true,
          metadata: {
            applicationId: reminder.applicationId,
            offerExpiresAt: reminder.expiresAt.toISOString(),
            offsetHours: reminder.offsetHours,
            subject: reminder.subject,
            body: reminder.message,
            deliveryStatus: "sent",
          },
        },
      });
      emailSent += 1;
    } catch (error) {
      await prisma.reminderLog.update({
        where: { id: reminder.logId },
        data: {
          success: false,
          metadata: {
            applicationId: reminder.applicationId,
            offerExpiresAt: reminder.expiresAt.toISOString(),
            offsetHours: reminder.offsetHours,
            subject: reminder.subject,
            body: reminder.message,
            deliveryStatus: "failed",
            error: error instanceof Error ? error.message : "Unknown email delivery error",
          },
        },
      });
      emailFailed += 1;
      console.error("Failed to send SKEAP waitlist offer reminder:", {
        applicationId: reminder.applicationId,
        offsetHours: reminder.offsetHours,
        error: error instanceof Error ? error.message : "Unknown email delivery error",
      });
    }
  }

  return {
    reminderCount: reminders.length,
    emailSent,
    emailFailed,
    emailSkipped,
  };
}
