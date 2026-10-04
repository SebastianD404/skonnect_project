import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";
import { getUploadGroups } from "@/lib/skeap-upload";
import { SKEAP_APPLICATION_SELECT } from "@/lib/skeap-applications";
import { getAcademicYearDateRange, getAcademicYears, getCurrentAcademicYear } from "@/lib/semester";
import SkeapApplicationsClient from "./SkeapApplicationsClient";

interface ApplicationMessage {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
  attachments?: {
    fileId: string;
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
    grantee: {
      yearLevel: string | null;
      school: string | null;
    } | null;
  };
  application?: {
    school?: string | null;
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
    photoFileUrl?: string | null;
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
    school: inquiry.user?.grantee?.school || inquiry.application?.school || inquiry.application?.currentCourse || "",
    submittedAt: inquiry.createdAt.toISOString(),
    status,
    documents,
    uploadGroups,
    application: inquiry.application
      ? {
          currentCourse: inquiry.application.currentCourse,
          yearLevel: inquiry.application.yearLevel,
          gwa: inquiry.application.gwa,
          applicantName: inquiry.application.applicantName || inquiry.user?.fullName || undefined,
          permanentAddress: inquiry.application.permanentAddress || undefined,
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
          contactNumber: inquiry.application.contactNumber || undefined,
          emailAddress: inquiry.application.emailAddress || inquiry.user.email || undefined,
          photoFileUrl: inquiry.application.photoFileUrl || undefined,
          uploadedFiles: inquiry.application.uploadedFiles ?? undefined,
        }
      : undefined,
    messages,
  };
}

export const dynamic = "force-dynamic";

export default async function SkeapApplicationsPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const now = new Date();
  const initialAcademicYear = getCurrentAcademicYear(now);
  const academicYearRange = getAcademicYearDateRange(initialAcademicYear);
  if (!academicYearRange) throw new Error("Unable to determine the current academic year.");

  // Shared base filter pieces (subject match + exclude cancelled/approved-like responses)
  const subjectWhere = { subject: { contains: "SKEAP application", mode: Prisma.QueryMode.insensitive } };
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

  const statusFields = ["reviewStatus", "response"] as const;

  function statusOrWhere(patterns: string[], fields: ReadonlyArray<"reviewStatus" | "response"> = ["reviewStatus"]) {
    const or: Array<Prisma.InquiryWhereInput> = patterns.flatMap((p) =>
      fields.map((field) => ({
        [field]: { contains: p, mode: Prisma.QueryMode.insensitive },
      } as Prisma.InquiryWhereInput))
    );
    return { OR: or };
  }

  const queueBaseWhere = {
    ...baseWhere,
    NOT: [excludeCancelled, excludeApproved],
  };

  const pendingCount = await prisma.inquiry.count({
    where: {
      ...queueBaseWhere,
      AND: [
        { createdAt: { gte: academicYearRange.start, lt: academicYearRange.end } },
        statusOrWhere(["pending"], statusFields),
      ],
    },
  });
  const returnedCount = await prisma.inquiry.count({
    where: {
      ...queueBaseWhere,
      AND: [
        { createdAt: { gte: academicYearRange.start, lt: academicYearRange.end } },
        statusOrWhere(["returned", "return", "correction", "revise", "revision"], statusFields),
      ],
    },
  });
  const resubmittedCount = await prisma.inquiry.count({
    where: {
      ...queueBaseWhere,
      AND: [
        { createdAt: { gte: academicYearRange.start, lt: academicYearRange.end } },
        statusOrWhere(["resubm", "resubmit", "resubmitted"], statusFields),
      ],
    },
  });
  const approvedCount = await prisma.inquiry.count({
    where: {
      ...baseWhere,
      AND: [statusOrWhere(["approve", "approved"], statusFields)],
    },
  });

  // Fetch rows for queue using the same base filter but matching any visible statuses
  const visibleStatusPatterns = ["pending", "return", "resubm", "respond", "approve"];
  const inquiries = await prisma.inquiry.findMany({
    where: {
      ...baseWhere,
      AND: [
        { createdAt: { gte: academicYearRange.start, lt: academicYearRange.end } },
        statusOrWhere(visibleStatusPatterns, statusFields),
      ],
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 16,
    select: SKEAP_APPLICATION_SELECT,
  });

  const applications = inquiries.slice(0, 15).map(mapInquiryToApplication);
  const hasNextPage = inquiries.length > 15;
  const lastApplication = applications[applications.length - 1];

  return (
    <SkeapApplicationsClient
      applications={applications}
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
        returned: returnedCount,
        resubmitted: resubmittedCount,
        approved: approvedCount,
      }}
    />
  );
}
