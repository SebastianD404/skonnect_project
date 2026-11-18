import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";
import { getEmailAppBaseUrl } from "@/lib/app-url";

const db = prisma;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPayoutPeriodDetails(value: string) {
  const match = /^(\d{4}-\d{4})\s+(.+)$/.exec(value.trim());
  return {
    academicYear: match?.[1] ?? "Not specified",
    semester: match?.[2] ?? value.trim(),
  };
}

export function createGmailTransporter() {
  const user = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD;

  if (!user || !appPassword) {
    throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be configured.");
  }

  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass: appPassword,
    },
  });
}

export function getSkeapDashboardUrl() {
  return new URL("/grantee-dashboard", getEmailAppBaseUrl()).toString();
}

export function buildBroadcastHtml(subject: string, body: string) {
  const safeSubject = escapeHtml(subject);
  const safeBody = escapeHtml(body)
    .split(/\r?\n/)
    .map((line) => (line ? `<p style="margin:0 0 16px;">${line}</p>` : ""))
    .join("");

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#eef5f8;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #d7e3e8;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,61,92,0.08);">
      <div style="height:5px;background:#16a3b8;font-size:0;line-height:0;">&nbsp;</div>
      <div style="padding:28px 32px 24px;background:#0f3d5c;color:#ffffff;">
        <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#9fe4eb;">SKonnect · SKEAP</p>
        <h1 style="margin:12px 0 0;font-size:25px;line-height:1.25;color:#ffffff;">${safeSubject}</h1>
      </div>
      <div style="padding:32px;font-size:16px;line-height:1.75;">
        ${safeBody}
      </div>
      <div style="margin:0 32px 28px;padding:16px 18px;border:1px solid #b9e3e8;border-radius:10px;background:#f0fbfc;color:#0f3d5c;font-size:13px;line-height:1.5;">
        <strong style="display:block;margin-bottom:4px;color:#0f3d5c;">SKEAP status update</strong>
        Your scholarship record has been updated. Please keep this message for your records.
      </div>
      <div style="border-top:1px solid #d7e3e8;padding:18px 32px;color:#64748b;font-size:12px;line-height:1.5;">
        This is an administrative message from the SKEAP administration through SKonnect.
      </div>
    </div>
  </body>
</html>`;
}

export type SubmissionReviewEmailStage =
  | "FOR_PHYSICAL_CTC"
  | "RETURNED_FOR_EDITS"
  | "FULLY_CLEARED";

export interface SubmissionReviewEmailInput {
  stage: SubmissionReviewEmailStage;
  granteeFullName: string;
  semesterLabel: string;
  documentLabel?: string;
  reviewerNotes?: string | null;
}

export function buildSubmissionReviewEmail({
  stage,
  granteeFullName,
  semesterLabel,
  documentLabel = "submission",
  reviewerNotes,
}: SubmissionReviewEmailInput) {
  const trimmedNotes =
    reviewerNotes && reviewerNotes.trim().length > 0 ? reviewerNotes.trim() : "";
  const safeName = escapeHtml(granteeFullName);
  const safeSemester = escapeHtml(semesterLabel);
  const safeDocument = escapeHtml(documentLabel);
  const appLink = new URL("/grantee-dashboard/documents", getEmailAppBaseUrl());
  if (appLink.protocol !== "https:" && appLink.protocol !== "http:") {
    throw new Error("The submission review URL must use HTTP or HTTPS.");
  }
  const safeAppLink = escapeHtml(appLink.toString());

  const title = stage === "FOR_PHYSICAL_CTC"
    ? "Action Required: Submit Original / CTC"
    : stage === "RETURNED_FOR_EDITS"
      ? `Action Required: Update ${semesterLabel} ${documentLabel}`
      : "SKEAP Requirements Fully Approved";
  const stageMessage = stage === "FOR_PHYSICAL_CTC"
    ? `Your digital documents for ${semesterLabel} have passed initial review. To complete your final verification, please present your physical documents at the Barangay Pico SK Office.`
    : stage === "RETURNED_FOR_EDITS"
      ? `Your ${semesterLabel} ${documentLabel} was returned for edits. Please review the feedback below and upload the corrected document in SKonnect.`
      : `Your physical Original / CTC documents for ${semesterLabel} have been verified. Your SKEAP requirements are now fully approved.`;
  const notesText = trimmedNotes ? `\n\nREVIEWER NOTES\n${trimmedNotes}` : "";
  const text = [
    `Dear ${granteeFullName},`,
    "",
    stageMessage,
    "",
    stage === "FOR_PHYSICAL_CTC"
      ? [
          `Academic Term: ${semesterLabel}`,
          "Documents to Bring: Original or Certified True Copy (CTC) of Grade Report & Certificate of Enrollment",
          "Drop-Off Location: Barangay Pico SK Office, La Trinidad, Benguet",
        ].join("\n")
      : stage === "RETURNED_FOR_EDITS"
        ? [`Academic Term: ${semesterLabel}`, `Document: ${documentLabel}`, "Next Step: Upload the corrected document in SKonnect."].join("\n")
        : [`Academic Term: ${semesterLabel}`, "Verification Status: Fully cleared"].join("\n"),
    notesText,
    "",
    `View Submission in SKonnect: ${appLink.toString()}`,
  ].filter(Boolean).join("\n");
  const notesHtml = trimmedNotes
    ? `<div style="margin:20px 0 0;background:#f8fafc;border-left:3px solid #0f766e;padding:12px 14px;border-radius:8px;">
        <p style="margin:0 0 6px;color:#475569;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">REVIEWER NOTES</p>
        <p style="margin:0;color:#334155;font-size:14px;line-height:1.65;white-space:pre-line;">${escapeHtml(trimmedNotes)}</p>
      </div>`
    : "";
  const detailsHtml = stage === "FOR_PHYSICAL_CTC"
    ? `<div style="margin:24px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
        <h2 style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.4;">Physical Verification Details</h2>
        <p style="margin:0 0 10px;color:#475569;font-size:13px;line-height:1.6;"><strong style="color:#0f172a;">Academic Term:</strong> ${safeSemester}</p>
        <p style="margin:0 0 10px;color:#475569;font-size:13px;line-height:1.6;"><strong style="color:#0f172a;">Documents to Bring:</strong> Original or Certified True Copy (CTC) of Grade Report &amp; Certificate of Enrollment</p>
        <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;"><strong style="color:#0f172a;">Drop-Off Location:</strong> Barangay Pico SK Office, La Trinidad, Benguet</p>
      </div>`
    : stage === "RETURNED_FOR_EDITS"
      ? `<div style="margin:24px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
          <h2 style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.4;">Review Details</h2>
          <p style="margin:0 0 10px;color:#475569;font-size:13px;line-height:1.6;"><strong style="color:#0f172a;">Academic Term:</strong> ${safeSemester}</p>
          <p style="margin:0 0 10px;color:#475569;font-size:13px;line-height:1.6;"><strong style="color:#0f172a;">Document:</strong> ${safeDocument}</p>
          <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;"><strong style="color:#0f172a;">Next Step:</strong> Upload the corrected document in SKonnect.</p>
        </div>`
      : `<div style="margin:24px 0 0;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
          <h2 style="margin:0 0 12px;color:#0f172a;font-size:15px;line-height:1.4;">Verification Details</h2>
          <p style="margin:0 0 10px;color:#475569;font-size:13px;line-height:1.6;"><strong style="color:#0f172a;">Academic Term:</strong> ${safeSemester}</p>
          <p style="margin:0;color:#475569;font-size:13px;line-height:1.6;"><strong style="color:#0f172a;">Verification Status:</strong> Fully cleared</p>
        </div>`;
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#eef5f8;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #d7e3e8;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,61,92,0.08);">
      <div style="height:5px;background:#16a3b8;font-size:0;line-height:0;">&nbsp;</div>
      <div style="padding:28px 32px 24px;background:#0f3d5c;color:#ffffff;">
        <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#9fe4eb;">SKONNECT · SKEAP</p>
        <h1 style="margin:12px 0 0;font-size:25px;line-height:1.25;color:#ffffff;">${escapeHtml(title)}</h1>
      </div>
      <div style="padding:30px 32px 32px;">
        <p style="margin:0 0 16px;color:#0f172a;font-size:15px;line-height:1.6;">Dear ${safeName},</p>
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.75;">${escapeHtml(stageMessage)}</p>
        ${detailsHtml}
        ${notesHtml}
        <a href="${safeAppLink}" style="display:block;margin:24px 0 0;border-radius:8px;background:#0f3d56;padding:14px 20px;color:#ffffff;text-align:center;text-decoration:none;font-size:14px;font-weight:700;">View Submission in SKonnect</a>
      </div>
      <div style="border-top:1px solid #d7e3e8;padding:18px 32px;color:#64748b;font-size:12px;line-height:1.5;">Sangguniang Kabataan of Barangay Pico · La Trinidad, Benguet</div>
    </div>
  </body>
</html>`;

  return { subject: title, text, html };
}

