import { Prisma, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getLatestSkeapResubmissionReplacements,
  getUploadGroups,
  mergeSkeapResubmittedFiles,
  getUnpersistedSkeapResubmissionReplacements,
} from "@/lib/skeap-upload";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { formatSkeapPermanentAddress } from "@/lib/grantee-address";
import { skeapApplicationInquiryWhere } from "@/lib/inquiries/filters";
import { getAcademicYearDateRange, getCurrentAcademicYear } from "@/lib/semester";
import { getSkeapWaitlistCycle, getSkeapWaitlistCycleState } from "@/lib/skeap-waitlist-cycle";
import {
  findBanWatchlistMatch,
  type PermanentSkeapRevocationRecord,
} from "@/lib/skeap-application-guard";
import { getSkeapMaxEligibleAge } from "@/lib/skeap-program-config";
import { writeAuditLog } from "@/lib/audit/logger";
import { refreshSkeapApplicationsAdminView } from "@/lib/application-admin-view-refresh";
import { createGmailTransporter, sendBroadcastEmail } from "@/lib/broadcast-email";
import { getExactAge } from "@/lib/skeap-age";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";
export {
  isSkeapApplicationRejected,
  isSkeapApplicationReturned,
  isSkeapUploadMarkedForCorrection,
} from "@/lib/skeap-application-status";

interface ApplicationMessage {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
  action?: "return";
  eventType?: "RESUBMISSION";
  attachments?: {
    fileId: string;
    documentLabel?: string;
    fileName: string;
    fileUrl: string;
    fileType: string;
    adminRemark: string;
  }[];
}

const IMAGE_REGEX = /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i;
const PDF_REGEX = /\.pdfm?(\?|$)/i;
const DOC_REGEX = /\.(docx?|xlsx?|pptx?|txt|rtf)(\?|$)/i;

export const SKEAP_APPLICATION_SELECT = {
  id: true,
  message: true,
  createdAt: true,
  response: true,
  respondedAt: true,
  isResolved: true,
  reviewStatus: true,
  reviewThread: true,
  user: {
    select: {
      id: true,
      fullName: true,
      email: true,
      phoneNumber: true,
      kkProfileId: true,
      kkProfile: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          birthDate: true,
          purok: true,
          addressLine: true,
          barangay: true,
        },
      },
      profilingRegistrations: {
        where: { program: "KK" },
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { registeredSKVoter: true },
      },
      grantee: {
        select: {
          yearLevel: true,
          school: true,
          status: true,
          dateRemoved: true,
          revocationReason: true,
          isPermanentlyDisqualified: true,
        },
      },
    },
  },
  application: {
    select: {
      status: true,
      withdrawnAt: true,
      withdrawalReason: true,
      school: true,
      educationLevel: true,
      currentCourse: true,
      yearLevel: true,
      gwa: true,
      grades: true,
      applicantName: true,
      permanentAddress: true,
      dateOfBirth: true,
      placeOfBirth: true,
      age: true,
      civilStatus: true,
      gender: true,
      fathersName: true,
      fathersOccupation: true,
      fathersContact: true,
      mothersMaidenName: true,
      mothersOccupation: true,
      mothersContact: true,
      contactNumber: true,
      emailAddress: true,
      totalFamilyMonthlyIncome: true,
      photoFileUrl: true,
      physicalDocumentsConfirmed: true,
      uploadedFiles: true,
    },
  },
} satisfies Prisma.InquirySelect;

export function normalizeSkeapGrades(
  value: unknown,
): Array<{ subject?: string; grade?: string | number }> | undefined {
  if (!Array.isArray(value)) return undefined;
  const grades = value.flatMap((entry) => {
    if (typeof entry !== "object" || entry === null || !("grade" in entry)) return [];
    const grade = entry.grade;
    if (typeof grade !== "string" && typeof grade !== "number") return [];
    return [{
      ...("subject" in entry && typeof entry.subject === "string" ? { subject: entry.subject } : {}),
      grade,
    }];
  });
  return grades.length ? grades : undefined;
}

