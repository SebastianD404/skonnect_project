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
