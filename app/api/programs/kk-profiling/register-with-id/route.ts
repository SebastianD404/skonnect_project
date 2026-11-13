import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { uploadPrivateDocument } from "@/lib/private-documents";
import { createClient as createSupabaseServerClient } from "@/lib/supabase/server";
import { KK_PROFILING_MANUAL_REVIEW_NOTE } from "@/lib/kk-profiling-review";
import { isValidContactNumber, isValidNameInput } from "@/lib/kk-profiling-inputs";
import { KKProfileSchema } from "@/lib/kk-profile-schema";
import { MINIMUM_RESIDENCY_MONTHS_TEXT } from "@/lib/residency-requirement";
import { formatSexLabel, parseSex } from "@/lib/sex";
import {
  BARANGAY_PICO,
  OFFICIAL_PUROKS,
  OFFICIAL_SITIOS,
  normalizeSitio,
  normalizePurok,
  splitFullName,
} from "@/lib/kk";

function computeAge(birthDate: Date) {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  let age = currentYear - birthYear;
  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDay < birthDay)
  ) {
    age -= 1;
  }
  return age;
}

function isEmailUniqueConstraintError(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
    return false;
  }

  const target = error.meta?.target;
  const fields = Array.isArray(target) ? target : [target];
  return fields.some((field) => typeof field === "string" && field.toLowerCase().includes("email"));
}

async function uploadFile(userId: string, file: File, suffix: string) {
  return uploadPrivateDocument(userId, file, "kk-verification", suffix);
}