export function skeapStatusWhere(patterns: readonly string[]): Prisma.InquiryWhereInput {
  return {
    OR: patterns.map((pattern) => ({
      reviewStatus: { contains: pattern, mode: Prisma.QueryMode.insensitive },
    })),
  };
}

export async function getWaitlistQueuePosition(
  applicationId: string,
  programIdOrCycle?: string,
  client: WaitlistPositionClient = prisma,
): Promise<{ position: number; totalWaitlisted: number } | null> {
  const cycle = getSkeapWaitlistCycle(programIdOrCycle);
  const range = getAcademicYearDateRange(cycle);
  if (!range) throw new Error(`Invalid SKEAP waitlist cycle: ${cycle}`);

  const [applications, cycleState] = await Promise.all([
    client.skeapApplication.findMany({
      where: {
        status: "WAITLISTED",
        submittedAt: { gte: range.start, lt: range.end },
      },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: { id: true, waitlistFinalPosition: true },
    }),
    getSkeapWaitlistCycleState(cycle, client),
  ]);
  const index = applications.findIndex((application) => application.id === applicationId);
  if (index < 0) return null;

  return {
    position: applications[index].waitlistFinalPosition ?? index + 1,
    totalWaitlisted: cycleState.isClosed ? cycleState.totalWaitlisted : applications.length,
  };
}

type AgedOutWaitlistApplicant = {
  applicationId: string;
  userId: string;
  applicantName: string;
  email: string;
  emailNotifications: boolean;
  currentAge: number;
};

