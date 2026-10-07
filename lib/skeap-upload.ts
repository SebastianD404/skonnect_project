export const SKEAP_UPLOAD_KEY = {
  BIRTH_CERTIFICATE: "birthCertificate",
  BARANGAY_RESIDENCY: "barangayResidency",
  ENROLLMENT_CERT: "enrollmentCertificate",
  GRADE_REPORT: "gradeReport",
  FAMILY_INCOME: "incomeCertificate",
  PHOTO: "photo",
  VOTER_CERTIFICATE: "voterCertificate",
  OTHER: "other",
} as const;

export type SkeapUploadKey = (typeof SKEAP_UPLOAD_KEY)[keyof typeof SKEAP_UPLOAD_KEY];

export type SkeapUploadValue = {
  name?: string;
  url: string;
  verified?: boolean;
  adminRemark?: string;
  pendingResubmission?: boolean;
  fileType?: string;
};

export type SkeapUploadGroup = {
  key: SkeapUploadKey;
  label: string;
  name?: string;
  url: string;
  type: string;
  isImage: boolean;
  verified?: boolean;
  adminRemark?: string;
  pendingResubmission?: boolean;
  fileType?: string;
};

export type SkeapResubmissionReplacement = {
  slotId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
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
  SKEAP_UPLOAD_KEY.OTHER,
];

export const SKEAP_UPLOAD_LABELS: Record<SkeapUploadKey, string> = {
  [SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE]: "Birth Certificate / Valid ID",
  [SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY]: "Barangay Certificate of Residency",
  [SKEAP_UPLOAD_KEY.ENROLLMENT_CERT]: "Certificate of Enrollment",
  [SKEAP_UPLOAD_KEY.GRADE_REPORT]: "Latest grade report / Transcript of Records",
  [SKEAP_UPLOAD_KEY.FAMILY_INCOME]: "Family income certificate or income tax return",
  [SKEAP_UPLOAD_KEY.PHOTO]: "2x2 Photo (ID)",
  [SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE]: "Voter's Certificate",
  [SKEAP_UPLOAD_KEY.OTHER]: "Additional Document",
};

export const CORE_UPLOAD_KEYS: SkeapUploadKey[] = [
  SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE,
  SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY,
  SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
  SKEAP_UPLOAD_KEY.GRADE_REPORT,
  SKEAP_UPLOAD_KEY.FAMILY_INCOME,
];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isValidUploadEntry(value: unknown): value is {
  url: string;
  name?: string;
  verified?: boolean;
  adminRemark?: string;
  pendingResubmission?: boolean;
  fileType?: string;
} {
  return (
    isObject(value) &&
    typeof value.url === "string" &&
    value.url.trim().length > 0 &&
    (value.name === undefined || typeof value.name === "string") &&
    (value.verified === undefined || typeof value.verified === "boolean") &&
    (value.adminRemark === undefined || typeof value.adminRemark === "string") &&
    (value.pendingResubmission === undefined || typeof value.pendingResubmission === "boolean") &&
    (value.fileType === undefined || typeof value.fileType === "string")
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
        adminRemark: typeof item.adminRemark === "string" ? item.adminRemark : undefined,
        pendingResubmission: typeof item.pendingResubmission === "boolean" ? item.pendingResubmission : undefined,
        fileType: typeof item.fileType === "string" ? item.fileType : undefined,
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
        adminRemark?: unknown;
        pendingResubmission?: unknown;
        fileType?: unknown;
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
        adminRemark: typeof value.adminRemark === "string" ? value.adminRemark : undefined,
        pendingResubmission:
          typeof value.pendingResubmission === "boolean" ? value.pendingResubmission : undefined,
        fileType: typeof value.fileType === "string" ? value.fileType : undefined,
      };
      return acc;
    }, {});
    return Object.keys(uploads).length > 0 ? uploads : null;
  }

  return null;
}

function parseUploadedFiles(raw: unknown): Record<string, SkeapUploadValue> | null {
  return normalizeUploadedFiles(raw);
}

export function isImageUrl(url: string) {
  return /\.(jpe?g|png|gif|webp|avif|svg)(\?|$)/i.test(url);
}

export function getFileTypeLabel(url: string) {
  if (isImageUrl(url)) return "Image";
  if (/\.pdfm?(\?|$)/i.test(url)) return "PDF";
  if (/\.(docx?|xlsx?|pptx?)(\?|$)/i.test(url)) return "Document";
  return "Document";
}

export function normalizeUploadRequirement(value: string): SkeapUploadKey {
  const normalized = String(value || "").trim().toLowerCase();

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
        adminRemark: item.adminRemark,
        pendingResubmission: item.pendingResubmission,
        fileType: item.fileType,
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
        ...(upload.pendingResubmission !== undefined ? { pendingResubmission: upload.pendingResubmission } : {}),
        ...(upload.fileType !== undefined ? { fileType: upload.fileType } : {}),
      },
    ])
  );
}

export function getAdditionalUploadGroups(uploadedFiles: unknown): SkeapUploadGroup[] {
  return getUploadGroups(uploadedFiles).filter((group) => !CORE_UPLOAD_KEYS.includes(group.key) && group.key !== "photo");
}
