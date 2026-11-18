import { NextRequest, NextResponse } from "next/server";
import { GranteeStatus, Prisma, Role, SubmissionStatus } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getSkeapApplicationResumeFiles,
  normalizeUploadedFiles,
  SKEAP_UPLOAD_KEY,
} from "@/lib/skeap-upload";
import { getSkeapCapacitySnapshot, lockSkeapCapacity } from "@/lib/skeap-capacity";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { formatSkeapPermanentAddress } from "@/lib/grantee-address";
import { isEligibleSkeapApplicantYearLevel, isSkeapEducationLevel } from "@/lib/skeap-education";
import { getCanonicalPlaceOfBirth, placeOfBirthSchema } from "@/lib/place-of-birth-schema";
import {
  getActiveSkeapEducationLevels,
  getSkeapEducationLevelGuardError,
  getSkeapReapplicationEligibility,
  getSkeapSubmissionGuardError,
  isSkeapApplicationBlockingReapplication,
  SKEAP_APPLICATION_REAPPLICATION_BLOCKING_SUBMISSION_STATUSES,
} from "@/lib/skeap-application-guard";
import { getPermanentlyDisqualifiedSkeapRecords } from "@/lib/skeap-permanent-disqualification-records";
import {
  getApprovedKkProfileIdentity,
  hasCompleteKkIdentityDocuments,
} from "@/lib/kk-identity-documents";
import { getAcademicYearDateRange, getCurrentAcademicYear } from "@/lib/semester";
import { getExactAge } from "@/lib/skeap-age";
import {
  getSkeapWaitlistCycleState,
} from "@/lib/skeap-waitlist-cycle";
import { refreshSkeapApplicationsAdminView } from "@/lib/application-admin-view-refresh";

const EDUCATION_LEVELS = ["elementary", "highSchool", "college", "vocational"] as const;
const EDUCATION_FIELDS = [
  "elementarySchool",
  "elementaryYearGraduated",
  "highSchool",
  "highSchoolYearGraduated",
  "college",
  "collegeYearGraduated",
  "vocational",
  "vocationalYearGraduated",
  "elemSchool",
  "elemYear",
  "hsSchool",
  "hsYear",
  "collegeSchool",
  "collegeYear",
  "vocationalSchool",
  "vocationalYear",
] as const;

function getAgeFromBirthDate(birthDate: Date) {
  const today = new Date();
  let age = today.getUTCFullYear() - birthDate.getUTCFullYear();
  if (
    today.getUTCMonth() < birthDate.getUTCMonth() ||
    (today.getUTCMonth() === birthDate.getUTCMonth() && today.getUTCDate() < birthDate.getUTCDate())
  ) {
    age -= 1;
  }
  return age;
}

type UserQueryClient = Pick<Prisma.TransactionClient, "user">;