export async function sweepAgedOutWaitlistApplicants(actorId: string) {
  const maxEligibleAge = await getSkeapMaxEligibleAge();
  const today = new Date();
  const waitlisted = await prisma.skeapApplication.findMany({
    where: { status: SubmissionStatus.WAITLISTED },
    select: {
      id: true,
      userId: true,
      applicantName: true,
      submittedAt: true,
      dateOfBirth: true,
      inquiry: { select: { id: true } },
      user: {
        select: {
          fullName: true,
          email: true,
          emailNotifications: true,
          kkProfile: { select: { birthDate: true } },
        },
      },
    },
  });
  const agedOutCandidates = waitlisted.flatMap((application) => {
    const currentAge = getExactAge(
      application.user.kkProfile?.birthDate ?? application.dateOfBirth,
      today,
    );
    if (currentAge === null || currentAge <= maxEligibleAge) return [];
    return [{
      applicationId: application.id,
      userId: application.userId,
      applicantName: application.applicantName || application.user.fullName || application.user.email,
      email: application.user.email,
      emailNotifications: application.user.emailNotifications,
      currentAge,
      inquiryId: application.inquiry?.id ?? null,
      submittedAt: application.submittedAt,
    }];
  });
  if (agedOutCandidates.length === 0) {
    return { removedCount: 0, removedApplicants: [] as AgedOutWaitlistApplicant[] };
  }

  const removedApplicants = await prisma.$transaction(async (tx) => {
    const removed: AgedOutWaitlistApplicant[] = [];
    const cycles = new Set<string>();

    for (const candidate of agedOutCandidates) {
      const message =
        `Thank you for applying to the Sangguniang Kabataan Educational Assistance Program (SKEAP). Because you have now reached ${candidate.currentAge} years old and exceeded the maximum eligible age (${maxEligibleAge}), your waitlisted application has been closed.`;
      const update = await tx.skeapApplication.updateMany({
        where: { id: candidate.applicationId, status: SubmissionStatus.WAITLISTED },
        data: {
          status: SubmissionStatus.REJECTED,
          waitlistPosition: null,
          waitlistFinalPosition: null,
          waitlistRemark: "AGED_OUT",
        },
      });
      if (update.count !== 1) continue;

      if (candidate.inquiryId) {
        await tx.inquiry.update({
          where: { id: candidate.inquiryId },
          data: {
            reviewStatus: "Closed",
            response: message,
            respondedAt: today,
            isResolved: true,
            lastUpdatedBy: actorId,
          },
        });
      }

      const granteeMessage = await tx.granteeMessage.create({
        data: {
          userId: candidate.userId,
          senderId: actorId,
          subject: "SKEAP Waitlist Update — Age Eligibility Reached",
          body: message,
        },
        select: { id: true },
      });
      await tx.notification.upsert({
        where: {
          userId_sourceKey: {
            userId: candidate.userId,
            sourceKey: `skeap-age-out:${candidate.applicationId}`,
          },
        },
        create: {
          userId: candidate.userId,
          sourceKey: `skeap-age-out:${candidate.applicationId}`,
          message: `SKEAP Waitlist Update — Age Eligibility Reached\n\n${message}`,
        },
        update: {
          message: `SKEAP Waitlist Update — Age Eligibility Reached\n\n${message}`,
        },
      });
      await writeAuditLog(tx, {
        action: "SKEAP_WAITLIST_AGE_OUT",
        actorId,
        targetTable: "skeap_applications",
        targetId: candidate.applicationId,
        beforeData: { status: SubmissionStatus.WAITLISTED },
        afterData: { status: SubmissionStatus.REJECTED, waitlistRemark: "AGED_OUT" },
        metadata: {
          currentAge: candidate.currentAge,
          maxEligibleAge,
          notificationId: granteeMessage.id,
        },
      });

      removed.push({
        applicationId: candidate.applicationId,
        userId: candidate.userId,
        applicantName: candidate.applicantName,
        email: candidate.email,
        emailNotifications: candidate.emailNotifications,
        currentAge: candidate.currentAge,
      });
      cycles.add(getCurrentAcademicYear(candidate.submittedAt));
    }

    for (const cycle of cycles) {
      await reindexSkeapWaitlist(tx, cycle);
    }
    return removed;
  });

  if (removedApplicants.length === 0) {
    return { removedCount: 0, removedApplicants };
  }

  await refreshSkeapApplicationsAdminView();

  if (
    process.env.GMAIL_USER &&
    process.env.GMAIL_APP_PASSWORD &&
    removedApplicants.some((applicant) => applicant.emailNotifications && applicant.email)
  ) {
    try {
      const transporter = createGmailTransporter();
      const emailApplicants = removedApplicants.filter(
        (applicant) => applicant.emailNotifications && applicant.email,
      );
      const emailResults = await Promise.allSettled(
        emailApplicants.map((applicant) =>
            sendBroadcastEmail(
              transporter,
              applicant.userId,
              applicant.email,
              "SKEAP Waitlist Update — Age Eligibility Reached",
              `Thank you for applying to the Sangguniang Kabataan Educational Assistance Program (SKEAP). Because you have now reached ${applicant.currentAge} years old and exceeded the maximum eligible age (${maxEligibleAge}), your waitlisted application has been closed.`,
            ),
          ),
      );
      emailResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error("Could not send SKEAP age-out email.", {
              applicationId: emailApplicants[index]?.applicationId,
            error: result.reason,
          });
        }
      });
    } catch (error) {
      console.error("Could not initialize SKEAP age-out email delivery.", error);
    }
  }

  return { removedCount: removedApplicants.length, removedApplicants };
}

