import { readFileSync } from "node:fs";
import { join } from "node:path";
import Docxtemplater from "docxtemplater";
import ImageModule from "docxtemplater-image-module-free";
import PizZip from "pizzip";
import { formatPermanentAddress, type PermanentAddressParts } from "@/lib/grantee-address";
import { getPhotoUploadGroup } from "@/lib/skeap-upload";

const TEMPLATE_PATH = join(process.cwd(), "public", "SKEAP Application Form (2).docx");

type SkeapApplicationTemplateInput = {
  applicantName?: string | null;
  gender?: string | null;
  age?: number | string | null;
  civilStatus?: string | null;
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

function voterRegistrationStatus(value: string | null | undefined): boolean | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "yes" || normalized === "true" || normalized === "1") return true;
  if (normalized === "no" || normalized === "false" || normalized === "0") return false;
  return null;
}

function formatApplicantAddress(
  applicationAddress: string | null | undefined,
  applicantAddress: ApplicantTemplateContext["address"]
) {
  const locality = (applicantAddress?.addressLine ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const structuredAddress = formatPermanentAddress({
    sitio: applicantAddress?.sitio,
    barangay: applicantAddress?.barangay,
    municipality: locality[0],
    province: locality.slice(1).join(", "),
  });
  if (structuredAddress !== "Not specified") return structuredAddress;

  const fallbackAddress = applicationAddress
    ?.split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
  return fallbackAddress || "Not specified";
}

function getProfilePhotoUrl(application: SkeapApplicationTemplateInput, context: ApplicantTemplateContext) {
  return (
    context.avatarUrl?.trim() ||
    application.photoFileUrl?.trim() ||
    getPhotoUploadGroup(application.uploadedFiles)?.url ||
    ""
  );
}

function buildTemplateData(
  application: SkeapApplicationTemplateInput,
  context: ApplicantTemplateContext,
  profilePhoto: string
) {
  const voterStatus = voterRegistrationStatus(context.registeredNationalVoter);
  const education = parseEducationalBackground(application.educationalBackground);
  const profileName = [context.firstName, context.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  const fallbackName = context.fullName?.trim() || application.applicantName;
  return {
    applicantName: safeText(profileName || fallbackName),
    gender: safeText(context.gender ?? application.gender),
    age: safeText(context.age ?? application.age),
    civilStatus: safeText(context.civilStatus ?? application.civilStatus),
    permanentAddress: formatApplicantAddress(application.permanentAddress, context.address),
    dateOfBirth: formatDate(application.dateOfBirth),
    placeOfBirth: safeText(application.placeOfBirth),
    contactNumber: safeText(context.contactNumber ?? application.contactNumber),
    emailAddress: safeText(context.email ?? application.emailAddress),
    school: safeText(application.school),
    yearLevel: safeText(application.yearLevel),
    course: safeText(application.currentCourse),
    fatherName: safeText(application.fathersName),
    fatherOccupation: safeText(application.fathersOccupation),
    fatherContact: safeText(application.fathersContact),
    motherName: safeText(application.mothersMaidenName),
    motherOccupation: safeText(application.mothersOccupation),
    motherContact: safeText(application.mothersContact),
    familyIncome: safeText(application.totalFamilyMonthlyIncome),
    elemSchool: safeText(educationValue(education, "elementary", "school") ?? application.elementarySchool),
    elemYear: safeText(educationValue(education, "elementary", "year") ?? application.elementaryYearGraduated),
    hsSchool: safeText(educationValue(education, "highSchool", "school") ?? application.highSchool),
    hsYear: safeText(educationValue(education, "highSchool", "year") ?? application.highSchoolYearGraduated),
    collegeSchool: safeText(educationValue(education, "college", "school") ?? application.college),
    collegeYear: safeText(educationValue(education, "college", "year") ?? application.collegeYearGraduated),
    vocSchool: safeText(educationValue(education, "vocational", "school") ?? application.vocational),
    vocYear: safeText(educationValue(education, "vocational", "year") ?? application.vocationalYearGraduated),
    submissionDate: formatDate(application.submittedAt),
    voterYes: voterStatus === true ? "[X] Yes" : "[  ] Yes",
    voterNo: voterStatus === false ? "[X] No" : "[  ] No",
    profileImage: profilePhoto,
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

export async function generateSkeapApplicationDocx(
  application: SkeapApplicationTemplateInput,
  context: ApplicantTemplateContext = {}
) {
  const profilePhotoUrl = getProfilePhotoUrl(application, context);
  const profilePhotoBuffer = await fetchProfilePhoto(profilePhotoUrl);
  const data = buildTemplateData(application, context, profilePhotoBuffer ? profilePhotoUrl : "");
  const zip = new PizZip(readFileSync(TEMPLATE_PATH));
  const imageModule = new ImageModule({
    centered: false,
    fileType: "docx",
    getImage: () => profilePhotoBuffer,
    getSize: () => [170, 170],
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
