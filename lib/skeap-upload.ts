import type { GradeReportDiagnostics } from "@/lib/grade-report-parser";

export const SKEAP_UPLOAD_KEY = {
  BIRTH_CERTIFICATE: "birthCertificate",
  BARANGAY_RESIDENCY: "barangayResidency",
  ENROLLMENT_CERT: "enrollmentCertificate",
  GRADE_REPORT: "gradeReport",
  FAMILY_INCOME: "incomeCertificate",
  PHOTO: "photo",
  VOTER_CERTIFICATE: "voterCertificate",
  KK_ID_FRONT: "kkIdFront",
  KK_ID_BACK: "kkIdBack",
  OTHER: "other",
} as const;

export type SkeapUploadKey = (typeof SKEAP_UPLOAD_KEY)[keyof typeof SKEAP_UPLOAD_KEY];
export type SkeapVerificationStatus = "AUTO_VERIFIED" | "PENDING_ADMIN_REVIEW";
export type SkeapOcrNameStatus =
  | "MATCHED_APPLICANT"
  | "MATCHED_PARENT"
  | "LOW_READABILITY"
  | "NAME_MISMATCH";

export type SkeapRequiredDocument = {
  key: SkeapUploadKey;
  label: string;
  helperText?: string;
};

export type SkeapUploadValue = {
  name?: string;
  url: string;
  verified?: boolean;
  manualReview?: boolean;
  verificationStatus?: SkeapVerificationStatus;
  ocrNameStatus?: SkeapOcrNameStatus;
  adminRemark?: string;
  pendingResubmission?: boolean;
  fileType?: string;
  gradeDiagnostics?: GradeReportDiagnostics | null;
  ocrStatus?: "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED";
};

export type SkeapUploadGroup = {
  key: SkeapUploadKey;
  label: string;
  name?: string;
  url: string;
  type: string;
  isImage: boolean;
  verified?: boolean;
  manualReview?: boolean;
  verificationStatus?: SkeapVerificationStatus;
  ocrNameStatus?: SkeapOcrNameStatus;
  adminRemark?: string;
  pendingResubmission?: boolean;
  fileType?: string;
  gradeDiagnostics?: GradeReportDiagnostics | null;
  ocrStatus?: "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED";
};

export function getSupportedSkeapDocumentType(
  file: Pick<File, "name" | "type">
): "application/pdf" | "image/jpeg" | "image/png" | "image/webp" | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const type = file.type.toLowerCase();
  const extensionType = extension === "pdf"
    ? "application/pdf"
    : extension === "jpg" || extension === "jpeg" || extension === "jfif"
      ? "image/jpeg"
      : extension === "png"
        ? "image/png"
        : extension === "webp"
          ? "image/webp"
          : null;

  if (!extensionType) return null;
  const isJfifMime = type === "image/jfif";
  if (
    type &&
    type !== "application/octet-stream" &&
    type !== extensionType &&
    !(extensionType === "image/jpeg" && isJfifMime)
  ) return null;
  return extensionType;
}

export type SkeapResubmissionReplacement = {
  slotId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
  gradeDiagnostics?: GradeReportDiagnostics | null;
  ocrStatus?: "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED";
};

export function buildSkeapResubmissionActivity(replacements: SkeapResubmissionReplacement[]) {
  const count = replacements.length;
  return {
    eventType: "RESUBMISSION" as const,
    text: `Applicant resubmitted ${count} replacement ${count === 1 ? "file" : "files"} for review.`,
    attachments: replacements.map((replacement) => {
      const uploadKey = SKEAP_UPLOAD_ORDER.find((key) => key === replacement.slotId);
      return {
        fileId: replacement.slotId,
        documentLabel: uploadKey ? SKEAP_UPLOAD_LABELS[uploadKey] : "Application document",
        fileName: replacement.fileName,
        fileUrl: replacement.fileUrl,
        fileType: replacement.fileType,
        adminRemark: "Applicant replacement upload",
      };
    }),
  };
}

export function getLatestSkeapResubmissionUploadKeys(
  messages: Array<{
    role: string;
    eventType?: string;
    createdAt: string;
    attachments?: Array<{ fileId: string }>;
  }>
) {
  const latestResubmission = messages
    .filter((message) => message.role === "applicant" && message.eventType === "RESUBMISSION")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  return new Set(latestResubmission?.attachments?.map((attachment) => attachment.fileId) ?? []);
}