export async function sweepClosedSkeapWaitlistCycles(actorId: string) {
  const activeCycle = getSkeapWaitlistCycle();
  const activeRange = getAcademicYearDateRange(activeCycle);
  if (!activeRange) throw new Error("Unable to determine the active SKEAP waitlist cycle.");

  const waitlisted = await prisma.skeapApplication.findMany({
    where: { status: SubmissionStatus.WAITLISTED },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    select: {
      id: true,
      userId: true,
      applicantName: true,
      submittedAt: true,
      waitlistPosition: true,
      waitlistFinalPosition: true,
      inquiry: { select: { id: true } },
      user: {
        select: {
          fullName: true,
          email: true,
          emailNotifications: true,
        },
      },
    },
  });
  if (waitlisted.length === 0) return { closedCount: 0 };

  const cycleStates = new Map<string, boolean>();
  const cycles = new Set(waitlisted.map((application) => getCurrentAcademicYear(application.submittedAt)));
  for (const cycle of cycles) {
    const range = getAcademicYearDateRange(cycle);
    if (!range) throw new Error(`Invalid SKEAP waitlist cycle: ${cycle}`);
    const isPastCycle = range.start < activeRange.start;
    const state = isPastCycle ? null : await getSkeapWaitlistCycleState(cycle);
    cycleStates.set(cycle, isPastCycle || state?.isClosed === true);
  }

  const closedCandidates = waitlisted.filter((application) =>
    cycleStates.get(getCurrentAcademicYear(application.submittedAt)) === true,
  );
  if (closedCandidates.length === 0) return { closedCount: 0 };

  const cycleCounts = new Map<string, number>();
  const closedApplicants = await prisma.$transaction(async (tx) => {
    const closed: Array<{
      applicationId: string;
      userId: string;
      email: string;
      emailNotifications: boolean;
      applicantName: string;
      cycle: string;
      position: number;
    }> = [];
    const affectedCycles = new Set<string>();

    for (const application of closedCandidates) {
      const cycle = getCurrentAcademicYear(application.submittedAt);
      const nextPosition = (cycleCounts.get(cycle) ?? 0) + 1;
      const position =
        application.waitlistFinalPosition ??
        application.waitlistPosition ??
        nextPosition;
      cycleCounts.set(cycle, Math.max(nextPosition, position));
      const message =
        `The ${cycle} SKEAP cycle has closed. Your waitlisted application is now closed and will not carry over to another cycle. Your final queue position was #${position}.`;
      const update = await tx.skeapApplication.updateMany({
        where: { id: application.id, status: SubmissionStatus.WAITLISTED },
        data: {
          status: SubmissionStatus.REJECTED,
          waitlistPosition: null,
          waitlistFinalPosition: position,
          waitlistRemark: "CYCLE_CLOSED",
        },
      });
      if (update.count !== 1) continue;

      if (application.inquiry) {
        await tx.inquiry.update({
          where: { id: application.inquiry.id },
          data: {
            reviewStatus: "Closed",
            response: message,
            respondedAt: new Date(),
            isResolved: true,
            lastUpdatedBy: actorId,
          },
        });
      }

      const granteeMessage = await tx.granteeMessage.create({
        data: {
          userId: application.userId,
          senderId: actorId,
          subject: "SKEAP Waitlist Update — Cycle Closed",
          body: message,
        },
        select: { id: true },
      });
      await tx.notification.upsert({
        where: {
          userId_sourceKey: {
            userId: application.userId,
            sourceKey: `skeap-cycle-closed:${application.id}`,
          },
        },
        create: {
          userId: application.userId,
          sourceKey: `skeap-cycle-closed:${application.id}`,
          message: `SKEAP Waitlist Update — Cycle Closed\n\n${message}`,
        },
        update: {
          message: `SKEAP Waitlist Update — Cycle Closed\n\n${message}`,
        },
      });
      await writeAuditLog(tx, {
        action: "SKEAP_WAITLIST_CYCLE_FINALIZED",
        actorId,
        targetTable: "skeap_applications",
        targetId: application.id,
        beforeData: { status: SubmissionStatus.WAITLISTED },
        afterData: { status: SubmissionStatus.REJECTED, waitlistRemark: "CYCLE_CLOSED" },
        metadata: { cycle, finalPosition: position, notificationId: granteeMessage.id },
      });

      affectedCycles.add(cycle);
      closed.push({
        applicationId: application.id,
        userId: application.userId,
        email: application.user.email,
        emailNotifications: application.user.emailNotifications,
        applicantName: application.applicantName || application.user.fullName || application.user.email,
        cycle,
        position,
      });
    }

    for (const cycle of affectedCycles) {
      await reindexSkeapWaitlist(tx, cycle);
    }
    return closed;
  });

  if (closedApplicants.length === 0) return { closedCount: 0 };
  await refreshSkeapApplicationsAdminView();

  const emailApplicants = closedApplicants.filter(
    (applicant) => applicant.emailNotifications && applicant.email,
  );
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD && emailApplicants.length > 0) {
    try {
      const transporter = createGmailTransporter();
      const emailResults = await Promise.allSettled(
        emailApplicants.map((applicant) =>
          sendBroadcastEmail(
            transporter,
            applicant.userId,
            applicant.email,
            "SKEAP Waitlist Update — Cycle Closed",
            `The ${applicant.cycle} SKEAP cycle has closed. Your waitlisted application is now closed and will not carry over to another cycle. Your final queue position was #${applicant.position}.`,
          ),
        ),
      );
      emailResults.forEach((result, index) => {
        if (result.status === "rejected") {
          console.error("Could not send SKEAP cycle-closure email.", {
            applicationId: emailApplicants[index]?.applicationId,
            error: result.reason,
          });
        }
      });
    } catch (error) {
      console.error("Could not initialize SKEAP cycle-closure email delivery.", error);
    }
  }

  return { closedCount: closedApplicants.length };
}

