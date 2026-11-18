import { prisma } from "@/lib/prisma";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";

type NotifyProfileRestoredInput = {
  userId: string | null;
  email: string;
  fullName: string;
  registrationId: string;
  restoredAt: Date;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function isDemoEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return normalizedEmail.endsWith(".invalid") || normalizedEmail.includes("@demo.skonnect");
}

async function logEmailDelivery(
  userId: string | null,
  subject: string,
  status: "SENT" | "FAILED" | "SKIPPED_DEMO",
) {
  if (!userId) return;
  try {
    await prisma.notificationLog.create({
      data: {
        userId,
        type: `PROFILE_RESTORED_EMAIL_${status}`,
        channel: "email",
        subject,
        success: status === "SENT",
      },
    });
  } catch (error) {
    console.error("Could not log KK profile restoration email delivery.", { userId, status, error });
  }
}

export async function notifyProfileRestored({
  userId,
  email,
  fullName,
  registrationId,
  restoredAt,
}: NotifyProfileRestoredInput) {
  const title = "KK Profile Restored";
  const subject = "Your Katipunan ng Kabataan (KK) Profile Has Been Restored";
  const message =
    "Your profile has been restored to the active Katipunan ng Kabataan (KK) registry and is included in active barangay reports.";
  let inAppStatus: "SENT" | "FAILED" | "SKIPPED_NO_USER" = "SKIPPED_NO_USER";

  if (userId) {
    try {
      await prisma.notification.upsert({
        where: {
          userId_sourceKey: {
            userId,
            sourceKey: `kk-profile-restored:${registrationId}:${restoredAt.getTime()}`,
          },
        },
        create: {
          userId,
          sourceKey: `kk-profile-restored:${registrationId}:${restoredAt.getTime()}`,
          message: `${title}\n\n${message}`,
        },
        update: { message: `${title}\n\n${message}` },
      });
      inAppStatus = "SENT";
    } catch (error) {
      inAppStatus = "FAILED";
      console.error("Could not create KK profile restoration in-app notification.", { userId, error });
    }
  }

  let emailStatus: "SENT" | "FAILED" | "SKIPPED_DEMO";
  if (isDemoEmail(email)) {
    emailStatus = "SKIPPED_DEMO";
  } else {
    try {
      const safeName = escapeHtml(fullName);
      const safeTitle = escapeHtml(title);
      const safeMessage = escapeHtml(message);
      const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;background:#f1f5f9;padding:32px 16px;font-family:Arial,Helvetica,sans-serif;color:#1e293b;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;margin:0 auto;border:1px solid #dbe3ec;border-radius:12px;background:#ffffff;border-collapse:separate;overflow:hidden;">
      <tr><td style="padding:24px 32px;background:#0f3d5c;color:#ffffff;"><p style="margin:0;color:#b9e8ed;font-size:11px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Sangguniang Kabataan · Barangay Pico</p><h1 style="margin:12px 0 0;font-size:22px;line-height:1.3;color:#ffffff;">${safeTitle}</h1></td></tr>
      <tr><td style="padding:28px 32px;font-size:15px;line-height:1.7;"><p style="margin:0 0 16px;">Dear ${safeName},</p><p style="margin:0 0 20px;">${safeMessage}</p><p style="margin:0;">Respectfully,<br><strong>Sangguniang Kabataan</strong><br>Barangay Pico</p></td></tr>
      <tr><td style="border-top:1px solid #e2e8f0;padding:16px 32px;color:#64748b;font-size:12px;line-height:1.5;">Official correspondence from the Sangguniang Kabataan of Barangay Pico through SKonnect.</td></tr>
    </table>
  </body>
</html>`;
      const transporter = createGmailTransporter();
      await sendTransactionalEmail(
        transporter,
        email,
        subject,
        `Dear ${fullName},\n\n${message}\n\nRespectfully,\nSangguniang Kabataan\nBarangay Pico`,
        `kk-profile-restored-${registrationId}-${restoredAt.getTime()}`,
        html,
      );
      emailStatus = "SENT";
    } catch (error) {
      emailStatus = "FAILED";
      console.error("Could not send KK profile restoration email.", { userId, email, error });
    }
  }

  await logEmailDelivery(userId, subject, emailStatus);
  return { inAppStatus, emailStatus };
}
