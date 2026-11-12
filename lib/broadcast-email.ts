import nodemailer from "nodemailer";
import { prisma } from "@/lib/prisma";

const db = prisma;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
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
) {
  const from = `SKEAP Admin <${process.env.GMAIL_USER}>`;
  return transporter.sendMail({
    from,
    to,
    subject,
    text: body,
    html: buildBroadcastHtml(subject, body),
    replyTo: process.env.EMAIL_REPLY_TO || process.env.GMAIL_USER,
    headers: {
      "X-Entity-Ref-ID": `skonnect-${referenceId}`,
      "X-Auto-Response-Suppress": "All",
    },
  });
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
  const safeSemester = escapeHtml(semester);
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
        <p style="margin:0;color:#475569;font-size:14px;line-height:1.7;">Your ${safeSemester} SKEAP scholarship payout is ready. Please sign in and confirm that you received the cash.</p>
        <div style="margin:24px 0;padding:18px;border:1px solid #e2e8f0;border-radius:14px;background:#f8fafc;">
          <p style="margin:0;color:#64748b;font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">Stipend amount</p>
          <p style="margin:8px 0 0;color:#0f172a;font-size:30px;font-weight:700;letter-spacing:-0.5px;">${safeAmount}</p>
          <p style="margin:8px 0 0;color:#64748b;font-size:12px;">${safeSemester}</p>
        </div>
        <a href="${safeConfirmationUrl}" style="display:block;border-radius:12px;background:#0891b2;padding:15px 20px;color:#ffffff;text-align:center;text-decoration:none;font-size:14px;font-weight:700;">Log In to Confirm Payout</a>
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

  return transporter.sendMail({
    from: `SKEAP Admin <${process.env.GMAIL_USER}>`,
    to,
    subject,
    text: [
      `Hello ${details.recipientName},`,
      "",
      `Your ${details.semester} SKEAP payout of ${amount} has been disbursed.`,
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
