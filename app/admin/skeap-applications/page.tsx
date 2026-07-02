import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { Prisma, Role } from "@prisma/client";
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
const PDF_REGEX = /\.pdf(\?|$)/i;
const DOC_REGEX = /\.(docx?|xlsx?|pptx?|txt|rtf)(\?|$)/i;

function isImageUrl(url: string) {
  return IMAGE_REGEX.test(url);
}

function isPdfUrl(url: string) {
  return PDF_REGEX.test(url);
}

function isOfficeUrl(url: string) {
  return /\.(docx?|xlsx?|pptx?)(\?|$)/i.test(url);
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

function extractUrls(input: string) {
  const pattern = /https?:\/\/[^\s"'<>]+/g;
  return Array.from(input.match(pattern) || []);
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
    grantee: {
      yearLevel: string | null;
      school: string | null;
    } | null;
  };
}) {
  const urls = extractUrls(inquiry.message || "");

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
    applicantName: inquiry.user?.fullName || inquiry.user?.email || "Unknown applicant",
    applicantEmail: inquiry.user?.email,
    yearLevel: inquiry.user?.grantee?.yearLevel || "",
    school: inquiry.user?.grantee?.school || "",
    submittedAt: inquiry.createdAt.toISOString(),
    status,
    documents,
    messages,
  };
}

export const dynamic = "force-dynamic";

export default async function SkeapApplicationsPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  // Debug: log distinct reviewStatus values and counts to help diagnose missing items
  try {
    const statusGroups = await prisma.inquiry.groupBy({
      by: ["reviewStatus"],
      _count: { _all: true },
      where: { subject: { contains: "SKEAP application", mode: "insensitive" } },
    });
    console.log("Admin: inquiry status groups:", statusGroups);
  } catch (e) {
    console.warn("Failed to groupBy reviewStatus for debug", e);
  }

  // Shared base filter pieces (subject match + exclude cancelled/approved-like responses)
  const subjectWhere = { subject: { contains: "SKEAP application", mode: Prisma.QueryMode.insensitive } };
  const excludeCancelled = { reviewStatus: { contains: "cancel", mode: Prisma.QueryMode.insensitive } };
  const excludeApproved = { reviewStatus: { contains: "approve", mode: Prisma.QueryMode.insensitive } };
  const excludeResponseCancelled = { response: { contains: "cancel", mode: Prisma.QueryMode.insensitive } };

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
      AND: [statusOrWhere(["pending", "resubm"], statusFields)],
    },
  });
  const returnedCount = await prisma.inquiry.count({
    where: {
      ...queueBaseWhere,
      AND: [statusOrWhere(["return", "correction"], statusFields)],
    },
  });
  const resubmittedCount = await prisma.inquiry.count({
    where: {
      ...queueBaseWhere,
      AND: [statusOrWhere(["resubm"], statusFields)],
    },
  });
  const approvedCount = await prisma.inquiry.count({
    where: {
      ...queueBaseWhere,
      AND: [statusOrWhere(["approve"], statusFields)],
    },
  });

  // Fetch rows for queue using the same base filter but matching any visible statuses
  const visibleStatusPatterns = ["pending", "return", "resubm", "respond"];
  const inquiries = await prisma.inquiry.findMany({
    where: {
      ...queueBaseWhere,
      AND: [statusOrWhere(visibleStatusPatterns, statusFields)],
    },
    orderBy: { createdAt: "desc" },
    select: {
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
          fullName: true,
          email: true,
          grantee: {
            select: {
              yearLevel: true,
              school: true,
            },
          },
        },
      },
    },
  });

  // Diagnostic logs to capture metric vs data gap
  console.log("DEBUG METRICS - Total Counted:", pendingCount);
  console.log("DEBUG QUEUE ARRAY - Loaded Rows Length:", inquiries.length);
  console.log(
    "DEBUG RAW DATA ROWS:",
    inquiries.map((r) => ({ id: r.id, reviewStatus: r.reviewStatus, user: { fullName: r.user?.fullName, email: r.user?.email, grantee: r.user?.grantee } }))
  );

  const applications = inquiries.map(mapInquiryToApplication);

  return (
    <SkeapApplicationsClient
      applications={applications}
      counts={{
        pending: pendingCount,
        returned: returnedCount,
        resubmitted: resubmittedCount,
        approved: approvedCount,
      }}
    />
  );
}