export function getLatestSkeapResubmissionReplacements(
  messages: Array<{
    role: string;
    eventType?: string;
    createdAt: string;
    attachments?: Array<{
      fileId: string;
      fileName?: string;
      fileUrl?: string;
      fileType?: string;
    }>;
  }>
): SkeapResubmissionReplacement[] {
  const latestResubmission = messages
    .filter((message) => message.role === "applicant" && message.eventType === "RESUBMISSION")
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

  return (latestResubmission?.attachments ?? []).flatMap((attachment) => {
    if (
      !CORE_UPLOAD_KEYS.includes(attachment.fileId as SkeapUploadKey) ||
      typeof attachment.fileName !== "string" ||
      typeof attachment.fileUrl !== "string" ||
      typeof attachment.fileType !== "string"
    ) {
      return [];
    }
    return [{
      slotId: attachment.fileId,
      fileName: attachment.fileName,
      fileUrl: attachment.fileUrl,
      fileType: attachment.fileType,
    }];
  });
}

export function mergeSkeapResubmittedFiles(
  existingFiles: unknown,
  replacements: SkeapResubmissionReplacement[]
): Record<string, SkeapUploadValue> {
  const merged = normalizeUploadedFiles(existingFiles) ?? {};
  for (const replacement of replacements) {
    merged[replacement.slotId] = {
      url: replacement.fileUrl,
      name: replacement.fileName,
      verified: false,
      adminRemark: "",
      fileType: replacement.fileType,
      gradeDiagnostics: replacement.gradeDiagnostics,
      ocrStatus: replacement.ocrStatus,
    };
  }
  return merged;
}

export function mergeSkeapDraftReplacement(
  existingFiles: unknown,
  replacement: SkeapResubmissionReplacement
): Record<string, SkeapUploadValue> {
  const merged = normalizeUploadedFiles(existingFiles) ?? {};
  merged[replacement.slotId] = {
    url: replacement.fileUrl,
    name: replacement.fileName,
    verified: false,
    adminRemark: "",
    pendingResubmission: true,
    fileType: replacement.fileType,
    gradeDiagnostics: replacement.gradeDiagnostics,
    ocrStatus: replacement.ocrStatus,
  };
  return merged;
}

export function getPendingSkeapDraftReplacements(existingFiles: unknown): SkeapResubmissionReplacement[] {
  const uploads = normalizeUploadedFiles(existingFiles);
  if (!uploads) return [];

  return CORE_UPLOAD_KEYS.flatMap((slotId) => {
    const upload = uploads[slotId];
    if (!upload?.pendingResubmission || !upload.name || !upload.fileType) return [];
    return [{
      slotId,
      fileUrl: upload.url,
      fileName: upload.name,
      fileType: upload.fileType,
      ...(upload.gradeDiagnostics !== undefined
        ? { gradeDiagnostics: upload.gradeDiagnostics }
        : {}),
      ...(upload.ocrStatus ? { ocrStatus: upload.ocrStatus } : {}),
    }];
  });
}

export function getUnpersistedSkeapResubmissionReplacements(
  existingFiles: unknown,
  replacements: SkeapResubmissionReplacement[]
): SkeapResubmissionReplacement[] {
  const uploads = normalizeUploadedFiles(existingFiles) ?? {};
  return replacements.filter((replacement) => uploads[replacement.slotId]?.url !== replacement.fileUrl);
}

export const SKEAP_UPLOAD_ORDER: SkeapUploadKey[] = [
  SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE,
  SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY,
  SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
  SKEAP_UPLOAD_KEY.GRADE_REPORT,
  SKEAP_UPLOAD_KEY.FAMILY_INCOME,
  SKEAP_UPLOAD_KEY.PHOTO,
  SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
  SKEAP_UPLOAD_KEY.KK_ID_FRONT,
  SKEAP_UPLOAD_KEY.KK_ID_BACK,
  SKEAP_UPLOAD_KEY.OTHER,
];