export function skeapPendingApplicationsWhere(academicYearRange: { start: Date; end: Date }): Prisma.InquiryWhereInput {
  return {
    ...skeapApplicationInquiryWhere,
    NOT: [
      { reviewStatus: { contains: "cancel", mode: Prisma.QueryMode.insensitive } },
      { reviewStatus: { contains: "approve", mode: Prisma.QueryMode.insensitive } },
    ],
    AND: [
      { createdAt: { gte: academicYearRange.start, lt: academicYearRange.end } },
      skeapStatusWhere(["pending", "pre_qualified"]),
    ],
  };
}

type SkeapInquiry = Prisma.InquiryGetPayload<{ select: typeof SKEAP_APPLICATION_SELECT }>;
type WaitlistPositionClient = Pick<Prisma.TransactionClient, "skeapApplication" | "systemSetting">;

function isImageUrl(url: string) {
  return IMAGE_REGEX.test(url);
}

function getFileType(url: string) {
  if (isImageUrl(url)) return "Image";
  if (PDF_REGEX.test(url)) return "PDF";
  if (DOC_REGEX.test(url)) return "Document";
  return "Document";
}

function normalizeDocumentLabel(raw: string) {
  const label = raw.trim();
  const keyword = label.toLowerCase();

  if (keyword.includes("barangay")) return "Barangay Clearance";
  if (keyword.includes("skeap") && keyword.includes("form")) return "SKEAP Form";
  if (keyword.includes("enroll")) return "Certificate of Enrollment";
  if (keyword.includes("grade") || keyword.includes("report") || keyword.includes("transcript")) return "Grade Report";
  if (keyword.includes("voter")) return "Voter's Certificate";
  if (keyword.includes("id") && keyword.includes("photo")) return "ID Photo";
  if (keyword.includes("passport")) return "Passport";
  if (keyword.includes("proof") && keyword.includes("address")) return "Proof of Address";
  if (keyword.includes("recommendation")) return "Recommendation Letter";

  const stripped = label.replace(/^[0-9]{8,}\s*[-_ ]?/, "").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return stripped || "Document";
}

function getFileLabel(url: string, index: number) {
  try {
    const filename = url.split("/").pop() || "";
    const decoded = decodeURIComponent(filename);
    const cleaned = decoded.replace(/\+/g, " ").replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
    return normalizeDocumentLabel(cleaned || `Document ${index + 1}`);
  } catch {
    return `Document ${index + 1}`;
  }
}

function normalizeUrlForDedupe(url: string) {
  const candidate = String(url || "").trim().replace(/[\)\]\}",]+$/, "");
  try {
    const parsed = new URL(candidate);
    parsed.search = "";
    parsed.hash = "";
    if (parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    }
    return parsed.toString();
  } catch {
    return candidate.replace(/\s+$/, "").replace(/\/+$/, "");
  }
}

