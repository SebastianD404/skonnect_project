import { Prisma } from "@prisma/client";
import { getUploadGroups } from "@/lib/skeap-upload";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { formatSkeapPermanentAddress } from "@/lib/grantee-address";

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
      fullName: true,
      email: true,
      phoneNumber: true,
      kkProfile: {
        select: {
          purok: true,
          addressLine: true,
          barangay: true,
        },
      },
      grantee: {
        select: {
          yearLevel: true,
          school: true,
        },
      },
    },
  },
  application: {
    select: {
      school: true,
      currentCourse: true,
      yearLevel: true,
      gwa: true,
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
      photoFileUrl: true,
      uploadedFiles: true,
    },
  },
} satisfies Prisma.InquirySelect;

type SkeapInquiry = Prisma.InquiryGetPayload<{ select: typeof SKEAP_APPLICATION_SELECT }>;

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

export function mapInquiryToApplication(inquiry: SkeapInquiry) {
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
          currentCourse: inquiry.application.currentCourse,
          yearLevel: inquiry.application.yearLevel,
          gwa: inquiry.application.gwa,
          applicantName: inquiry.user?.fullName || inquiry.application.applicantName || undefined,
          permanentAddress: formatSkeapPermanentAddress({
            sitio: inquiry.user?.kkProfile?.purok,
            barangay: inquiry.user?.kkProfile?.barangay,
            addressLine: inquiry.user?.kkProfile?.addressLine,
          }, inquiry.application.permanentAddress),
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
          uploadedFiles: inquiry.application.uploadedFiles ?? undefined,
        }
      : undefined,
    messages,
  };
}
