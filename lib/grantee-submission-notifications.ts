import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildSubmissionReviewEmail,
  createGmailTransporter,
  sendTransactionalEmail,
  type SubmissionReviewEmailStage,
} from "@/lib/broadcast-email";

type PhysicalCtcNotificationStage = "requested" | "approved";

type GranteeSubmissionNotificationStage = "returned" | "physical-requested" | "fully-cleared";

type GranteeSubmissionNotificationInput = {
  stage: GranteeSubmissionNotificationStage;
  submissionId: string;
  userId: string;
  semester: string;
  documentLabel?: string;
  reviewerNotes?: string | null;
  createdAt?: Date;
};

type NotificationWriter = Pick<Prisma.TransactionClient["notification"], "upsert">;

export async function writeGranteeSubmissionNotification(
  notification: NotificationWriter,
  {
    stage,
    submissionId,
    userId,
    semester,
    documentLabel: reviewedDocument = "submission",
    reviewerNotes,
    createdAt = new Date(),
  }: GranteeSubmissionNotificationInput,
) {
  const title = stage === "returned"
    ? `Action Required: Update ${semester} ${reviewedDocument}`
    : stage === "physical-requested"
      ? "Action Required: Submit Original / CTC"
      : "SKEAP Requirements Fully Approved";
  const stageMessage = stage === "returned"
    ? `Your ${semester} ${reviewedDocument} was returned for edits.`
    : stage === "physical-requested"
      ? `Your digital documents for ${semester} have passed initial review. To complete your final verification, please present your physical documents at the Barangay Pico SK Office.`
      : `Your physical Original / CTC documents for ${semester} have been verified. Your SKEAP requirements are now fully approved.`;
  const trimmedNotes = reviewerNotes?.trim() || "";
  const message = [
    title,
    stageMessage,
    trimmedNotes ? `REVIEWER NOTES\n${trimmedNotes}` : "",
  ].filter(Boolean).join("\n\n");
  const sourceKey = stage === "returned"
    ? `submission:${submissionId}:review-returned:${createdAt.toISOString()}`
    : `submission:${submissionId}:${stage}`;

  await notification.upsert({
    where: { userId_sourceKey: { userId, sourceKey } },
    create: { userId, sourceKey, message, isRead: false },
    update: { message, isRead: false, readAt: null },
  });

  return { sourceKey, title, message };
}

type PhysicalCtcNotificationInput = {
  stage: PhysicalCtcNotificationStage;
  submissionId: string;
  userId: string;
  granteeFullName: string;
  email: string;
  semester: string;
  reviewerNotes?: string | null;
};

type SubmissionReviewEmailInput = {
  stage: "returned" | "physical-requested" | "fully-cleared";
  submissionId: string;
  granteeFullName: string;
  email: string;
  semester: string;
  documentLabel?: string;
  reviewerNotes?: string | null;
};

export async function sendGranteeSubmissionReviewEmail({
  stage,
  submissionId,
  granteeFullName,
  email,
  semester,
  documentLabel,
  reviewerNotes,
}: SubmissionReviewEmailInput): Promise<string[]> {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return [];

  try {
    const emailStage: SubmissionReviewEmailStage =
      stage === "returned"
        ? "RETURNED_FOR_EDITS"
        : stage === "physical-requested"
          ? "FOR_PHYSICAL_CTC"
          : "FULLY_CLEARED";
    const template = buildSubmissionReviewEmail({
      stage: emailStage,
      granteeFullName,
      semesterLabel: semester,
      documentLabel,
      reviewerNotes: reviewerNotes?.trim() || "",
    });
    const transporter = createGmailTransporter();
    await sendTransactionalEmail(
      transporter,
      email,
      template.subject,
      template.text,
      `submission-${submissionId}-${stage}`,
      template.html,
    );
    return [];
  } catch (error) {
    return [`Email notification failed: ${error instanceof Error ? error.message : String(error)}`];
  }
}

export async function notifyGranteePhysicalCtcStatus({
  stage,
  submissionId,
  userId,
  granteeFullName,
  email,
  semester,
  reviewerNotes,
}: PhysicalCtcNotificationInput): Promise<string[]> {
  const isRequest = stage === "requested";
  const notificationStage = isRequest ? "physical-requested" : "fully-cleared";
  const errors: string[] = [];

  try {
    await writeGranteeSubmissionNotification(prisma.notification, {
      stage: notificationStage,
      submissionId,
      userId,
      semester,
      reviewerNotes,
    });
  } catch (error) {
    errors.push(`In-app notification failed: ${error instanceof Error ? error.message : String(error)}`);
  }

  errors.push(...await sendGranteeSubmissionReviewEmail({
    stage: notificationStage,
    submissionId,
    granteeFullName,
    email,
    semester,
    reviewerNotes: reviewerNotes?.trim() || "",
  }));

  return errors;
}
