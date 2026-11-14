import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Prisma, Role, SubmissionStatus } from "@prisma/client";
import { getUploadGroups } from "@/lib/skeap-upload";
import {
  skeapStatusWhere,
  SKEAP_APPLICATION_SELECT,
} from "@/lib/skeap-applications";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { formatSkeapPermanentAddress } from "@/lib/grantee-address";
import { getAcademicYearDateRange, getAcademicYears, getCurrentAcademicYear } from "@/lib/semester";
import { getSkeapCapacityCount, getSkeapMaxSlots } from "@/lib/skeap-capacity";
import { skeapApplicationInquiryWhere } from "@/lib/inquiries/filters";
import SkeapApplicationsClient from "./SkeapApplicationsClient";

interface ApplicationMessage {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
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
    typeof candidate.text === "string"
  );
}

function mapInquiryToApplication(inquiry: {
  id: string;
  message: string;
  createdAt: Date;
  response: string | null;
  respondedAt: Date | null;
  reviewStatus?: string | null;
  isResolved: boolean;
  reviewThread: Prisma.JsonValue | null;
  user: {
    fullName: string | null;
    email: string;
    phoneNumber: string | null;
    kkProfile?: {
      purok: string;
      addressLine: string;
      barangay: string;
    } | null;
    profilingRegistrations: { registeredSKVoter: string }[];
    grantee: {
      yearLevel: string | null;
      school: string | null;
    } | null;
  };
  application?: {
    school?: string | null;
    educationLevel?: string | null;
    currentCourse: string;
    yearLevel: string;
    gwa?: number | null;
    applicantName?: string | null;
    permanentAddress?: string | null;
    dateOfBirth?: Date | null;
    placeOfBirth?: string | null;
    age?: number | null;
    civilStatus?: string | null;
    gender?: string | null;
    fathersName?: string | null;
    fathersOccupation?: string | null;
    fathersContact?: string | null;
    mothersMaidenName?: string | null;
    mothersOccupation?: string | null;
    mothersContact?: string | null;
    contactNumber?: string | null;
    emailAddress?: string | null;
    totalFamilyMonthlyIncome?: string | null;
    photoFileUrl?: string | null;
    physicalDocumentsConfirmed?: boolean;
    uploadedFiles?: Prisma.JsonValue | null;
  } | null;
}) {
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

  const uploadGroups = getUploadGroups(inquiry.application?.uploadedFiles);

  const responseText = inquiry.response?.trim();
  const status = (() => {
    const resubmittedMatcher = /resubm|resubmit|resubmitted/i;
    const returnedMatcher = /returned|correction|required|revise|revision/i;

    if (inquiry.reviewStatus) {
      if (/pre.?qual/i.test(inquiry.reviewStatus)) {
        return "Pre-qualified";
      }
      if (resubmittedMatcher.test(inquiry.reviewStatus)) {
        return "Resubmitted";
      }
      if (returnedMatcher.test(inquiry.reviewStatus)) {
        return "Returned";
      }
      if (/approve|approved/i.test(inquiry.reviewStatus)) {
        return "Approved";
      }
      if (/rejected/i.test(inquiry.reviewStatus)) {
        return "Rejected";
      }
      if (/ineligible/i.test(inquiry.reviewStatus)) {
        return "Ineligible";
      }
      return inquiry.reviewStatus;
    }
    if (responseText) {
      if (resubmittedMatcher.test(responseText)) {
        return "Resubmitted";
      }
      if (returnedMatcher.test(responseText)) {
        return "Returned";
      }
      if (/approve|approved/i.test(responseText)) {
        return "Approved";
      }
      if (/rejected/i.test(responseText)) {
        return "Rejected";
      }
      if (/ineligible/i.test(responseText)) {
        return "Ineligible";
      }
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
      role: "admin" as const,
      createdAt: (inquiry.respondedAt || inquiry.createdAt).toISOString(),
      text: responseText,
    });
  }

  const messages: ApplicationMessage[] = [
    {
      id: `${inquiry.id}-applicant`,
      role: "applicant" as const,
      createdAt: inquiry.createdAt.toISOString(),
      text: inquiry.message,
    },
    ...persistedMessages,
  ];

  return {
    id: inquiry.id,
    applicantName: inquiry.user?.fullName || inquiry.application?.applicantName || inquiry.user?.email || "Unknown applicant",
    applicantEmail: inquiry.user?.email || inquiry.application?.emailAddress || "",
    applicantPhoneNumber: inquiry.user?.phoneNumber || inquiry.application?.contactNumber || "",
    yearLevel: inquiry.user?.grantee?.yearLevel || inquiry.application?.yearLevel || "",
    school: normalizeSkeapSchoolName(
      inquiry.user?.grantee?.school || inquiry.application?.school || inquiry.application?.currentCourse || ""
    ),
    submittedAt: inquiry.createdAt.toISOString(),
    status,
    documents,
    uploadGroups,
    application: inquiry.application
      ? {
          educationLevel: inquiry.application.educationLevel || undefined,
          currentCourse: inquiry.application.currentCourse,
          yearLevel: inquiry.application.yearLevel,
          gwa: inquiry.application.gwa,
          applicantName: inquiry.user?.fullName || inquiry.application.applicantName || undefined,
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

export const dynamic = "force-dynamic";

export default async function SkeapApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string | string[] }>;
}) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolvedSearchParams = await searchParams;
  const rawFocus = Array.isArray(resolvedSearchParams.focus)
    ? resolvedSearchParams.focus[0]
    : resolvedSearchParams.focus;
  const focusId = typeof rawFocus === "string" ? rawFocus : "";
  const now = new Date();
  const initialAcademicYear = getCurrentAcademicYear(now);
  const academicYearRange = getAcademicYearDateRange(initialAcademicYear);
  if (!academicYearRange) throw new Error("Unable to determine the current academic year.");

  // Shared base filter pieces (subject match + exclude cancelled/approved-like responses)
  const subjectWhere: Prisma.InquiryWhereInput = skeapApplicationInquiryWhere;
  const oldestInquiry = await prisma.inquiry.findFirst({
    where: subjectWhere,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { createdAt: true },
  });
  const academicYears = getAcademicYears(oldestInquiry?.createdAt ?? null, now);
  const excludeCancelled = { reviewStatus: { contains: "cancel", mode: Prisma.QueryMode.insensitive } };
  const excludeApproved = { reviewStatus: { contains: "approve", mode: Prisma.QueryMode.insensitive } };

  const baseWhere = {
    ...subjectWhere,
    NOT: [excludeCancelled],
  };

  const queueBaseWhere = {
    ...baseWhere,
    NOT: [excludeCancelled, excludeApproved],
  };

  const academicYearWhere = {
    createdAt: { gte: academicYearRange.start, lt: academicYearRange.end },
  };
  const [
    pendingCount,
    physicalCtcCount,
    resubmittedCount,
    approvedCount,
    activeGranteeCount,
    maxSlots,
  ] = await Promise.all([
    prisma.inquiry.count({
      where: {
        ...queueBaseWhere,
        AND: [academicYearWhere, skeapStatusWhere(["pending"])],
      },
    }),
    prisma.inquiry.count({
      where: {
        ...queueBaseWhere,
        AND: [academicYearWhere, skeapStatusWhere(["pre_qualified"])],
      },
    }),
    prisma.inquiry.count({
      where: {
        ...queueBaseWhere,
        AND: [academicYearWhere, skeapStatusWhere(["resubm", "resubmit", "resubmitted"])],
      },
    }),
    prisma.inquiry.count({
      where: {
        ...baseWhere,
        AND: [academicYearWhere, skeapStatusWhere(["approve", "approved"])],
      },
    }),
    getSkeapCapacityCount(),
    getSkeapMaxSlots(),
  ]);

  // Fetch rows for queue using the same base filter but matching any visible statuses
  const visibleStatusPatterns = ["pending", "pre_qualified", "resubm", "respond", "approve"];
  const [inquiries, focusedInquiry] = await Promise.all([
    prisma.inquiry.findMany({
      where: {
        ...baseWhere,
        AND: [
          { createdAt: { gte: academicYearRange.start, lt: academicYearRange.end } },
          skeapStatusWhere(visibleStatusPatterns),
        ],
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 16,
      select: SKEAP_APPLICATION_SELECT,
    }),
    focusId
      ? prisma.inquiry.findFirst({
          where: {
            id: focusId,
            ...queueBaseWhere,
            application: {
              is: {
                status: { in: [SubmissionStatus.PENDING, SubmissionStatus.PRE_QUALIFIED] },
              },
            },
            AND: [skeapStatusWhere(["pending", "pre_qualified"])],
          },
          select: SKEAP_APPLICATION_SELECT,
        })
      : Promise.resolve(null),
  ]);

  const queueApplications = inquiries.slice(0, 15).map(mapInquiryToApplication);
  const focusedApplication = focusedInquiry ? mapInquiryToApplication(focusedInquiry) : null;
  const applications = focusedApplication
    ? [
        focusedApplication,
        ...queueApplications
          .filter((application) => application.id !== focusedApplication.id)
      ]
    : queueApplications;
  const hasNextPage = inquiries.length > 15;
  const lastApplication = queueApplications[queueApplications.length - 1];

  return (
    <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-6 sm:gap-8">
      <SkeapApplicationsClient
        applications={applications}
        initialSelectedApplicationId={focusedApplication?.id}
        hasNextPage={hasNextPage}
        initialAcademicYear={initialAcademicYear}
        academicYears={academicYears}
        initialCursor={
          hasNextPage && lastApplication
            ? { id: lastApplication.id, createdAt: lastApplication.submittedAt }
            : null
        }
        counts={{
          pending: pendingCount,
          physicalCtc: physicalCtcCount,
          resubmitted: resubmittedCount,
          approved: approvedCount,
        }}
        initialCapacityFull={activeGranteeCount >= maxSlots}
      />
    </div>
  );
}