export const SKEAP_UPLOAD_LABELS: Record<SkeapUploadKey, string> = {
  [SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE]: "Birth Certificate",
  [SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY]: "Certificate of Residency",
  [SKEAP_UPLOAD_KEY.ENROLLMENT_CERT]: "Certificate of Enrollment",
  [SKEAP_UPLOAD_KEY.GRADE_REPORT]: "Certified Grades / Form 138",
  [SKEAP_UPLOAD_KEY.FAMILY_INCOME]: "Certificate of Low-Income",
  [SKEAP_UPLOAD_KEY.PHOTO]: "2x2 Photo (ID)",
  [SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE]: "Voter's Certificate",
  [SKEAP_UPLOAD_KEY.KK_ID_FRONT]: "Valid ID (Front)",
  [SKEAP_UPLOAD_KEY.KK_ID_BACK]: "Valid ID (Back)",
  [SKEAP_UPLOAD_KEY.OTHER]: "Additional Document",
};

export function getSkeapRequiredDocuments(
  educationLevel: string,
  _yearLevel: string,
  applicantAge = 0,
  isRegisteredVoter: boolean | null = null,
): SkeapRequiredDocument[] {
  const isHighSchool = educationLevel === "Junior High School" || educationLevel === "Senior High School";
  const voterCertificateLabel = isRegisteredVoter === true
    ? "Applicant's COMELEC Voter's Certificate (Barangay Pico)"
    : applicantAge >= 15 && applicantAge < 18 && isRegisteredVoter === false
      ? "Parent / Guardian's COMELEC Voter's Certificate (Barangay Pico)"
      : "COMELEC Voter's Certificate (Barangay Pico)";
  const voterCertificateHelperText = isRegisteredVoter === true
    ? "Upload a clear photo or PDF of your Barangay Pico COMELEC Voter's Certificate."
    : applicantAge >= 15 && applicantAge < 18 && isRegisteredVoter === false
      ? "Upload the Barangay Pico COMELEC Voter's Certificate of your parent or legal guardian."
      : "Upload a clear photo or PDF of the appropriate Barangay Pico COMELEC Voter's Certificate.";

  return [
    {
      key: SKEAP_UPLOAD_KEY.FAMILY_INCOME,
      label: "Certificate of Low-Income",
      helperText: 'Must state purpose: "Sangguniang Kabataan Educational Assistance Program"',
    },
    {
      key: SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
      label: "Certificate of Enrollment",
      helperText: "Current semester/school year enrollment form or COE",
    },
    {
      key: SKEAP_UPLOAD_KEY.GRADE_REPORT,
      label: isHighSchool
        ? "Certified True Copy of Report Card / Form 138"
        : "Grades Issued by School Registrar",
    },
    {
      key: SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      label: voterCertificateLabel,
      helperText: voterCertificateHelperText,
    },
  ];
}

export const CORE_UPLOAD_KEYS: SkeapUploadKey[] = [
  SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
  SKEAP_UPLOAD_KEY.GRADE_REPORT,
  SKEAP_UPLOAD_KEY.FAMILY_INCOME,
];