function extractUrls(input: string) {
  const pattern = /https?:\/\/[^\s"'<>]+/g;
  return Array.from(input.match(pattern) || []);
}

function getUniqueUrls(input: string) {
  const urls = extractUrls(input);
  const map = new Map<string, string>();
  urls.forEach((url) => {
    const normalized = normalizeUrlForDedupe(url);
    if (normalized && !map.has(normalized)) {
      map.set(normalized, url.trim());
    }
  });
  return Array.from(map.values());
}

function isValidReviewThreadItem(item: unknown): item is ApplicationMessage {
  if (typeof item !== "object" || item === null) return false;
  const candidate = item as Record<string, unknown>;
  return (
    (candidate.role === "admin" || candidate.role === "applicant") &&
    typeof candidate.createdAt === "string" &&
    typeof candidate.text === "string" &&
    (candidate.action === undefined || candidate.action === "return")
  );
}

export function mapInquiryToApplication(
  inquiry: SkeapInquiry,
  permanentRecords: readonly PermanentSkeapRevocationRecord[] = [],
) {
  const profileName = [
    inquiry.user?.kkProfile?.firstName,
    inquiry.user?.kkProfile?.middleName,
    inquiry.user?.kkProfile?.lastName,
  ].filter((part) => typeof part === "string" && part.trim()).join(" ");
  const applicantName =
    profileName ||
    inquiry.user?.fullName ||
    inquiry.application?.applicantName ||
    inquiry.user?.email ||
    "Unknown applicant";
  const banWatchlistMatch = findBanWatchlistMatch(permanentRecords, {
    userId: inquiry.user.id,
    kkProfileId: inquiry.user.kkProfileId,
    firstName: inquiry.user.kkProfile?.firstName,
    middleName: inquiry.user.kkProfile?.middleName,
    lastName: inquiry.user.kkProfile?.lastName,
    dateOfBirth: inquiry.user.kkProfile?.birthDate ?? inquiry.application?.dateOfBirth,
    applicantName: inquiry.application?.applicantName ?? applicantName,
  });
  const urls = getUniqueUrls(inquiry.message || "");
  const persistedMessages = (Array.isArray(inquiry.reviewThread)
    ? inquiry.reviewThread.filter(isValidReviewThreadItem)
    : []) as unknown as ApplicationMessage[];
  const persistedAttachments = persistedMessages.flatMap((message) => message.attachments ?? []);

  const documents = urls.map((url, index) => {
    const docId = `${inquiry.id}-doc-${index}`;
    const matchedAttachment = persistedAttachments.find(
      (attachment) =>
        attachment.fileId === docId ||
        attachment.fileUrl === url ||
        attachment.fileName === getFileLabel(url, index)
    );

    return {
      id: docId,
      label: getFileLabel(url, index),
      type: getFileType(url),
      previewUrl: url,
      verified: false,
      comment: matchedAttachment?.adminRemark ?? "",
      status: matchedAttachment ? "Returned" : "Pending",
      isImage: isImageUrl(url),
    };
  });

  const latestReplacements = getLatestSkeapResubmissionReplacements(persistedMessages);
  const fallbackReplacements = getUnpersistedSkeapResubmissionReplacements(
    inquiry.application?.uploadedFiles,
    latestReplacements
  );
  const effectiveUploadedFiles = fallbackReplacements.length
    ? mergeSkeapResubmittedFiles(inquiry.application?.uploadedFiles, fallbackReplacements)
    : inquiry.application?.uploadedFiles;
  const uploadGroups = getUploadGroups(effectiveUploadedFiles);
  const responseText = inquiry.response?.trim();
  const status = (() => {
    const resubmittedMatcher = /resubm|resubmit|resubmitted/i;
    const returnedMatcher = /returned|correction|required|revise|revision/i;

    if (inquiry.reviewStatus) {
      if (/pre.?qual/i.test(inquiry.reviewStatus)) return "Pre-qualified";
      if (resubmittedMatcher.test(inquiry.reviewStatus)) return "Resubmitted";
      if (returnedMatcher.test(inquiry.reviewStatus)) return "Returned";
      if (/approve|approved/i.test(inquiry.reviewStatus)) return "Approved";
      if (/rejected/i.test(inquiry.reviewStatus)) return "Rejected";
      if (/ineligible/i.test(inquiry.reviewStatus)) return "Ineligible";
      return inquiry.reviewStatus;
    }
    if (responseText) {
      if (resubmittedMatcher.test(responseText)) return "Resubmitted";
      if (returnedMatcher.test(responseText)) return "Returned";
      if (/approve|approved/i.test(responseText)) return "Approved";
      if (/rejected/i.test(responseText)) return "Rejected";
      if (/ineligible/i.test(responseText)) return "Ineligible";
      return inquiry.isResolved ? "Responded" : "Pending Review";
    }
    return inquiry.isResolved ? "Responded" : "Pending Review";
  })();

  if (
    responseText &&
    !persistedMessages.some((message) => message.role === "admin" && message.text === responseText)
  ) {
    persistedMessages.push({
      id: `${inquiry.id}-admin`,
      role: "admin",
      createdAt: (inquiry.respondedAt || inquiry.createdAt).toISOString(),
      text: responseText,
    });
  }

  const messages: ApplicationMessage[] = [
    {
      id: `${inquiry.id}-applicant`,
      role: "applicant",
      createdAt: inquiry.createdAt.toISOString(),
      text: inquiry.message,
    },
    ...persistedMessages,
  ];

  return {
    id: inquiry.id,
    applicantName,
    applicantEmail: inquiry.user?.email || inquiry.application?.emailAddress || "",
    applicantPhoneNumber: inquiry.user?.phoneNumber || inquiry.application?.contactNumber || "",
    yearLevel: inquiry.user?.grantee?.yearLevel || inquiry.application?.yearLevel || "",
    school: normalizeSkeapSchoolName(
      inquiry.user?.grantee?.school || inquiry.application?.school || inquiry.application?.currentCourse || ""
    ),
    submittedAt: inquiry.createdAt.toISOString(),
    status,
    banWatchlistMatch: banWatchlistMatch ?? undefined,
    priorRevocation: inquiry.user?.grantee?.status === "REVOKED"
      ? {
          revokedAt: inquiry.user.grantee.dateRemoved?.toISOString() ?? null,
          reason: inquiry.user.grantee.revocationReason,
        }
      : undefined,
    documents,
    uploadGroups,
    application: inquiry.application
      ? {
          educationLevel: inquiry.application.educationLevel ?? undefined,
          currentCourse: inquiry.application.currentCourse,
          yearLevel: inquiry.application.yearLevel,
          gwa: inquiry.application.gwa,
          grades: normalizeSkeapGrades(inquiry.application.grades),
          applicantName,
          permanentAddress: formatSkeapPermanentAddress({
            sitio: inquiry.user?.kkProfile?.purok,
            barangay: inquiry.user?.kkProfile?.barangay,
            addressLine: inquiry.user?.kkProfile?.addressLine,
          }, inquiry.application.permanentAddress),
          registeredSKVoter: inquiry.user?.profilingRegistrations[0]?.registeredSKVoter || undefined,
          totalFamilyMonthlyIncome: inquiry.application.totalFamilyMonthlyIncome || undefined,
          dateOfBirth: inquiry.application.dateOfBirth ? inquiry.application.dateOfBirth.toISOString() : undefined,
          placeOfBirth: inquiry.application.placeOfBirth || undefined,
          age: inquiry.application.age ?? undefined,
          civilStatus: inquiry.application.civilStatus || undefined,
          gender: inquiry.application.gender || undefined,
          fathersName: inquiry.application.fathersName || undefined,
          fathersOccupation: inquiry.application.fathersOccupation || undefined,
          fathersContact: inquiry.application.fathersContact || undefined,
          mothersMaidenName: inquiry.application.mothersMaidenName || undefined,
          mothersOccupation: inquiry.application.mothersOccupation || undefined,
          mothersContact: inquiry.application.mothersContact || undefined,
          contactNumber: inquiry.user?.phoneNumber || inquiry.application.contactNumber || undefined,
          emailAddress: inquiry.user?.email || inquiry.application.emailAddress || undefined,
          photoFileUrl: inquiry.application.photoFileUrl || undefined,
          physicalDocumentsConfirmed: inquiry.application.physicalDocumentsConfirmed,
          uploadedFiles: inquiry.application.uploadedFiles ?? undefined,
        }
      : undefined,
    messages,
  };
}