async function getSkeapIdentityCandidate(
  userId: string,
  client: UserQueryClient = prisma,
) {
  const user = await client.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      kkProfileId: true,
      kkProfile: {
        select: {
          id: true,
          firstName: true,
          middleName: true,
          lastName: true,
          birthDate: true,
          placeOfBirth: true,
        },
      },
    },
  });

  return {
    userId,
    kkProfileId: user?.kkProfile?.id ?? user?.kkProfileId,
    firstName: user?.kkProfile?.firstName,
    middleName: user?.kkProfile?.middleName,
    lastName: user?.kkProfile?.lastName,
    dateOfBirth: user?.kkProfile?.birthDate,
    placeOfBirth: user?.kkProfile?.placeOfBirth,
  };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ hasApplication: false });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ hasApplication: false });
    }

    const currentCycle = getAcademicYearDateRange(getCurrentAcademicYear());
    if (!currentCycle) throw new Error("Unable to determine the active SKEAP cycle.");

    const [
      applicationInquiry,
      identityCandidate,
      permanentRecords,
      currentCycleApplications,
      currentBlockingApplication,
      grantee,
    ] = await Promise.all([
      prisma.inquiry.findFirst({
        where: {
          userId: appUser.id,
          subject: { contains: "SKEAP application", mode: "insensitive" },
          applicationId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          reviewStatus: true,
          application: { select: { status: true } },
        },
      }),
      getSkeapIdentityCandidate(appUser.id),
      getPermanentlyDisqualifiedSkeapRecords(),
      prisma.$queryRaw<Array<{ status: string; uploadedFiles: Prisma.JsonValue | null }>>(Prisma.sql`
        SELECT application."status"::text AS "status", application."uploadedFiles"
        FROM "public"."skeap_applications" AS application
        WHERE application."userId" = ${appUser.id}
          AND application."submittedAt" >= ${currentCycle.start}
          AND application."submittedAt" < ${currentCycle.end}
        ORDER BY application."submittedAt" DESC, application."id" DESC
        LIMIT 1
      `),
      prisma.skeapApplication.findFirst({
        where: {
          userId: appUser.id,
          submittedAt: { gte: currentCycle.start, lt: currentCycle.end },
          status: { in: [...SKEAP_APPLICATION_REAPPLICATION_BLOCKING_SUBMISSION_STATUSES] },
        },
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        select: { status: true },
      }),
      prisma.grantee.findUnique({
        where: { userId: appUser.id },
        select: { status: true },
      }),
    ]);
    const permanentEligibility = getSkeapReapplicationEligibility(
      permanentRecords,
      identityCandidate,
    );
    const age = getExactAge(identityCandidate.dateOfBirth);
    const granteeEligibilityError =
      grantee?.status === GranteeStatus.ACTIVE ||
      grantee?.status === GranteeStatus.PROBATIONARY
        ? "Active SKEAP grantees cannot reapply."
        : grantee?.status === GranteeStatus.GRADUATED
          ? "Graduated SKEAP grantees are not eligible to reapply."
          : age !== null && (age < 15 || age > 30)
            ? "Applicants must be between 15 and 30 years old."
            : null;
    const eligibility =
      permanentEligibility.eligible && granteeEligibilityError
        ? {
            eligible: false as const,
            reason: "INELIGIBLE_GRANTEE_STATUS" as const,
            message: granteeEligibilityError,
          }
        : permanentEligibility;
    const currentCycleApplication = currentCycleApplications[0];
    const hasCurrentApplication =
      currentBlockingApplication !== null ||
      isSkeapApplicationBlockingReapplication(currentCycleApplication?.status);
    const initialUploadedFiles = eligibility.eligible
      ? getSkeapApplicationResumeFiles(currentCycleApplication?.status, currentCycleApplication?.uploadedFiles)
      : {};

    return NextResponse.json(
      {
        hasApplication: Boolean(applicationInquiry),
        hasCurrentApplication,
        reviewStatus: applicationInquiry?.reviewStatus ?? null,
        applicationStatus: applicationInquiry?.application?.status ?? null,
        eligibility,
        isPermanentlyBarred: !permanentEligibility.eligible,
        hasPriorRevocation: grantee?.status === GranteeStatus.REVOKED,
        initialUploadedFiles,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Failed to check SKEAP application status:", error);
    return NextResponse.json({ error: "Failed to check SKEAP application status." }, { status: 500 });
  }
}