export interface ExitClearanceReturnedEmailInput {
  granteeFullName: string;
  remarks: string;
  dashboardUrl: string;
}

export function buildExitClearanceReturnedEmail({
  granteeFullName,
  remarks,
  dashboardUrl,
}: ExitClearanceReturnedEmailInput) {
  const dashboardLink = new URL(dashboardUrl);
  if (dashboardLink.protocol !== "https:" && dashboardLink.protocol !== "http:") {
    throw new Error("The grantee dashboard URL must use HTTP or HTTPS.");
  }

  const name = granteeFullName.trim() || "Scholar";
  const reason = remarks.trim();
  const safeName = escapeHtml(name);
  const safeReason = escapeHtml(reason);
  const safeDashboardUrl = escapeHtml(dashboardLink.toString());
  const subject = "Action Required: Re-upload Your SKEAP Exit Clearance";
  const text = [
    `Dear ${name},`,
    "",
    "Your SKEAP Exit Clearance was returned for re-upload. Please review the SK Admin's reason and upload a clearer copy.",
    "",
    "Reason from SK Admin:",
    reason,
    "",
    `Open your Grantee Dashboard: ${dashboardLink.toString()}`,
    "",
    "SK Council of Barangay Pico",
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#eef5f8;padding:40px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:620px;margin:0 auto;background:#ffffff;border:1px solid #d7e3e8;border-radius:16px;overflow:hidden;box-shadow:0 8px 24px rgba(15,61,92,0.08);">
      <div style="height:5px;background:#16a3b8;font-size:0;line-height:0;">&nbsp;</div>
      <div style="padding:28px 32px 24px;background:#0f3d5c;color:#ffffff;">
        <p style="margin:0;font-size:11px;font-weight:bold;letter-spacing:2px;text-transform:uppercase;color:#9fe4eb;">SKONNECT · SKEAP</p>
        <h1 style="margin:12px 0 0;font-size:25px;line-height:1.25;color:#ffffff;">${escapeHtml(subject)}</h1>
      </div>
      <div style="padding:30px 32px 32px;">
        <p style="margin:0 0 16px;color:#0f172a;font-size:15px;line-height:1.6;">Dear ${safeName},</p>
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.75;">Your SKEAP Exit Clearance was returned for re-upload. Please review the SK Admin's reason and upload a clearer copy.</p>
        <div style="margin:24px 0 0;background:#f8fafc;border-left:3px solid #0f766e;padding:12px 14px;border-radius:8px;">
          <p style="margin:0 0 6px;color:#475569;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Reason from SK Admin</p>
          <p style="margin:0;color:#334155;font-size:14px;line-height:1.65;white-space:pre-line;">${safeReason}</p>
        </div>
        <a href="${safeDashboardUrl}" style="display:block;margin:24px 0 0;border-radius:8px;background:#0f3d56;padding:14px 20px;color:#ffffff;text-align:center;text-decoration:none;font-size:14px;font-weight:700;">Open Grantee Dashboard</a>
      </div>
      <div style="border-top:1px solid #d7e3e8;padding:18px 32px;color:#64748b;font-size:12px;line-height:1.5;">Sangguniang Kabataan of Barangay Pico · La Trinidad, Benguet</div>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

export interface GranteeApprovalEmailInput {
  to: string;
  applicantName: string;
  academicYear: string;
  semester: string;
  dashboardUrl: string;
}

export function buildGranteeApprovalEmail({
  applicantName,
  academicYear,
  semester,
  dashboardUrl,
}: GranteeApprovalEmailInput) {
  const dashboardLink = new URL(dashboardUrl);
  if (dashboardLink.protocol !== "https:" && dashboardLink.protocol !== "http:") {
    throw new Error("The grantee dashboard URL must use HTTP or HTTPS.");
  }

  const safeName = escapeHtml(applicantName.trim() || "Scholar");
  const safeAcademicYear = escapeHtml(academicYear);
  const safeSemester = escapeHtml(semester);
  const safeDashboardUrl = escapeHtml(dashboardLink.toString());
  const subject = `Congratulations! SKEAP Scholarship Approved (${academicYear} ${semester}) - SKonnect`;
  const text = [
    `Hello ${applicantName.trim() || "Scholar"},`,
    "",
    "Congratulations! You have been officially approved as a SKEAP Scholar.",
    "",
    `Academic Year: ${academicYear}`,
    `Semester: ${semester}`,
    "Status: Active Grantee",
    "",
    "Key Scholar Responsibilities:",
    "- Semestral Submissions: Upload your updated Certificate of Enrollment (COE) and Official Grades each semester.",
    "- Grade Retention Policy: Maintain 80% or above (or passing mark) across all subjects with no failing grade in any single subject.",
    "- Mandatory KK Assemblies & Payouts: Attend official Katipunan ng Kabataan (KK) assemblies, where stipend payouts are distributed.",
    "",
    `Open Grantee Workspace: ${dashboardLink.toString()}`,
  ].join("\n");
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(subject)}</title>
  </head>
  <body style="margin:0;background:#f1f5f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;border:1px solid #dbe4ea;border-radius:16px;background:#ffffff;overflow:hidden;">
            <tr>
              <td style="padding:30px 32px;background:#082438;color:#ffffff;">
                <p style="margin:0;color:#a8d7dc;font-size:11px;font-weight:700;letter-spacing:1.6px;">SANGGUNIANG KABATAAN · BARANGAY PICO</p>
                <h1 style="margin:12px 0 0;color:#ffffff;font-size:25px;line-height:1.25;">Official SKEAP Grantee Approval</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:28px 32px 32px;">
                <p style="margin:0 0 14px;font-size:15px;line-height:1.6;">Hello ${safeName},</p>
                <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;">Congratulations! You have been officially approved as a SKEAP Scholar.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:22px;border:1px solid #dce8ec;border-radius:12px;background:#f8fbfc;">
                  <tr><td style="padding:16px 18px 8px;color:#64748b;font-size:12px;">Academic Year</td><td align="right" style="padding:16px 18px 8px;color:#0f172a;font-size:13px;font-weight:700;">${safeAcademicYear}</td></tr>
                  <tr><td style="padding:8px 18px;color:#64748b;font-size:12px;">Semester</td><td align="right" style="padding:8px 18px;color:#0f172a;font-size:13px;font-weight:700;">${safeSemester}</td></tr>
                  <tr><td style="padding:8px 18px 16px;color:#64748b;font-size:12px;">Status</td><td align="right" style="padding:8px 18px 16px;color:#0d5c75;font-size:13px;font-weight:700;">Active Grantee</td></tr>
                </table>
                <h2 style="margin:24px 0 10px;color:#0f172a;font-size:15px;">Key Scholar Responsibilities</h2>
                <ul style="margin:0;padding-left:20px;color:#475569;font-size:13px;line-height:1.7;">
                  <li style="margin-bottom:8px;"><strong style="color:#0f172a;">Semestral Submissions:</strong> Upload your updated Certificate of Enrollment (COE) and Official Grades each semester.</li>
                  <li style="margin-bottom:8px;"><strong style="color:#0f172a;">Grade Retention Policy:</strong> Maintain <strong style="color:#0f172a;">80% or above (or passing mark) across all subjects</strong> with <strong style="color:#0f172a;">no failing grade in any single subject</strong>.</li>
                  <li><strong style="color:#0f172a;">Mandatory KK Assemblies &amp; Payouts:</strong> Attend official Katipunan ng Kabataan (KK) assemblies, where stipend payouts are distributed.</li>
                </ul>
                <p style="margin:26px 0 0;">
                  <a href="${safeDashboardUrl}" style="display:block;border-radius:9px;background:#0d5c75;padding:14px 20px;color:#ffffff;text-align:center;text-decoration:none;font-size:14px;font-weight:700;">Open Grantee Workspace →</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid #e2e8f0;padding:16px 32px;color:#64748b;font-size:12px;line-height:1.5;">Sangguniang Kabataan of Barangay Pico · La Trinidad, Benguet</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return { subject, text, html };
}

export async function sendBroadcastEmail(
  transporter: nodemailer.Transporter,
  userId: string,
  to: string,
  subject: string,
  body: string
) {
  const recipient = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, emailNotifications: true },
  });

  if (!recipient || !recipient.emailNotifications) {
    console.log(`Skipping email for user ${userId}: notifications disabled.`);
    return null;
  }

  const from = `SKEAP Admin <${process.env.GMAIL_USER}>`;
  return transporter.sendMail({
    from,
    to,
    subject,
    text: body,
    html: buildBroadcastHtml(subject, body),
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    headers: {
      "X-Entity-Ref-ID": `skonnect-${userId}-${Date.now()}`,
      "X-Auto-Response-Suppress": "All",
    },
  });
}

