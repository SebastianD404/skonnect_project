import { prisma } from "@/lib/prisma";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";

export type ProfileArchiveType = "AGED_OUT" | "ADMIN_ARCHIVED";
export type ProfileArchiveEmailStatus = "SENT" | "FAILED" | "SKIPPED_DEMO" | "SKIPPED_DECEASED";
export type ProfileArchiveInAppStatus =
  | "SENT"
  | "FAILED"
  | "SKIPPED_NO_USER"
  | "SKIPPED_DECEASED";

export type ProfileArchiveNotificationResult = {
  emailStatus: ProfileArchiveEmailStatus;
  inAppStatus: ProfileArchiveInAppStatus;
};

type NotifyProfileArchivedInput = {
  userId: string | null;
  email: string;
  fullName: string;
  archiveType: ProfileArchiveType;
  reason?: string | null;
  archivedAt: Date;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildArchiveNotice({
  archiveType,
  reason,
}: Pick<NotifyProfileArchivedInput, "archiveType" | "reason">) {
  if (archiveType === "AGED_OUT") {
    return {
      title: "KK Profile Archived — Age Milestone (31+)",
      subject: "Notice of Katipunan ng Kabataan (KK) Profile Archival — Age Milestone (31+)",
      message:
        "We respectfully inform you that upon reaching 31 years old, beyond the 15–30 Katipunan ng Kabataan (KK) youth bracket, your Barangay Pico KK profile has been transitioned to historical archive records. If you have an ongoing SKEAP disbursement inquiry, please contact the Barangay Pico SK Office.",
    };
  }

  const normalizedReason = reason?.trim() ?? "";
  const reasonMessage = normalizedReason ? ` Reason: ${normalizedReason}.` : "";
  const message =
    normalizedReason === "Voluntary Withdrawal / Opt-Out"
      ? "This confirms that your request to opt out has been processed and your KK profile has been removed from active SK rosters. Your profile remains in historical archive records."
      : normalizedReason === "Transferred Residence"
        ? "Your KK profile was archived because you relocated outside Barangay Pico. Your record remains in historical archive records."
        : normalizedReason === "Duplicate or Invalid Record"
          ? "Your KK profile was archived after being identified as a duplicate or invalid record. If you believe this is incorrect, please contact the Barangay Pico SK Office."
          : `Your KK profile was archived by Barangay Pico SK officials.${reasonMessage} If you have questions or would like to request reactivation, please contact the Barangay Pico SK Office.`;
  return {
    title: "KK Profile Archived",
    subject: "Notice of Katipunan ng Kabataan (KK) Profile Archival",
    message,
  };
}

function buildEmailHtml(fullName: string, title: string, message: string) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border:1px solid #dbe3ec;border-radius:12px;background:#ffffff;border-collapse:separate;overflow:hidden;">
      <tr>
        <td style="padding:24px 32px;background:#0f3d5c;color:#ffffff;">
          <p style="margin:0;color:#b9e8ed;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Sangguniang Kabataan · Barangay Pico</p>
          <h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:#ffffff;">${escapeHtml(title)}</h1>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px;font-size:15px;line-height:1.7;">
          <p style="margin:0 0 16px;">Dear ${escapeHtml(fullName)},</p>
          <p style="margin:0 0 20px;">${escapeHtml(message)}</p>
          <p style="margin:0;">Respectfully,<br><strong>Sangguniang Kabataan</strong><br>Barangay Pico</p>
        </td>
      </tr>
      <tr>
        <td style="border-top:1px solid #e2e8f0;padding:16px 32px;color:#64748b;font-size:12px;line-height:1.5;">Official correspondence from the Sangguniang Kabataan of Barangay Pico through SKonnect.</td>
      </tr>
    </table>
  </body>
</html>`;
}

function isDemoEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail.endsWith(".invalid") || normalizedEmail.includes("@demo.skonnect");
}

async function logEmailDelivery(
  userId: string | null,
  subject: string,
  status: ProfileArchiveEmailStatus,
) {
  if (!userId) return;
  try {
    await prisma.notificationLog.create({
      data: {
        userId,
        type: `PROFILE_ARCHIVED_EMAIL_${status}`,
        channel: "email",
        subject,
        success: status === "SENT",
      },
    });
  } catch (error) {
    console.error("Could not log KK profile archive email delivery.", { userId, status, error });
  }
}

async function logDeceasedArchiveSkip(userId: string | null) {
  if (!userId) return;
  try {
    await prisma.notificationLog.create({
      data: {
        userId,
        type: "PROFILE_ARCHIVED_SKIPPED_DECEASED",
        channel: "all",
        subject: "KK profile archival notice skipped for deceased resident",
        success: false,
      },
    });
  } catch (error) {
    console.error("Could not log skipped KK profile archive notification.", { userId, error });
  }
}

export async function notifyProfileArchived({
  userId,
  email,
  fullName,
  archiveType,
  reason,
  archivedAt,
}: NotifyProfileArchivedInput): Promise<ProfileArchiveNotificationResult> {
  const notice = buildArchiveNotice({ archiveType, reason });
  if (reason?.trim().toLowerCase() === "deceased") {
    await logDeceasedArchiveSkip(userId);
    return {
      emailStatus: "SKIPPED_DECEASED",
      inAppStatus: "SKIPPED_DECEASED",
    };
  }

  const sourceKey = `kk-profile-archived:${archiveType.toLowerCase()}:${archivedAt.toISOString()}`;
  let inAppStatus: ProfileArchiveInAppStatus = "SKIPPED_NO_USER";

  if (userId) {
    try {
      await prisma.notification.upsert({
        where: { userId_sourceKey: { userId, sourceKey } },
        create: {
          userId,
          sourceKey,
          message: `${notice.title}\n\n${notice.message}`,
        },
        update: { message: `${notice.title}\n\n${notice.message}` },
      });
      inAppStatus = "SENT";
    } catch (error) {
      inAppStatus = "FAILED";
      console.error("Could not create KK profile archive in-app notification.", { userId, error });
    }
  }

  let emailStatus: ProfileArchiveEmailStatus;
  if (isDemoEmail(email)) {
    emailStatus = "SKIPPED_DEMO";
  } else {
    try {
      const transporter = createGmailTransporter();
      const emailBody = `Dear ${fullName},\n\n${notice.message}\n\nRespectfully,\nSangguniang Kabataan\nBarangay Pico`;
      await sendTransactionalEmail(
        transporter,
        email,
        notice.subject,
        emailBody,
        `kk-profile-archived-${archiveType.toLowerCase()}-${archivedAt.getTime()}`,
        buildEmailHtml(fullName, notice.title, notice.message),
      );
      emailStatus = "SENT";
    } catch (error) {
      emailStatus = "FAILED";
      console.error("Could not send KK profile archive email.", { userId, email, error });
    }
  }

  await logEmailDelivery(userId, notice.subject, emailStatus);
  return { emailStatus, inAppStatus };
}
