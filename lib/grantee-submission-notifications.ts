import { prisma } from "@/lib/prisma";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";

type PhysicalCtcNotificationStage = "requested" | "approved";

type PhysicalCtcNotificationInput = {
  stage: PhysicalCtcNotificationStage;
  submissionId: string;
  userId: string;
  email: string;
  semester: string;
};

export async function notifyGranteePhysicalCtcStatus({
  stage,
  submissionId,
  userId,
  email,
  semester,
}: PhysicalCtcNotificationInput): Promise<string[]> {
  const isRequest = stage === "requested";
  const title = isRequest
    ? "Action Required: Submit Original / CTC"
    : "SKEAP Requirements Fully Approved";
  const body = isRequest
    ? `Your digital documents for ${semester} passed initial review. Please submit the physical Original or Certified True Copy (CTC) of your Grade Report and Certificate of Enrollment at the Barangay Pico SK Office for final approval.`
    : `Your physical Original / CTC documents for ${semester} have been verified. Your SKEAP requirements are now fully approved.`;
  const sourceKey = `submission:${submissionId}:physical-ctc:${stage}`;
  const errors: string[] = [];

  try {
    await prisma.notification.upsert({
      where: { userId_sourceKey: { userId, sourceKey } },
      create: { userId, sourceKey, message: `${title}\n\n${body}` },
      update: { message: `${title}\n\n${body}`, isRead: false, readAt: null },
    });
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    try {
      const transporter = createGmailTransporter();
      await sendTransactionalEmail(
        transporter,
        email,
        title,
        body,
        `submission-${submissionId}-physical-ctc-${stage}`,
      );
    } catch (error) {
      errors.push(`Email notification failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return errors;
}
