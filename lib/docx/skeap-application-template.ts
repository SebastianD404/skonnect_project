import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Prisma } from "@prisma/client";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import PizZip from "pizzip";
import sharp from "sharp";
import { formatSkeapPermanentAddress, type PermanentAddressParts } from "@/lib/grantee-address";
import { getPhotoUploadGroup } from "@/lib/skeap-upload";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";

const TEMPLATE_PATH = join(process.cwd(), "public", "SKEAP Application Form.docx");

export const SKEAP_APPLICATION_DOCX_BASE_SELECT = {
  id: true,
  userId: true,
  currentCourse: true,
  yearLevel: true,
  gwa: true,
  enrollmentFileUrl: true,
  reportCardFileUrl: true,
  status: true,
  submittedAt: true,
  updatedAt: true,
  applicantName: true,
  permanentAddress: true,
  dateOfBirth: true,
  placeOfBirth: true,
  fathersName: true,
  fathersOccupation: true,
  fathersContact: true,
  mothersMaidenName: true,
  mothersOccupation: true,
  contactNumber: true,
  emailAddress: true,
  uploadedFiles: true,
  photoFileUrl: true,
  age: true,
  civilStatus: true,
  mothersContact: true,
  school: true,
  gender: true,
  grades: true,
  timeline: true,
  educationalBackground: true,
} satisfies Prisma.SkeapApplicationSelect;

type SkeapApplicationTemplateInput = {
  applicantName?: string | null;
  gender?: string | null;
  age?: number | string | null;
  civilStatus?: string | null;
  registeredVoter?: boolean | null;
  permanentAddress?: string | null;
  dateOfBirth?: Date | string | null;
  placeOfBirth?: string | null;
  contactNumber?: string | null;
  emailAddress?: string | null;
  school?: string | null;
  yearLevel?: string | null;
  currentCourse?: string | null;
  fathersName?: string | null;
  fathersOccupation?: string | null;
  fathersContact?: string | null;
  mothersMaidenName?: string | null;
  mothersOccupation?: string | null;
  mothersContact?: string | null;
  totalFamilyMonthlyIncome?: string | number | null;
  signatureUrl?: string | null;
  schoolHistory?: unknown;
  elementarySchool?: string | null;
  elementaryYearGraduated?: string | number | null;
  highSchool?: string | null;
  highSchoolYearGraduated?: string | number | null;
  college?: string | null;
  collegeYearGraduated?: string | number | null;
  vocational?: string | null;
  vocationalYearGraduated?: string | number | null;
  educationalBackground?: unknown;
  submittedAt?: Date | string | null;
  photoFileUrl?: string | null;
  uploadedFiles?: unknown;
};

type ApplicantTemplateContext = {
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  contactNumber?: string | null;
  avatarUrl?: string | null;
  gender?: string | null;
  age?: number | string | null;
  civilStatus?: string | null;
  registeredNationalVoter?: string | null;
  address?: PermanentAddressParts & { addressLine?: string | null };
};

function safeText(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "N/A";
  const text = String(value).trim();
  return text || "N/A";
}

function toTitleCase(value: string | null | undefined) {
  return safeText(value)
    .toLocaleLowerCase()
    .replace(/(^|[\s-])(\p{L})/gu, (_match, separator: string, letter: string) =>
      `${separator}${letter.toLocaleUpperCase()}`
    );
}

function normalizeEmail(value: string | null | undefined) {
  const text = safeText(value);
  return text === "N/A" ? text : text.toLowerCase();
}

function parseEducationalBackground(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    } catch (error) {
      console.warn("Could not parse SKEAP educational background JSON.", error);
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function educationValue(
  education: Record<string, unknown>,
  level: "elementary" | "highSchool" | "college" | "vocational",
  valueType: "school" | "year"
) {
  const nested = education[level];
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const nestedRecord = nested as Record<string, unknown>;
    const nestedValue = valueType === "school"
      ? nestedRecord.school
      : nestedRecord.year ?? nestedRecord.yearGraduated;
    if (typeof nestedValue === "string" || typeof nestedValue === "number") return nestedValue;
  } else if (valueType === "school" && (typeof nested === "string" || typeof nested === "number")) {
    return nested;
  }

  const fieldCandidates =
    valueType === "school"
      ? level === "elementary"
        ? ["elementarySchool", "elemSchool"]
        : level === "highSchool"
          ? ["highSchool", "hsSchool"]
          : level === "vocational"
            ? ["vocational", "vocationalSchool"]
            : ["college", "collegeSchool"]
      : level === "elementary"
        ? ["elementaryYearGraduated", "elemYear"]
        : level === "highSchool"
          ? ["highSchoolYearGraduated", "hsYear"]
          : level === "vocational"
            ? ["vocationalYearGraduated", "vocationalYear"]
            : ["collegeYearGraduated", "collegeYear"];
  for (const field of fieldCandidates) {
    const value = education[field];
    if (typeof value === "string" || typeof value === "number") return value;
  }
  return undefined;
}