export const SKEAP_TERM_UPLOAD_KEYS: readonly SkeapUploadKey[] = [
  SKEAP_UPLOAD_KEY.FAMILY_INCOME,
  SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
  SKEAP_UPLOAD_KEY.GRADE_REPORT,
  SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSkeapVerificationStatus(value: unknown): value is SkeapVerificationStatus {
  return value === "AUTO_VERIFIED" || value === "PENDING_ADMIN_REVIEW";
}

function isSkeapOcrNameStatus(value: unknown): value is SkeapOcrNameStatus {
  return value === "MATCHED_APPLICANT" ||
    value === "MATCHED_PARENT" ||
    value === "LOW_READABILITY" ||
    value === "NAME_MISMATCH";
}

export function isClientGradeOcrStatus(
  value: unknown,
): value is NonNullable<SkeapUploadValue["ocrStatus"]> {
  return value === "OCR_DONE" || value === "OCR_NEEDS_REVIEW" || value === "OCR_FAILED";
}

export function isGradeReportDiagnostics(value: unknown): value is GradeReportDiagnostics {
  if (!isObject(value)) return false;
  return (
    (value.detectedScale === null ||
      value.detectedScale === "PERCENTAGE_100" ||
      value.detectedScale === "SCALE_1_TO_5") &&
    (value.estimatedGwa === null ||
      (typeof value.estimatedGwa === "number" && Number.isFinite(value.estimatedGwa))) &&
    (value.gwaCheckStatus === "MEETS_REQUIREMENT" ||
      value.gwaCheckStatus === "BELOW_REQUIREMENT" ||
      value.gwaCheckStatus === "UNAVAILABLE") &&
    (value.meetsGwaRequirement === null || typeof value.meetsGwaRequirement === "boolean") &&
    typeof value.gwaMessage === "string" &&
    typeof value.hasPossibleFailingGrade === "boolean" &&
    Array.isArray(value.flaggedSubjects) &&
    value.flaggedSubjects.length <= 100 &&
    value.flaggedSubjects.every((item) => typeof item === "string") &&
    Array.isArray(value.flaggedGrades) &&
    value.flaggedGrades.length <= 100 &&
    value.flaggedGrades.every((item) => typeof item === "string") &&
    (value.possibleFailingGradeMessage === null ||
      typeof value.possibleFailingGradeMessage === "string")
  );
}

function isValidUploadEntry(value: unknown): value is {
  url: string;
  name?: string;
  verified?: boolean;
  manualReview?: boolean;
  verificationStatus?: SkeapVerificationStatus;
  ocrNameStatus?: SkeapOcrNameStatus;
  adminRemark?: string;
  pendingResubmission?: boolean;
  fileType?: string;
  gradeDiagnostics?: GradeReportDiagnostics | null;
  ocrStatus?: "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED";
} {
  return (
    isObject(value) &&
    typeof value.url === "string" &&
    value.url.trim().length > 0 &&
    (value.name === undefined || typeof value.name === "string") &&
    (value.verified === undefined || typeof value.verified === "boolean") &&
    (value.manualReview === undefined || typeof value.manualReview === "boolean") &&
    (value.verificationStatus === undefined || isSkeapVerificationStatus(value.verificationStatus)) &&
    (value.ocrNameStatus === undefined || isSkeapOcrNameStatus(value.ocrNameStatus)) &&
    (value.adminRemark === undefined || typeof value.adminRemark === "string") &&
    (value.pendingResubmission === undefined || typeof value.pendingResubmission === "boolean") &&
    (value.fileType === undefined || typeof value.fileType === "string") &&
    (value.gradeDiagnostics === undefined ||
      value.gradeDiagnostics === null ||
      isGradeReportDiagnostics(value.gradeDiagnostics)) &&
    (value.ocrStatus === undefined || isClientGradeOcrStatus(value.ocrStatus))
  );
}

export function normalizeUploadedFiles(raw: unknown): Record<string, SkeapUploadValue> | null {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return normalizeUploadedFiles(parsed);
    } catch {
      return null;
    }
  }

  if (Array.isArray(raw)) {
    const uploads = raw.reduce<Record<string, SkeapUploadValue>>((acc, item) => {
      if (!isObject(item) || typeof item.url !== "string" || !item.url.trim()) return acc;
      const requirement =
        typeof item.requirement === "string" && item.requirement.trim()
          ? item.requirement
          : typeof item.name === "string" && item.name.trim()
          ? item.name
          : item.url;
      const key = normalizeUploadRequirement(requirement);
      acc[key] = {
        url: item.url,
        name: typeof item.name === "string" ? item.name : undefined,
        verified: typeof item.verified === "boolean" ? item.verified : undefined,
        manualReview: typeof item.manualReview === "boolean" ? item.manualReview : undefined,
        verificationStatus: isSkeapVerificationStatus(item.verificationStatus) ? item.verificationStatus : undefined,
        ocrNameStatus: isSkeapOcrNameStatus(item.ocrNameStatus) ? item.ocrNameStatus : undefined,
        adminRemark: typeof item.adminRemark === "string" ? item.adminRemark : undefined,
        pendingResubmission: typeof item.pendingResubmission === "boolean" ? item.pendingResubmission : undefined,
        fileType: typeof item.fileType === "string" ? item.fileType : undefined,
        gradeDiagnostics: isGradeReportDiagnostics(item.gradeDiagnostics)
          ? item.gradeDiagnostics
          : item.gradeDiagnostics === null
            ? null
            : undefined,
        ocrStatus: isClientGradeOcrStatus(item.ocrStatus) ? item.ocrStatus : undefined,
      };
      return acc;
    }, {});

    return Object.keys(uploads).length > 0 ? uploads : null;
  }

  if (isObject(raw)) {
    const uploads = Object.entries(raw).reduce<Record<string, SkeapUploadValue>>((acc, [key, rawValue]) => {
      if (!isObject(rawValue) || !isValidUploadEntry(rawValue)) return acc;

      const value = rawValue as {
        url: string;
        name?: string;
        requirement?: unknown;
        verified?: unknown;
        manualReview?: unknown;
        verificationStatus?: unknown;
        ocrNameStatus?: unknown;
        adminRemark?: unknown;
        pendingResubmission?: unknown;
        fileType?: unknown;
        gradeDiagnostics?: unknown;
        ocrStatus?: unknown;
      };
      let normalizedKey = normalizeUploadRequirement(key);
      if (normalizedKey === "other") {
        const fallback =
          typeof value.requirement === "string" && value.requirement.trim()
            ? value.requirement
            : typeof value.name === "string" && value.name.trim()
            ? value.name
            : key;
        normalizedKey = normalizeUploadRequirement(fallback);
      }

      acc[normalizedKey] = {
        url: value.url,
        name: value.name,
        verified: typeof value.verified === "boolean" ? value.verified : undefined,
        manualReview: typeof value.manualReview === "boolean" ? value.manualReview : undefined,
        verificationStatus: isSkeapVerificationStatus(value.verificationStatus) ? value.verificationStatus : undefined,
        ocrNameStatus: isSkeapOcrNameStatus(value.ocrNameStatus) ? value.ocrNameStatus : undefined,
        adminRemark: typeof value.adminRemark === "string" ? value.adminRemark : undefined,
        pendingResubmission:
          typeof value.pendingResubmission === "boolean" ? value.pendingResubmission : undefined,
        fileType: typeof value.fileType === "string" ? value.fileType : undefined,
        gradeDiagnostics: isGradeReportDiagnostics(value.gradeDiagnostics)
          ? value.gradeDiagnostics
          : value.gradeDiagnostics === null
            ? null
            : undefined,
        ocrStatus: isClientGradeOcrStatus(value.ocrStatus) ? value.ocrStatus : undefined,
      };
      return acc;
    }, {});
    return Object.keys(uploads).length > 0 ? uploads : null;
  }

  return null;
}

