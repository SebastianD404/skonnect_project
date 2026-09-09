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
  const safeBody = escapeHtml(body).replace(/\r?\n/g, "<br />");

  return `<!doctype html>
<html lang="en">
  <body style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:Arial,sans-serif;color:#0f172a;">
    <div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background:#0f3d5c;padding:24px 28px;color:#ffffff;">
        <p style="margin:0;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#bae6fd;">SKEAP Admin Notice</p>
        <h1 style="margin:10px 0 0;font-size:24px;line-height:1.3;">${safeSubject}</h1>
      </div>
      <div style="padding:28px;font-size:16px;line-height:1.7;">
        <p style="margin:0;">${safeBody}</p>
      </div>
      <div style="border-top:1px solid #e2e8f0;padding:16px 28px;color:#64748b;font-size:12px;">
        This message was sent by the SKEAP administration through SKonnect.
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
  });
}