function normalizeEducationalBackground(value: unknown): Prisma.InputJsonObject | undefined {
  let parsed: unknown = value;
  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch (error) {
      console.warn("Ignoring invalid SKEAP educational background JSON.", error);
      parsed = {};
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) parsed = {};

  const source = parsed as Record<string, unknown>;
  const background: Record<string, Prisma.InputJsonValue> = {};
  for (const level of EDUCATION_LEVELS) {
    const entry = source[level];
    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const values = entry as Record<string, unknown>;
      const school = values.school;
      const year = values.year ?? values.yearGraduated;
      const normalized: Record<string, Prisma.InputJsonValue> = {};
      if (typeof school === "string" || typeof school === "number") {
        normalized.school = String(school).trim();
      }
      if (typeof year === "string" || typeof year === "number") {
        normalized.year = String(year).trim();
      }
      if (Object.keys(normalized).length) background[level] = normalized;
    } else if (typeof entry === "string" || typeof entry === "number") {
      background[level] = String(entry).trim();
    }
  }
  for (const field of EDUCATION_FIELDS) {
    const entry = source[field];
    if (typeof entry === "string" || typeof entry === "number") {
      background[field] = String(entry).trim();
    }
  }
  const educationFields = [
    { key: "elementary", aliases: ["elementarySchool", "elemSchool"], level: "elementary", value: "school" },
    { key: "elementaryYearGraduated", aliases: ["elemYear"], level: "elementary", value: "year" },
    { key: "highSchool", aliases: ["hsSchool"], level: "highSchool", value: "school" },
    { key: "highSchoolYearGraduated", aliases: ["hsYear"], level: "highSchool", value: "year" },
    { key: "college", aliases: ["collegeSchool"], level: "college", value: "school" },
    { key: "collegeYearGraduated", aliases: ["collegeYear"], level: "college", value: "year" },
    { key: "vocational", aliases: ["vocationalSchool"], level: "vocational", value: "school" },
    { key: "vocationalYearGraduated", aliases: ["vocationalYear"], level: "vocational", value: "year" },
  ] as const;

  for (const field of educationFields) {
    const nested = background[field.level];
    const nestedValue =
      nested && typeof nested === "object" && !Array.isArray(nested)
        ? (nested as Record<string, unknown>)[field.value] ??
          (field.value === "year" ? (nested as Record<string, unknown>).yearGraduated : undefined)
        : undefined;
    const value = [background[field.key], ...field.aliases.map((alias) => background[alias]), nestedValue]
      .find((candidate) =>
        (typeof candidate === "string" || typeof candidate === "number") && String(candidate).trim()
      );
    background[field.key] = value === undefined ? "N/A" : String(value).trim();
  }

  return background;
}