export function areRequiredSkeapDocumentsPreScreened(raw: unknown): boolean {
  const uploads = normalizeUploadedFiles(raw);
  if (!uploads) return false;

  const requiredKeys = [
    ...CORE_UPLOAD_KEYS,
    ...(uploads[SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE]?.url.trim()
      ? [SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE]
      : []),
  ];

  return requiredKeys.every((key) => {
    const upload = uploads[key];
    return Boolean(upload?.url.trim()) && upload?.verified === true;
  });
}

function parseUploadedFiles(raw: unknown): Record<string, SkeapUploadValue> | null {
  return normalizeUploadedFiles(raw);
}

export function isImageUrl(url: string) {
  return /\.(jpe?g|jfif|png|gif|webp|avif|svg)(\?|$)/i.test(url);
}

export function getFileTypeLabel(url: string) {
  if (isImageUrl(url)) return "Image";
  if (/\.pdfm?(\?|$)/i.test(url)) return "PDF";
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(url)) return "Document";
  return "Document";
}

export function normalizeUploadRequirement(value: string): SkeapUploadKey {
  const normalized = String(value || "").trim().toLowerCase();

  if (/kkidfront|valididfront/.test(normalized)) return SKEAP_UPLOAD_KEY.KK_ID_FRONT;
  if (/kkidback|valididback/.test(normalized)) return SKEAP_UPLOAD_KEY.KK_ID_BACK;
  if (/2x2|photo|id photo/.test(normalized)) return SKEAP_UPLOAD_KEY.PHOTO;
  if (/birth|valid id|passport|license/.test(normalized)) return SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE;
  if (/barangay|residency|residence|proof of residency|residence certificate/.test(normalized)) return SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY;
  if (/enroll|enrollment/.test(normalized)) return SKEAP_UPLOAD_KEY.ENROLLMENT_CERT;
  if (/grade|report|transcript/.test(normalized)) return SKEAP_UPLOAD_KEY.GRADE_REPORT;
  if (/income|tax|salary|financial/.test(normalized)) return SKEAP_UPLOAD_KEY.FAMILY_INCOME;
  if (/voter/.test(normalized)) return SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE;
  return SKEAP_UPLOAD_KEY.OTHER;
}