export async function sendTransactionalEmail(
  transporter: nodemailer.Transporter,
  to: string,
  subject: string,
  body: string,
  referenceId: string,
  htmlBody?: string,
) {
  const from = `SKEAP Admin <${process.env.GMAIL_USER}>`;
  return transporter.sendMail({
    from,
    to,
    subject,
    text: body,
    html: htmlBody ?? buildBroadcastHtml(subject, body),
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    headers: {
      "X-Entity-Ref-ID": `skonnect-${referenceId}`,
      "X-Auto-Response-Suppress": "All",
    },
  });
}

export async function sendGranteeApprovalEmail(input: GranteeApprovalEmailInput) {
  const email = buildGranteeApprovalEmail(input);
  const referenceId = `skeap-grantee-approval-${Date.now()}`;
  return sendTransactionalEmail(
    createGmailTransporter(),
    input.to,
    email.subject,
    email.text,
    referenceId,
    email.html,
  );
}

export type PayoutDisbursementEmail = {
  recipientName: string;
  semester: string;
  amount: number;
  confirmationUrl: string;
};

export function buildPayoutDisbursementHtml({
  recipientName,
  semester,
  amount,
  confirmationUrl,
}: PayoutDisbursementEmail) {
  const safeName = escapeHtml(recipientName);
  const { academicYear, semester: semesterName } = getPayoutPeriodDetails(semester);
  const safeAcademicYear = escapeHtml(academicYear);
  const safeSemester = escapeHtml(semesterName);
  const safeAmount = escapeHtml(
    new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
      maximumFractionDigits: 0,
    }).format(amount),
  );
  const confirmationLink = new URL(confirmationUrl);
  if (confirmationLink.protocol !== "https:" && confirmationLink.protocol !== "http:") {
    throw new Error("The payout confirmation link must use HTTP or HTTPS.");
  }
  const safeConfirmationUrl = escapeHtml(confirmationLink.toString());

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
    <div style="max-width:448px;margin:0 auto;overflow:hidden;border:1px solid #e2e8f0;border-radius:20px;background:#ffffff;box-shadow:0 12px 32px rgba(15,23,42,0.08);">
      <div style="padding:28px 32px;background:#0f172a;color:#ffffff;">
        <p style="margin:0;color:#a5f3fc;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">SKonnect · SKEAP</p>
        <h1 style="margin:14px 0 0;color:#ffffff;font-size:24px;line-height:1.3;">Your payout has been disbursed</h1>
      </div>
      <div style="padding:30px 32px;">
        <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Hi ${safeName},</p>
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;">Your SKEAP scholarship payout is ready. Please sign in and confirm that you received the cash.</p>
        <div style="margin:24px 0;padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
          <p style="margin:0;color:#64748b;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Academic year</p>
          <p style="margin:5px 0 14px;color:#0f172a;font-size:15px;font-weight:700;">${safeAcademicYear}</p>
          <p style="margin:0;color:#64748b;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Semester</p>
          <p style="margin:5px 0 14px;color:#0f172a;font-size:15px;font-weight:700;">${safeSemester}</p>
          <p style="margin:0;color:#64748b;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Disbursed amount</p>
          <p style="margin:5px 0 0;color:#0f172a;font-size:30px;font-weight:700;letter-spacing:-0.5px;">${safeAmount}</p>
        </div>
        <a href="${safeConfirmationUrl}" style="display:block;border-radius:12px;background:#0891b2;padding:15px 20px;color:#ffffff;text-align:center;text-decoration:none;font-size:14px;font-weight:700;">Sign In to Confirm Receipt</a>
        <p style="margin:18px 0 0;color:#64748b;font-size:12px;line-height:1.6;">Only confirm after you have received the cash. If you have not received it, leave the payout unconfirmed and contact the SKEAP administration.</p>
      </div>
      <div style="border-top:1px solid #e2e8f0;padding:18px 32px;color:#94a3b8;font-size:11px;line-height:1.6;">This is an official payout update from SKonnect. Please do not reply with passwords or account credentials.</div>
    </div>
  </body>
</html>`;
}

export async function sendPayoutDisbursementEmail(
  transporter: nodemailer.Transporter,
  to: string,
  details: PayoutDisbursementEmail,
) {
  const subject = `${details.semester} SKEAP payout disbursed`;
  const amount = new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 0,
  }).format(details.amount);
  const payoutPeriod = getPayoutPeriodDetails(details.semester);

  return transporter.sendMail({
    from: `SKEAP Admin <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text: [
      `Hello ${details.recipientName},`,
      "",
      "Your SKEAP payout has been disbursed.",
      `Academic Year: ${payoutPeriod.academicYear}`,
      `Semester: ${payoutPeriod.semester}`,
      `Amount: ${amount}`,
      "Please log in to confirm that you received the cash.",
      details.confirmationUrl,
    ].join("\n"),
    html: buildPayoutDisbursementHtml(details),
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    headers: {
      "X-Entity-Ref-ID": `skonnect-payout-${Date.now()}`,
      "X-Auto-Response-Suppress": "All",
    },
  });
}
