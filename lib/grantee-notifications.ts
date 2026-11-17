import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createGmailTransporter, sendTransactionalEmail } from "@/lib/broadcast-email";
import {
  detectGranteeTargetTerm,
  getScheduleSemesterForTargetTerm,
} from "@/lib/grantee-semester";

export type GranteeUploadNotificationTrigger =
  | "ADMIN_SETTINGS"
  | "REQUIREMENT_APPROVED"
  | "GRANTEE_APPROVED"
  | "SUBMISSION_OPEN"
  | "DEADLINE_REMINDER";

export type NotifyGranteesToUploadRequirementsInput = {
  targetUserIds?: string[];
  schoolYear?: string;
  semester?: string;
  deadline?: Date | string;
  now?: Date;
  trigger: GranteeUploadNotificationTrigger;
};

export type GranteeUploadNotificationResult = {
  notified: number;
  emailSent: number;
  skipped: number;
  errors: string[];
};

function formatDeadline(value: Date | string) {
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function getRequirementsUrl() {
  const vercelUrl = process.env.VERCEL_URL?.trim();
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (vercelUrl ? `https://${vercelUrl}` : null);
  if (!configuredUrl) return null;

  const appUrl = new URL(configuredUrl);
  if (appUrl.protocol !== "https:" && appUrl.protocol !== "http:") {
    throw new Error("The grantee requirements URL must use HTTP or HTTPS.");
  }
  const hostname = appUrl.hostname.toLowerCase();
  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("127.") ||
    hostname === "[::1]"
  ) {
    return null;
  }
  return new URL("/grantee-dashboard/documents", appUrl).toString();
}

function isUniqueConstraintError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function matchesRequestedTerm(
  target: { schoolYear: string; semester: string },
  schoolYear?: string,
  semester?: string,
) {
  if (schoolYear && target.schoolYear !== schoolYear) return false;
  if (!semester) return true;
  if (target.semester === semester) return true;
  return target.semester === "Annual / School Year" && semester === "First Semester";
}

export async function notifyGranteesToUploadRequirements({
  targetUserIds,
  schoolYear,
  semester,
  deadline,
  now = new Date(),
  trigger,
}: NotifyGranteesToUploadRequirementsInput): Promise<GranteeUploadNotificationResult> {
  const result: GranteeUploadNotificationResult = {
    notified: 0,
    emailSent: 0,
    skipped: 0,
    errors: [],
  };
  const grantees = await prisma.user.findMany({
    where: {
      role: "GRANTEE",
      isActive: true,
      ...(targetUserIds ? { id: { in: targetUserIds } } : {}),
      grantee: { is: { status: { in: ["ACTIVE", "PROBATIONARY"] } } },
    },
    select: { id: true, email: true, emailNotifications: true },
  });
  const schedules = await prisma.academicTermSchedule.findMany({
    select: { semester: true, opensAt: true },
  });

  let transporter: ReturnType<typeof createGmailTransporter> | null = null;
  const emailConfigured = Boolean(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);

  for (const grantee of grantees) {
    try {
      const targetTerm = await detectGranteeTargetTerm(grantee.id);
      if (
        !targetTerm ||
        targetTerm.hasPendingSubmission ||
        targetTerm.hasApprovedSubmission ||
        !matchesRequestedTerm(targetTerm, schoolYear, semester)
      ) {
        result.skipped += 1;
        continue;
      }

      const scheduleSemester = getScheduleSemesterForTargetTerm(targetTerm);
      const targetSchedule = schedules.find((schedule) => schedule.semester === scheduleSemester);
      if (!targetSchedule || targetSchedule.opensAt > now) {
        result.skipped += 1;
        continue;
      }

      const title = `Action Required: Upload ${targetTerm.schoolYear} ${targetTerm.semester} Requirements`;
      const message = `Your SKEAP requirement submission for ${targetTerm.schoolYear} (${targetTerm.semester}) is now open. Please upload your latest grades and enrollment documents${deadline ? ` before ${formatDeadline(deadline)}` : ""}.`;
      const sourceKeyTrigger = trigger === "DEADLINE_REMINDER" ? trigger : "SUBMISSION_OPEN";
      const sourceKey = `requirements-upload:${encodeURIComponent(targetTerm.schoolYear)}:${encodeURIComponent(targetTerm.semester)}:${sourceKeyTrigger}`;

      try {
        await prisma.notification.create({
          data: {
            userId: grantee.id,
            sourceKey,
            message: `${title}\n${message}`,
          },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          result.skipped += 1;
          continue;
        }
        throw error;
      }

      result.notified += 1;
      if (!emailConfigured || !grantee.email || !grantee.emailNotifications) continue;

      try {
        transporter ??= createGmailTransporter();
        const requirementsUrl = getRequirementsUrl();
        await sendTransactionalEmail(
          transporter,
          grantee.email,
          title,
          requirementsUrl
            ? `${message}\n\nOpen your requirements: ${requirementsUrl}`
            : message,
          sourceKey,
        );
        result.emailSent += 1;
      } catch (error) {
        console.error(`Failed to email grantee ${grantee.id} about requirement uploads:`, error);
        result.errors.push(`Email delivery failed for grantee ${grantee.id}.`);
      }
    } catch (error) {
      console.error(`Failed to notify grantee ${grantee.id} about requirement uploads:`, error);
      result.errors.push(`Notification failed for grantee ${grantee.id}.`);
    }
  }

  return result;
}