function formatDate(value: Date | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "N/A";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.valueOf())) return "N/A";
  return date.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function voterRegistrationStatus(value: string | boolean | null | undefined): boolean | null {
  if (typeof value === "boolean") return value;
  const normalized = value?.trim().toLowerCase();
  if (normalized === "yes" || normalized === "true" || normalized === "1") return true;
  if (normalized === "registered") return true;
  if (normalized === "no" || normalized === "false" || normalized === "0" || normalized === "not registered") return false;
  return null;
}

function formatApplicantAddress(
  applicationAddress: string | null | undefined,
  applicantAddress: ApplicantTemplateContext["address"]
) {
  const structuredAddress = formatSkeapPermanentAddress({
    sitio: applicantAddress?.sitio,
    barangay: applicantAddress?.barangay,
    municipality: applicantAddress?.municipality,
    province: applicantAddress?.province,
    addressLine: applicantAddress?.addressLine,
  }, applicationAddress);
  return structuredAddress === "Not specified" ? "N/A" : structuredAddress;
}

function getProfilePhotoUrl(application: SkeapApplicationTemplateInput, context: ApplicantTemplateContext) {
  return (
    context.avatarUrl?.trim() ||
    application.photoFileUrl?.trim() ||
    getPhotoUploadGroup(application.uploadedFiles)?.url ||
    ""
  );
}

export function buildSkeapApplicationTemplateData(
  application: SkeapApplicationTemplateInput,
  context: ApplicantTemplateContext,
  profilePhoto: string
) {
  const voterStatus = voterRegistrationStatus(
    application.registeredVoter ?? context.registeredNationalVoter
  );
  const schoolHistory = parseEducationalBackground(
    application.schoolHistory ?? application.educationalBackground
  );
  const profileName = [context.firstName, context.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const applicantDisplayName = context.fullName?.trim() || application.applicantName?.trim() || profileName;
  const formattedAddress = formatApplicantAddress(application.permanentAddress, context.address);
  return {
    applicantName: toTitleCase(applicantDisplayName),
    applicantNameUpper: safeText(applicantDisplayName).toUpperCase(),
    gender: toTitleCase(context.gender ?? application.gender),
    age: safeText(context.age ?? application.age),
    civilStatus: ` ${toTitleCase(context.civilStatus ?? application.civilStatus)}`,
    permanentAddress: toTitleCase(formattedAddress),
    dateOfBirth: formatDate(application.dateOfBirth),
    placeOfBirth: toTitleCase(application.placeOfBirth),
    contactNumber: safeText(context.contactNumber ?? application.contactNumber),
    emailAddress: normalizeEmail(context.email ?? application.emailAddress),
    school: normalizeSkeapSchoolName(toTitleCase(application.school)),
    yearLevel: toTitleCase(application.yearLevel),
    course: toTitleCase(application.currentCourse),
    fatherName: toTitleCase(application.fathersName),
    fatherOccupation: toTitleCase(application.fathersOccupation),
    fatherContact: safeText(application.fathersContact),
    motherName: toTitleCase(application.mothersMaidenName),
    motherOccupation: toTitleCase(application.mothersOccupation),
    motherContact: safeText(application.mothersContact),
    familyIncome: safeText(application.totalFamilyMonthlyIncome),
    elemSchool: normalizeSkeapSchoolName(toTitleCase(safeText(educationValue(schoolHistory, "elementary", "school") ?? application.elementarySchool))),
    elemYear: safeText(educationValue(schoolHistory, "elementary", "year") ?? application.elementaryYearGraduated),
    hsSchool: normalizeSkeapSchoolName(toTitleCase(safeText(educationValue(schoolHistory, "highSchool", "school") ?? application.highSchool))),
    hsYear: safeText(educationValue(schoolHistory, "highSchool", "year") ?? application.highSchoolYearGraduated),
    collegeSchool: normalizeSkeapSchoolName(toTitleCase(safeText(educationValue(schoolHistory, "college", "school") ?? application.college))),
    collegeYear: safeText(educationValue(schoolHistory, "college", "year") ?? application.collegeYearGraduated),
    vocSchool: normalizeSkeapSchoolName(toTitleCase(safeText(educationValue(schoolHistory, "vocational", "school") ?? application.vocational))),
    vocYear: safeText(educationValue(schoolHistory, "vocational", "year") ?? application.vocationalYearGraduated),
    submissionDate: formatDate(application.submittedAt),
    voterYes: voterStatus === true ? "[✓]" : voterStatus === null ? "[?]" : "[ ]",
    voterNo: voterStatus === false ? "[✓]" : voterStatus === null ? "[?]" : "[ ]",
    profileImage: profilePhoto,
    applicantSignature: application.signatureUrl || null,
  };
}

async function fetchProfilePhoto(url: string) {
  if (!url) return null;

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    console.warn("Omitting invalid SKEAP profile photo URL.");
    return null;
  }

  const configuredSupabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
    : null;
  const isSupabaseHost =
    parsedUrl.hostname.endsWith(".supabase.co") || parsedUrl.hostname === configuredSupabaseHost;
  if (parsedUrl.protocol !== "https:" || !isSupabaseHost) {
    console.warn("Omitting SKEAP profile photo from an unapproved URL host.");
    return null;
  }

  try {
    const response = await fetch(parsedUrl);
    if (!response.ok) {
      console.warn(`Omitting SKEAP profile photo; storage returned HTTP ${response.status}.`);
      return null;
    }
    return Buffer.from(await response.arrayBuffer());
  } catch (error) {
    console.warn("Omitting SKEAP profile photo after a fetch failure.", error);
    return null;
  }
}