function buildSkeapInquiryMessage(data: {
  applicantName?: string;
  schoolName?: string;
  educationLevel?: string;
  currentCourse: string;
  yearLevel: string;
  emailAddress?: string;
  contactNumber?: string;
  enrollmentFileUrl: string;
  reportCardFileUrl: string;
  photoFileUrl?: string;
  uploadedFiles?: Array<{ url?: string; name?: string }> | Record<string, { url?: string; name?: string }>;
}) {
  const lines = [
    `Applicant Name: ${data.applicantName || "Unknown"}`,
    `School / Institution: ${data.schoolName || "Unknown"}`,
    ...(data.educationLevel ? [`Education Level: ${data.educationLevel}`] : []),
    ...(data.currentCourse !== "N/A" ? [`Course / Strand: ${data.currentCourse}`] : []),
    `Year Level: ${data.yearLevel}`,
  ];

  if (data.emailAddress) lines.push(`Email Address: ${data.emailAddress}`);
  if (data.contactNumber) lines.push(`Contact Number: ${data.contactNumber}`);

  const uploadedUrls = new Set<string>();
  const addUploadedUrl = (url?: string) => {
    const normalized = String(url || "").trim();
    if (normalized) uploadedUrls.add(normalized);
  };

  addUploadedUrl(data.enrollmentFileUrl);
  addUploadedUrl(data.reportCardFileUrl);
  addUploadedUrl(data.photoFileUrl);

  if (Array.isArray(data.uploadedFiles)) {
    data.uploadedFiles.forEach((file) => addUploadedUrl(file?.url));
  } else if (typeof data.uploadedFiles === "object" && data.uploadedFiles !== null) {
    Object.values(data.uploadedFiles).forEach((file) => addUploadedUrl((file as { url?: string })?.url));
  }

  lines.push("", `Supporting documents: ${uploadedUrls.size} files attached.`);

  return lines.join("\n");
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    let {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      const authorization =
        request.headers.get("authorization") || request.headers.get("Authorization");

      if (authorization?.toLowerCase().startsWith("bearer ")) {
        const token = authorization.slice(7).trim();
        if (token) {
          const { data: session, error: sessionError } = await supabase.auth.setSession({
            access_token: token,
            refresh_token: "",
          });

          if (sessionError) {
            console.error("Supabase bearer token session failed:", sessionError.message);
          }

          user = session?.user ?? null;
        }
      }
    }

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User profile not found" }, { status: 401 });
    }

    const [identityCandidate, permanentRecords] = await Promise.all([
      getSkeapIdentityCandidate(appUser.id),
      getPermanentlyDisqualifiedSkeapRecords(),
    ]);
    const eligibility = getSkeapReapplicationEligibility(permanentRecords, identityCandidate);
    if (!eligibility.eligible) {
      return NextResponse.json(
        { ...eligibility, error: eligibility.message },
        { status: 403 },
      );
    }

    const body = await request.json();
    const firstName = String(body.firstName ?? "").trim();
    const noMiddleName = body.noMiddleName === true;
    const middleName = noMiddleName ? "" : String(body.middleName ?? "").trim();
    const lastName = String(body.lastName ?? "").trim();
    const applicantName = firstName && lastName
      ? `${lastName}, ${firstName}${middleName ? ` ${middleName}` : ""}`
      : "";
    const schoolName = normalizeSkeapSchoolName(String(body.schoolName || "").trim());
    const educationLevel = String(body.educationLevel || "").trim();
    const currentCourse = String(body.currentCourse || "").trim();
    const yearLevel = String(body.yearLevel || "").trim();
    const permanentAddressInput = String(body.permanentAddress ?? "").trim();
    const permanentAddress = formatSkeapPermanentAddress({}, permanentAddressInput);
    const dateOfBirthRaw = String(body.dateOfBirth ?? "").trim();
    const dateOfBirth = dateOfBirthRaw ? new Date(dateOfBirthRaw) : null;
    const submittedPlaceOfBirth = String(body.placeOfBirth ?? "").trim();
    const civilStatus = String(body.civilStatus ?? "").trim();
    const gender = String(body.gender ?? "").trim();
    const contactNumber = String(body.contactNumber ?? "").trim();
    const emailAddress = String(body.emailAddress ?? "").trim();
    const fathersName = String(body.fathersName ?? "").trim();
    const fathersOccupation = String(body.fathersOccupation ?? "").trim();
    const fathersContact = String(body.fathersContact ?? "").trim();
    const mothersMaidenName = String(body.mothersMaidenName ?? "").trim();
    const mothersOccupation = String(body.mothersOccupation ?? "").trim();
    const mothersContact = String(body.mothersContact ?? "").trim();
    const enrollmentFileUrl = String(body.enrollmentFileUrl || "").trim();
    const reportCardFileUrl = String(body.reportCardFileUrl || "").trim();
    const gwaRaw = String(body.gwa || "").trim();
    const gwa = gwaRaw ? Number(gwaRaw) : null;
    const ageRaw = body.age == null ? "" : String(body.age).trim();
    const age = ageRaw ? Number(ageRaw) : undefined;
    const totalFamilyMonthlyIncome = String(body.totalFamilyMonthlyIncome ?? "").trim();
    const registeredVoter = body.registeredVoter;
    const parentGuardianRegisteredVoter = body.parentGuardianRegisteredVoter === true;
    const parentGuardianVoterFullName = String(body.parentGuardianVoterFullName ?? "").trim();
    const parentGuardianName = String(body.parentGuardianName ?? "").trim();
    const parentGuardianContact = String(body.parentGuardianContact ?? "").trim();
    const numberOfDependentsRaw = String(body.numberOfDependents ?? "").trim();
    const numberOfDependents = numberOfDependentsRaw ? Number(numberOfDependentsRaw) : null;

    if (!firstName || (!middleName && !noMiddleName) || !lastName) {
      return NextResponse.json(
        { error: noMiddleName ? "Applicant first and last names are required." : "Applicant first, middle, and last names are required." },
        { status: 400 },
      );
    }
    if (typeof registeredVoter !== "boolean") {
      return NextResponse.json(
        { error: "Please indicate whether you are a registered voter of Barangay Pico." },
        { status: 400 }
      );
    }
    if (
      !permanentAddressInput ||
      permanentAddress === "Not specified" ||
      !schoolName ||
      !dateOfBirthRaw ||
      !dateOfBirth ||
      Number.isNaN(dateOfBirth.getTime()) ||
      !ageRaw ||
      !civilStatus ||
      !gender ||
      !contactNumber ||
      !emailAddress
    ) {
      return NextResponse.json(
        { error: "All personal information fields are required, including the applicant photo." },
        { status: 400 }
      );
    }
    const rawAppUploadedFiles = body.uploadedFiles ?? body.allUploadedFiles ?? body.documentUploads ?? null;
    const normalizedUploadedFiles = normalizeUploadedFiles(rawAppUploadedFiles);
    const uploadedFiles = normalizedUploadedFiles
      ? Object.fromEntries(
          Object.entries(normalizedUploadedFiles).map(([key, upload]) => [
            key,
            {
              url: upload.url,
              ...(upload.name !== undefined ? { name: upload.name } : {}),
              ...(upload.verified !== undefined ? { verified: upload.verified } : {}),
              ...(upload.manualReview !== undefined ? { manualReview: upload.manualReview } : {}),
              ...(upload.verificationStatus !== undefined ? { verificationStatus: upload.verificationStatus } : {}),
              ...(upload.ocrNameStatus !== undefined ? { ocrNameStatus: upload.ocrNameStatus } : {}),
            },
          ])
        )
      : null;
    const educationalBackground = normalizeEducationalBackground(body.educationalBackground);

    if (!isSkeapEducationLevel(educationLevel)) {
      return NextResponse.json({ error: "Select a valid education level." }, { status: 400 });
    }
    const activeEducationLevels = await getActiveSkeapEducationLevels();
    const educationLevelGuardError = getSkeapEducationLevelGuardError(
      educationLevel,
      activeEducationLevels,
    );
    if (educationLevelGuardError) {
      return NextResponse.json({ error: educationLevelGuardError }, { status: 400 });
    }
    if (!isEligibleSkeapApplicantYearLevel(educationLevel, yearLevel)) {
      return NextResponse.json(
        { error: "Select a valid year level for the selected education level." },
        { status: 400 }
      );
    }
    if (!schoolName || (educationLevel !== "Junior High School" && !currentCourse) || !enrollmentFileUrl || !reportCardFileUrl) {
      return NextResponse.json(
        { error: "School, education level, year level, enrollment file, and report card file are required. Course or strand is required except for Junior High School." },
        { status: 400 }
      );
    }
    if (
      !fathersName ||
      !fathersOccupation ||
      !fathersContact ||
      !mothersMaidenName ||
      !mothersOccupation ||
      !mothersContact ||
      !totalFamilyMonthlyIncome
    ) {
      return NextResponse.json(
        { error: "Complete all family background fields. Enter N/A for contact details that do not apply." },
        { status: 400 }
      );
    }
    if (
      numberOfDependentsRaw &&
      (
        numberOfDependents === null ||
        !Number.isInteger(numberOfDependents) ||
        numberOfDependents < 0
      )
    ) {
      return NextResponse.json(
        { error: "Enter a whole number of household dependents, including zero if none." },
        { status: 400 }
      );
    }

    if (gwa !== null && (Number.isNaN(gwa) || gwa < 0 || gwa > 100)) {
      return NextResponse.json({ error: "GWA must be between 0 and 100." }, { status: 400 });
    }

    if (age === undefined || Number.isNaN(age) || age < 15 || age > 30) {
      return NextResponse.json({ error: "Applicants must be between 15 and 30 years old." }, { status: 400 });
    }

    const [approvedKkIdentity, kkProfile] = await Promise.all([
      getApprovedKkProfileIdentity(appUser.id),
      prisma.user.findUnique({
        where: { id: appUser.id },
        select: { kkProfile: { select: { isVerified: true, placeOfBirth: true } } },
      }),
    ]);
    const approvedKkRegistration = approvedKkIdentity.registration;
    const hasVerifiedKkProfile =
      approvedKkRegistration?.reviewStatus.trim().toLowerCase() === "approved" &&
      kkProfile?.kkProfile?.isVerified === true;
    if (!approvedKkRegistration || !hasVerifiedKkProfile) {
      return NextResponse.json(
        { error: "Your KK Profiling must be approved before you can apply for SKEAP." },
        { status: 403 },
      );
    }
    const placeOfBirthResult = placeOfBirthSchema.safeParse(
      getCanonicalPlaceOfBirth(kkProfile?.kkProfile?.placeOfBirth, submittedPlaceOfBirth),
    );
    if (!placeOfBirthResult.success) {
      return NextResponse.json(
        { error: placeOfBirthResult.error.issues[0]?.message ?? "Enter a valid place of birth." },
        { status: 400 }
      );
    }
    const placeOfBirth = placeOfBirthResult.data;

    const identityDocuments = approvedKkIdentity.documents;
    if (!hasCompleteKkIdentityDocuments(identityDocuments)) {
      return NextResponse.json(
        { error: "Your approved KK Profile is missing identity documents. Contact SK support before applying." },
        { status: 409 },
      );
    }
    const photoFileUrl = identityDocuments.photo;
    const verifiedAge = getAgeFromBirthDate(approvedKkRegistration.birthDate);
    if (verifiedAge < 15 || verifiedAge > 30) {
      return NextResponse.json({ error: "Applicants must be between 15 and 30 years old." }, { status: 400 });
    }

    if (!uploadedFiles) {
      console.error("Invalid uploadedFiles payload for SKEAP application", {
        userId: appUser.id,
        rawAppUploadedFiles,
      });
      return NextResponse.json(
        { error: "uploadedFiles must be a valid upload payload with one entry for each required document." },
        { status: 400 }
      );
    }

    for (const upload of Object.values(uploadedFiles)) {
      upload.verified = false;
    }

    const uploadedPhoto = uploadedFiles[SKEAP_UPLOAD_KEY.PHOTO];
    uploadedFiles[SKEAP_UPLOAD_KEY.PHOTO] = {
      ...uploadedPhoto,
      url: photoFileUrl,
    };
    uploadedFiles[SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE] = {
      url: identityDocuments.birthCertificate,
    };
    uploadedFiles[SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY] = {
      url: identityDocuments.residency,
    };
    uploadedFiles[SKEAP_UPLOAD_KEY.KK_ID_FRONT] = {
      url: identityDocuments.validIdFront,
    };
    uploadedFiles[SKEAP_UPLOAD_KEY.KK_ID_BACK] = {
      url: identityDocuments.validIdBack,
    };

    const submissionGuardError = getSkeapSubmissionGuardError({
      age: verifiedAge,
      registeredVoter,
      parentGuardianRegisteredVoter,
      parentGuardianVoterFullName,
      uploadedFiles,
    });
    if (submissionGuardError) {
      return NextResponse.json(
        { error: submissionGuardError },
        { status: 400 }
      );
    }

    const baseCreateData = {
      userId: appUser.id,
      school: schoolName,
      educationLevel,
      currentCourse: currentCourse || "N/A",
      yearLevel,
      gwa: gwa === null ? null : gwa,
      // Persist optional grades and timeline if provided by client
      grades: Array.isArray(body.grades) ? body.grades : undefined,
      timeline: body.timeline ? body.timeline : undefined,
      educationalBackground,
      enrollmentFileUrl,
      reportCardFileUrl,
      applicantName,
      permanentAddress,
      dateOfBirth: approvedKkRegistration.birthDate,
      placeOfBirth,
      age: verifiedAge,
      civilStatus,
      registeredVoter,
      parentGuardianRegisteredVoter: verifiedAge < 18 && !registeredVoter
        ? parentGuardianRegisteredVoter
        : undefined,
      parentGuardianVoterFullName: verifiedAge < 18 && !registeredVoter
        ? parentGuardianVoterFullName
        : undefined,
      parentGuardianName: verifiedAge < 18
        ? parentGuardianName || undefined
        : undefined,
      parentGuardianContact: verifiedAge < 18
        ? parentGuardianContact || undefined
        : undefined,
      numberOfDependents,
      totalFamilyMonthlyIncome: totalFamilyMonthlyIncome || undefined,
      gender,
      fathersName,
      fathersOccupation,
      fathersContact,
      mothersMaidenName,
      mothersOccupation,
      mothersContact,
      contactNumber,
      emailAddress,
      uploadedFiles,
      photoFileUrl,
      // keep uploaded files as normalized JSON
    };

    const created = await prisma.$transaction(async (tx) => {
      await lockSkeapCapacity(tx);
      const currentCycle = getAcademicYearDateRange(getCurrentAcademicYear());
      if (!currentCycle) throw new Error("SKEAP_CYCLE_UNAVAILABLE");
      const cycleState = await getSkeapWaitlistCycleState(getCurrentAcademicYear(), tx);
      if (cycleState.isClosed) throw new Error("SKEAP_CYCLE_CLOSED");

      const currentIdentity = await getSkeapIdentityCandidate(appUser.id, tx);
      const currentPermanentRecords = await getPermanentlyDisqualifiedSkeapRecords(tx);
      const currentEligibility = getSkeapReapplicationEligibility(
        currentPermanentRecords,
        currentIdentity,
      );
      if (!currentEligibility.eligible) {
        throw new Error("SKEAP_PERMANENTLY_BARRED");
      }

      const currentGrantee = await tx.grantee.findUnique({
        where: { userId: appUser.id },
        select: { status: true },
      });
      if (
        currentGrantee?.status === GranteeStatus.ACTIVE ||
        currentGrantee?.status === GranteeStatus.PROBATIONARY
      ) {
        throw new Error("SKEAP_ACTIVE_GRANTEE");
      }
      if (currentGrantee?.status === GranteeStatus.GRADUATED) {
        throw new Error("SKEAP_GRADUATED");
      }

      const activeApplication = await tx.skeapApplication.findFirst({
        where: {
          userId: appUser.id,
          submittedAt: { gte: currentCycle.start, lt: currentCycle.end },
          status: {
            in: [...SKEAP_APPLICATION_REAPPLICATION_BLOCKING_SUBMISSION_STATUSES],
          },
        },
        select: { id: true },
      });
      if (activeApplication) throw new Error("SKEAP_APPLICATION_IN_PROGRESS");

      let canonicalPlaceOfBirth = getCanonicalPlaceOfBirth(currentIdentity.placeOfBirth, placeOfBirth);
      if (!currentIdentity.placeOfBirth?.trim() && currentIdentity.kkProfileId) {
        const backfilled = await tx.kKProfile.updateMany({
          where: {
            id: currentIdentity.kkProfileId,
            OR: [{ placeOfBirth: null }, { placeOfBirth: "" }],
          },
          data: { placeOfBirth: placeOfBirth },
        });
        if (backfilled.count === 0) {
          const latestKkProfile = await tx.kKProfile.findUnique({
            where: { id: currentIdentity.kkProfileId },
            select: { placeOfBirth: true },
          });
          canonicalPlaceOfBirth = latestKkProfile?.placeOfBirth?.trim() || canonicalPlaceOfBirth;
        }
      }
      const canonicalPlaceOfBirthResult = placeOfBirthSchema.safeParse(canonicalPlaceOfBirth);
      if (!canonicalPlaceOfBirthResult.success) {
        throw new Error("SKEAP_PLACE_OF_BIRTH_INVALID");
      }

      const capacity = await getSkeapCapacitySnapshot(tx, appUser.id);
      const isWaitlisted = capacity.isFull;
      const waitlistPosition = isWaitlisted
        ? (await tx.skeapApplication.count({
            where: {
              status: "WAITLISTED",
              submittedAt: { gte: currentCycle.start, lt: currentCycle.end },
            },
          })) + 1
        : null;
      const createData = {
        ...baseCreateData,
        placeOfBirth: canonicalPlaceOfBirthResult.data,
        status: (isWaitlisted ? "WAITLISTED" : "PENDING") as SubmissionStatus,
        waitlistPosition,
      };
      const application = await tx.skeapApplication.create({ data: createData, select: { id: true } });
      if (isWaitlisted) {
        await tx.user.update({
          where: { id: appUser.id },
          data: { role: Role.YOUTH },
        });
      }
      const applicantMessage = isWaitlisted
        ? `Your SKEAP application has been received and placed on the waitlist at position ${waitlistPosition} because all ${capacity.maxSlots} scholarship slots are currently filled.`
        : "Applicant submitted a SKEAP application.";
      const inquiry = await tx.inquiry.create({
        data: {
          userId: appUser.id,
          applicationId: application.id,
          subject: "SKEAP application submitted",
          message: `${applicantMessage}\n\n${buildSkeapInquiryMessage({
            applicantName: createData.applicantName,
            schoolName: createData.school,
            educationLevel,
            currentCourse,
            yearLevel,
            emailAddress: createData.emailAddress,
            contactNumber: createData.contactNumber,
            enrollmentFileUrl,
            reportCardFileUrl,
            photoFileUrl: createData.photoFileUrl,
            uploadedFiles: createData.uploadedFiles,
          })}`,
          reviewStatus: isWaitlisted ? "Waitlisted" : "Pending review",
        },
        select: { id: true },
      });
      return {
        applicationId: application.id,
        inquiryId: inquiry.id,
        isWaitlisted,
        waitlistPosition,
        maxSlots: capacity.maxSlots,
      };
    });

    await refreshSkeapApplicationsAdminView();
    return NextResponse.json({
      success: true,
      applicationId: created.applicationId,
      inquiryId: created.inquiryId,
      status: created.isWaitlisted ? "WAITLISTED" : "PENDING",
      waitlistPosition: created.waitlistPosition,
      message: created.isWaitlisted
        ? `Your application was successfully placed on the waitlist at position ${created.waitlistPosition} because all ${created.maxSlots} scholarship slots are currently filled.`
        : "Your SKEAP application was submitted successfully.",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit SKEAP application";
    if (message === "SKEAP_PERMANENTLY_BARRED") {
      return NextResponse.json(
        {
          eligible: false,
          reason: "PERMANENTLY_DISQUALIFIED",
          message: "You are permanently ineligible to reapply for SKEAP due to a prior conduct or disciplinary revocation.",
          error: "You are permanently ineligible to reapply for SKEAP due to a prior conduct or disciplinary revocation.",
        },
        { status: 403 },
      );
    }
    if (message === "SKEAP_APPLICATION_IN_PROGRESS") {
      return NextResponse.json(
        { error: "You already have a SKEAP application in progress." },
        { status: 409 },
      );
    }
    if (message === "SKEAP_ACTIVE_GRANTEE") {
      return NextResponse.json(
        { error: "Active SKEAP grantees cannot submit another application." },
        { status: 409 },
      );
    }
    if (message === "SKEAP_GRADUATED") {
      return NextResponse.json(
        { error: "Graduated SKEAP grantees are not eligible to reapply." },
        { status: 403 },
      );
    }
    if (message === "SKEAP_CYCLE_CLOSED") {
      return NextResponse.json(
        { error: "The SKEAP application cycle is closed. Please check your application status for waitlist updates." },
        { status: 409 },
      );
    }
    if (message === "SKEAP_PLACE_OF_BIRTH_INVALID") {
      return NextResponse.json({ error: "Enter a valid place of birth." }, { status: 400 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