export function getUploadGroups(uploadedFiles: unknown): SkeapUploadGroup[] {
  const parsed = parseUploadedFiles(uploadedFiles);
  if (!parsed) return [];

  return SKEAP_UPLOAD_ORDER.flatMap((key) => {
    const item = parsed[key];
    if (!isValidUploadEntry(item)) return [];

    return [
      {
        key,
        label: SKEAP_UPLOAD_LABELS[key],
        name: item.name,
        url: item.url,
        type: getFileTypeLabel(item.url),
        isImage: isImageUrl(item.url),
        verified: item.verified ?? false,
        manualReview: item.manualReview,
        verificationStatus: item.verificationStatus,
        ocrNameStatus: item.ocrNameStatus,
        adminRemark: item.adminRemark,
        pendingResubmission: item.pendingResubmission,
        fileType: item.fileType,
        gradeDiagnostics: item.gradeDiagnostics,
        ocrStatus: item.ocrStatus,
      },
    ];
  });
}

export function getCoreUploadGroups(uploadedFiles: unknown): SkeapUploadGroup[] {
  return CORE_UPLOAD_KEYS.map((key) => {
    const groups = getUploadGroups(uploadedFiles);
    const found = groups.find((group) => group.key === key);
    return found ?? { key, label: SKEAP_UPLOAD_LABELS[key], url: "", type: "Missing", isImage: false };
  });
}

export function getPhotoUploadGroup(uploadedFiles: unknown): SkeapUploadGroup | undefined {
  return getUploadGroups(uploadedFiles).find((group) => group.key === "photo");
}

export function getApplicantUploadedFiles(uploadedFiles: unknown) {
  const parsed = parseUploadedFiles(uploadedFiles);
  if (!parsed) return undefined;

  return Object.fromEntries(
    Object.entries(parsed).map(([key, upload]) => [
      key,
      {
        url: upload.url,
        ...(upload.name !== undefined ? { name: upload.name } : {}),
        ...(upload.manualReview !== undefined ? { manualReview: upload.manualReview } : {}),
        ...(upload.verificationStatus !== undefined ? { verificationStatus: upload.verificationStatus } : {}),
        ...(upload.ocrNameStatus !== undefined ? { ocrNameStatus: upload.ocrNameStatus } : {}),
        ...(upload.pendingResubmission !== undefined ? { pendingResubmission: upload.pendingResubmission } : {}),
        ...(upload.fileType !== undefined ? { fileType: upload.fileType } : {}),
        ...(upload.gradeDiagnostics !== undefined
          ? { gradeDiagnostics: upload.gradeDiagnostics }
          : {}),
        ...(upload.ocrStatus !== undefined ? { ocrStatus: upload.ocrStatus } : {}),
      },
    ])
  );
}

export function getSkeapApplicationResumeFiles(status: string | null | undefined, uploadedFiles: unknown) {
  const normalizedStatus = String(status ?? "").trim().toUpperCase();
  if (!["DRAFT", "RETURNED", "RETURNED_FOR_EDIT"].includes(normalizedStatus)) return {};

  const applicantFiles = getApplicantUploadedFiles(uploadedFiles);
  if (!applicantFiles) return {};

  return SKEAP_TERM_UPLOAD_KEYS.reduce<Partial<Record<SkeapUploadKey, SkeapUploadValue>>>(
    (resumableFiles, key) => {
      const upload = applicantFiles[key];
      if (upload?.url.trim()) resumableFiles[key] = upload;
      return resumableFiles;
    },
    {},
  );
}

export function getAdditionalUploadGroups(uploadedFiles: unknown): SkeapUploadGroup[] {
  return getUploadGroups(uploadedFiles).filter((group) => !CORE_UPLOAD_KEYS.includes(group.key) && group.key !== "photo");
}