function signatureDataUrlToBuffer(value: string) {
  const match = /^data:image\/png;base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) {
    throw new Error("Stored SKEAP applicant signature is not a valid PNG data URL.");
  }
  const buffer = Buffer.from(match[1], "base64");
  if (
    buffer.length > 512_000 ||
    buffer.length < 8 ||
    !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    throw new Error("Stored SKEAP applicant signature is not a valid PNG image.");
  }
  return buffer;
}

async function fetchSignatureImage(value: string) {
  return value.startsWith("data:image/png;base64,")
    ? signatureDataUrlToBuffer(value)
    : fetchProfilePhoto(value);
}

async function prepSignature(
  buf: Buffer,
  maxW = 160,
  maxH = 45
): Promise<{ buf: Buffer; size: [number, number] }> {
  const { data, info } = await sharp(buf)
    .flatten({ background: "#ffffff" })
    .trim({ threshold: 10 })
    .png()
    .toBuffer({ resolveWithObject: true });
  const scale = Math.min(maxW / info.width, maxH / info.height);
  return {
    buf: data,
    size: [Math.round(info.width * scale), Math.round(info.height * scale)],
  };
}

async function prepPhoto(buf: Buffer) {
  return sharp(buf)
    .resize(380, 380, { fit: "cover", position: "centre" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

export async function generateSkeapApplicationDocx(
  application: SkeapApplicationTemplateInput,
  context: ApplicantTemplateContext = {}
) {
  const profilePhotoUrl = getProfilePhotoUrl(application, context);
  const profilePhotoBuffer = await fetchProfilePhoto(profilePhotoUrl);
  const signatureBuffer = application.signatureUrl
    ? await fetchSignatureImage(application.signatureUrl)
    : null;
  const photo = profilePhotoBuffer ? await prepPhoto(profilePhotoBuffer) : null;
  const sig: { buf: Buffer | null; size: [number, number] } = signatureBuffer
    ? await prepSignature(signatureBuffer)
    : { buf: null, size: [160, 45] };
  const data = buildSkeapApplicationTemplateData(application, context, profilePhotoBuffer ? profilePhotoUrl : "");
  const zip = new PizZip(readFileSync(TEMPLATE_PATH));
  const imageModule = new ImageModule({
    centered: false,
    fileType: "docx",
    getImage: (_tagValue: string, key: string) =>
      key === "applicantSignature" ? sig.buf : photo,
    getSize: (_image: Buffer | null, _tagValue: string, key: string) =>
      key === "applicantSignature" ? sig.size : [190, 190],
  });
  const document = new Docxtemplater(zip, {
    modules: [imageModule],
    paragraphLoop: true,
    linebreaks: true,
  });
  document.setData(data);
  document.render();
  return document.getZip().generate({ type: "nodebuffer" });
}