function parseAddress(address: string) {
  const normalized = address
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .join(", ");
  const lower = normalized.toLowerCase();
  const barangay = lower.includes("pico") ? BARANGAY_PICO : "";

  let purok = "";
  for (const value of OFFICIAL_SITIOS) {
    if (lower.includes(value.toLowerCase())) {
      purok = value;
      break;
    }
  }

  if (!purok) {
  for (const value of OFFICIAL_PUROKS) {
    if (lower.includes(value.toLowerCase())) {
      purok = value;
      break;
    }
  }
  }

  if (!purok) {
    const purokMatch = normalized.match(/purok\s*\d+/i);
    if (purokMatch) {
      purok = normalizePurok(purokMatch[0].replace(/\s+/g, " "));
    }
  }

  let addressLine = normalized;
  if (purok) {
    const escapedPurok = purok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    addressLine = addressLine.replace(new RegExp(escapedPurok, "i"), "");
  }
  addressLine = addressLine
    .replace(/barangay\s*pico/gi, "")
    .replace(/brgy\.?\s*pico/gi, "")
    .replace(/\bpico\b/gi, "")
    .replace(/^[,\s]+|[,\s]+$/g, "")
    .replace(/\s+,/g, ",")
    .replace(/,\s+/g, ", ")
    .trim();

  return {
    purok,
    addressLine: addressLine || "Address pending verification",
    barangay,
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return NextResponse.json({ error: "Sign in before submitting KK Profiling." }, { status: 401 });
    }

    const { data: { user: verifiedUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !verifiedUser || verifiedUser.id !== session.user.id) {
      return NextResponse.json({ error: "Your session is invalid. Please sign in again." }, { status: 401 });
    }

    const authId = session.user.id;
    const appUser = await prisma.user.findUnique({
      where: { authId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        kkProfileId: true,
        kkStatus: true,
      },
    });
    if (!appUser) {
      return NextResponse.json({ error: "Account profile not found. Please contact support." }, { status: 404 });
    }
    if (!appUser.isActive || appUser.role !== "YOUTH") {
      return NextResponse.json({ error: "Only active youth accounts can submit KK Profiling." }, { status: 403 });
    }
    if (appUser.kkStatus === "APPROVED") {
      return NextResponse.json({ error: "Your KK Profiling is already approved." }, { status: 409 });
    }

    const formData = await req.formData();
    
    // Extract form fields
    const body = {
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      middleInitial: formData.get("middleInitial"),
      sitio: formData.get("sitio"),
      barangay: formData.get("barangay"),
      municipality: formData.get("municipality"),
      province: formData.get("province"),
      sex: formData.get("sex"),
      age: formData.get("age"),
      birthDate: formData.get("birthDate"),
      email: formData.get("email"),
      facebook: formData.get("facebook"),
      contactNumber: formData.get("contactNumber"),
      civilStatus: formData.get("civilStatus"),
      youthClassification: formData.get("youthClassification"),
      youthAgeGroup: formData.get("youthAgeGroup"),
      workStatus: formData.get("workStatus"),
      educationalBackground: formData.get("educationalBackground"),
      registeredSKVoter: formData.get("registeredSKVoter"),
      votedLastSK: formData.get("votedLastSK"),
      registeredNationalVoter: formData.get("registeredNationalVoter"),
      attendedKKAssembly: formData.get("attendedKKAssembly"),
      assemblyTimes: formData.get("assemblyTimes"),
      noAssemblyReason: formData.get("noAssemblyReason"),
      consent: formData.get("consent") === "true",
      residencyStatementAcknowledgement: formData.get("residencyStatementAcknowledgement") === "true",
      address: formData.get("address"),
      requiresManualReview:
        formData.get("requires_manual_review") === "true" ||
        formData.get("manualReviewRequested") === "true",
    };

    if (!body.consent) {
      return NextResponse.json({ error: "Consent is required" }, { status: 400 });
    }
    const sex = parseSex(body.sex);
    if (!sex) {
      return NextResponse.json({ error: "Select Male or Female for sex." }, { status: 400 });
    }

    const firstNameInput = String(body.firstName || "").trim();
    const middleNameInput = String(body.middleInitial || "").trim();
    const lastNameInput = String(body.lastName || "").trim();
    const email = appUser.email.trim().toLowerCase();
    const contactNumber = String(body.contactNumber || "").trim();

    if (!firstNameInput || !middleNameInput || !lastNameInput) {
      return NextResponse.json({ error: "First, middle, and last name are required" }, { status: 400 });
    }
    if (![firstNameInput, middleNameInput, lastNameInput].every(isValidNameInput)) {
      return NextResponse.json(
        { error: "First, middle, and last names must each contain at least two letters and no numbers." },
        { status: 400 }
      );
    }
    if (!contactNumber) {
      return NextResponse.json({ error: "Contact number is required" }, { status: 400 });
    }
    if (!isValidContactNumber(contactNumber)) {
      return NextResponse.json({ error: "Contact number can contain numbers only." }, { status: 400 });
    }

    const latestRegistration = await prisma.profilingRegistration.findFirst({
      where: { userId: appUser.id },
      orderBy: { submittedAt: "desc" },
      select: { reviewStatus: true },
    });
    if (latestRegistration?.reviewStatus?.trim().toLowerCase() === "rejected") {
      return NextResponse.json(
        { error: "Your latest KK Profiling registration was rejected and cannot be resubmitted. Contact Barangay Pico staff if you need clarification." },
        { status: 409 }
      );
    }

    const names = splitFullName(`${firstNameInput} ${middleNameInput} ${lastNameInput}`);
    const birthDateInput = String(body.birthDate || "");

    let birthDate: Date;
    try {
      birthDate = new Date(`${birthDateInput}T00:00:00Z`);
      if (Number.isNaN(birthDate.getTime())) {
        throw new Error("Invalid birth date");
      }
    } catch {
      return NextResponse.json({ error: "Invalid birth date" }, { status: 400 });
    }

    const age = computeAge(birthDate);
    if (age < 15 || age > 30) {
      return NextResponse.json(
        { error: "Age must be between 15 and 30 years old" },
        { status: 400 }
      );
    }

    const { purok, addressLine } = parseAddress(String(body.address || ""));
    const submittedSitio = normalizeSitio(String(body.sitio || "").trim());
    const resolvedSite = submittedSitio || purok;
    const municipality = String(body.municipality || "").trim();
    const province = String(body.province || "").trim();
    // Upload ID and residency files
    const uploads: Array<{ label: string; file: File }> = [];
    const frontFileEntry = formData.get("frontFile");
    const backFileEntry = formData.get("backFile");
    const residencyFileEntry = formData.get("residencyFile");
    const photoFileEntry = formData.get("photoFile");
    const birthCertificateFileEntry = formData.get("birthCertificateFile");

    if (!frontFileEntry || !backFileEntry) {
      return NextResponse.json(
        { error: "Please upload both the front and back of your valid ID." },
        { status: 400 }
      );
    }

    if (!residencyFileEntry) {
      return NextResponse.json(
        { error: "Please upload your Certificate of Residency." },
        { status: 400 }
      );
    }

    if (!photoFileEntry) {
      return NextResponse.json(
        { error: "Please upload a 2x2 ID picture." },
        { status: 400 }
      );
    }

    if (!birthCertificateFileEntry) {
      return NextResponse.json(
        { error: "Please upload your Birth Certificate." },
        { status: 400 }
      );
    }

    const documentValidation = KKProfileSchema.safeParse({
      profilePicture: photoFileEntry,
      birthCertificate: birthCertificateFileEntry,
      validId: { front: frontFileEntry, back: backFileEntry },
      certificateOfResidency: residencyFileEntry,
    });
    if (!documentValidation.success) {
      return NextResponse.json(
        { error: documentValidation.error.issues[0]?.message ?? "The uploaded documents are invalid." },
        { status: 400 }
      );
    }

    const {
      profilePicture: photoFile,
      birthCertificate: birthCertificateFile,
      validId: { front: frontFile, back: backFile },
      certificateOfResidency: residencyFile,
    } = documentValidation.data;

    // If a residency file was uploaded, the residency acknowledgement checkbox
    // is redundant because the document itself should state the 8-month residency.
    // Only require the explicit checkbox when no residency file is present.
    if (!body.residencyStatementAcknowledgement && !residencyFile) {
      return NextResponse.json(
        { error: `Please confirm that your Certificate of Residency states you have lived in the barangay for at least ${MINIMUM_RESIDENCY_MONTHS_TEXT}.` },
        { status: 400 }
      );
    }

    uploads.push({ label: "front", file: frontFile });
    uploads.push({ label: "back", file: backFile });
    uploads.push({ label: "residency", file: residencyFile });
    uploads.push({ label: "photo", file: photoFile });
    uploads.push({ label: "birth-certificate", file: birthCertificateFile });

    // Create a temporary Supabase client to upload files with the authenticated user
    const idDocumentType = "Valid ID + Certificate of Residency";
    let idFrontFileUrl: string | null = null;
    let idBackFileUrl: string | null = null;
    let idSingleFileUrl: string | null = null;
    let photoFileUrl: string | null = null;
    let birthCertificateFileUrl: string | null = null;

    const storageUserId = authId;
    for (const upload of uploads) {
      const result = await uploadFile(storageUserId, upload.file, upload.label);
      if (upload.label === "front") {
        idFrontFileUrl = result.url;
      } else if (upload.label === "back") {
        idBackFileUrl = result.url;
      } else if (upload.label === "residency") {
        idSingleFileUrl = result.url;
      } else if (upload.label === "photo") {
        photoFileUrl = result.url;
      } else if (upload.label === "birth-certificate") {
        birthCertificateFileUrl = result.url;
      }
    }

    const created = await prisma.$transaction(async (tx) => {
      let kkProfile = await tx.kKProfile.findUnique({ where: { email } });
      if (kkProfile) {
        const linkedUser = await tx.user.findFirst({
          where: { kkProfileId: kkProfile.id },
          select: { id: true },
        });
        if (linkedUser && linkedUser.id !== appUser.id) {
          throw new Error("KK_PROFILE_ALREADY_LINKED");
        }
        kkProfile = await tx.kKProfile.update({
          where: { id: kkProfile.id },
          data: {
            firstName: names.firstName,
            middleName: names.middleName ?? "",
            lastName: names.lastName,
            fullName: names.fullName,
            purok: resolvedSite,
            addressLine,
            barangay: BARANGAY_PICO,
            birthDate,
            contactNumber,
            sex,
            isVerified: false,
          },
        });
      } else {
        kkProfile = await tx.kKProfile.create({
          data: {
            firstName: names.firstName,
            middleName: names.middleName,
            lastName: names.lastName,
            fullName: names.fullName,
            purok: resolvedSite,
            addressLine,
            barangay: BARANGAY_PICO,
            birthDate,
            contactNumber,
            sex,
            email,
            isVerified: false,
          },
        });
      }

      const updatedUser = await tx.user.update({
        where: { id: appUser.id },
        data: {
          fullName: names.fullName,
          phoneNumber: contactNumber,
          barangay: BARANGAY_PICO,
          kkProfileId: kkProfile.id,
          kkStatus: "PENDING",
        },
      });

      const address = `${resolvedSite}, ${BARANGAY_PICO}, ${municipality}, ${province}`;

      await tx.profilingRegistration.create({
        data: {
          userId: updatedUser.id,
          fullName: names.fullName,
          middleName: names.middleName ?? "",
          address,
          sex: formatSexLabel(sex),
          age,
          birthDate,
          email,
          facebook: String(body.facebook || "").trim(),
          contactNumber,
          civilStatus: String(body.civilStatus || "").trim() || "Not specified",
          youthClassification: String(body.youthClassification || "").trim() || "Not specified",
          youthAgeGroup: String(body.youthAgeGroup || "").trim() || "Not specified",
          workStatus: String(body.workStatus || "").trim() || "Not specified",
          educationalBackground:
            String(body.educationalBackground || "").trim() || "Not specified",
          registeredSKVoter: String(body.registeredSKVoter || "").trim() || "No",
          votedLastSK: String(body.votedLastSK || "").trim() || "No",
          registeredNationalVoter:
            String(body.registeredNationalVoter || "").trim() || "No",
          attendedKKAssembly: String(body.attendedKKAssembly || "").trim() || "No",
          assemblyTimes: String(body.assemblyTimes || "").trim() || null,
          noAssemblyReason: String(body.noAssemblyReason || "").trim() || null,
          consent: true,
          idDocumentType,
          idFrontFileUrl,
          idBackFileUrl,
          idSingleFileUrl,
          photoFileUrl,
          birthCertificateFileUrl,
          reviewStatus: "Pending",
          reviewNotes: body.requiresManualReview ? KK_PROFILING_MANUAL_REVIEW_NOTE : null,
          requiresManualReview: body.requiresManualReview,
        },
      });

      return { kkProfileId: kkProfile.id, userId: updatedUser.id };
    });

    return NextResponse.json({
      success: true,
      kkProfileId: created.kkProfileId,
      userId: created.userId,
      signedIn: true,
      existingAccount: true,
      redirectTo: "/programs/kk-profiling/status",
      credentials: null,
      message: body.requiresManualReview
        ? "Your KK Profiling request and documents were submitted for manual SK Admin review. You can monitor your status from your account."
        : "Your KK Profiling request has been received with your ID documents and is now pending verification. You can monitor your status from your account.",
    });
  } catch (err: unknown) {
    if (isEmailUniqueConstraintError(err)) {
      return NextResponse.json(
        {
          error: "This email is already associated with another KK profile.",
          emailAlreadyRegistered: true,
        },
        { status: 409 }
      );
    }

    if (err instanceof Error && err.message === "KK_PROFILE_ALREADY_LINKED") {
      return NextResponse.json(
        { error: "This KK profile is already linked to another account." },
        { status: 409 }
      );
    }

    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A conflicting profile already exists. Please review your information and try again." },
        { status: 409 }
      );
    }

    if (err instanceof Error && err.message.includes("currently unavailable")) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }

    console.error(err);
    if (process.env.NODE_ENV !== "production") {
      return NextResponse.json(
        {
          error: "Unable to submit KK Profiling application.",
          detail: err instanceof Error ? err.message : String(err),
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: "Unable to submit KK Profiling application. Please try again later." },
      { status: 500 }
    );
  }
}
