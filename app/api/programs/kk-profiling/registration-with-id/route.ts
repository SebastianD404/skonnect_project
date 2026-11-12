import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { uploadPrivateDocument } from "@/lib/private-documents";
import { isValidContactNumber, isValidNameInput } from "@/lib/kk-profiling-inputs";

const ALLOWED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"]);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
type DocumentSuffix = "front" | "back" | "residency" | "photo" | "birth-certificate";

function getOptionalFile(formData: FormData, field: string): File | null {
  const value = formData.get(field);
  if (value === null) return null;
  if (typeof value === "string") {
    if (!value) return null;
    throw new Error(`Invalid file data received for ${field}.`);
  }
  if (!value.name || value.size === 0) return null;
  return value;
}

async function uploadFile(userId: string, file: File, suffix: string) {
  return (await uploadPrivateDocument(userId, file, "kk-verification", suffix)).url;
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const formData = await request.formData();
    const registration = await prisma.profilingRegistration.findFirst({
      where: { userId: appUser.id },
      orderBy: { submittedAt: "desc" },
    });

    if (!registration) {
      return NextResponse.json({ error: "KK profiling registration not found." }, { status: 404 });
    }
    if (registration.reviewStatus.trim().toLowerCase() === "rejected") {
      return NextResponse.json(
        { error: "This registration was rejected and can no longer be edited or resubmitted. Contact Barangay Pico staff if you need clarification." },
        { status: 409 },
      );
    }

    const firstName = String(formData.get("firstName") || "");
    const middleName = String(formData.get("middleInitial") || "");
    const lastName = String(formData.get("lastName") || "");
    if (![firstName, middleName, lastName].every(isValidNameInput)) {
      return NextResponse.json(
        { error: "First, middle, and last names must each contain at least two letters and no numbers." },
        { status: 400 },
      );
    }

    const contactNumber = String(formData.get("contactNumber") || registration.contactNumber);
    if (!isValidContactNumber(contactNumber)) {
      return NextResponse.json({ error: "Contact number can contain numbers only." }, { status: 400 });
    }

    const frontFile = getOptionalFile(formData, "frontFile");
    const backFile = getOptionalFile(formData, "backFile");
    const residencyFile = getOptionalFile(formData, "residencyFile");
    const photoFile = getOptionalFile(formData, "photoFile");
    const birthCertificateFile = getOptionalFile(formData, "birthCertificateFile");
    const files: Array<{ field: string; suffix: DocumentSuffix; file: File }> = [];
    if (frontFile) files.push({ field: "frontFile", suffix: "front", file: frontFile });
    if (backFile) files.push({ field: "backFile", suffix: "back", file: backFile });
    if (residencyFile) files.push({ field: "residencyFile", suffix: "residency", file: residencyFile });
    if (photoFile) files.push({ field: "photoFile", suffix: "photo", file: photoFile });
    if (birthCertificateFile) files.push({ field: "birthCertificateFile", suffix: "birth-certificate", file: birthCertificateFile });

    for (const { field, file } of files) {
      const allowedTypes = field === "photoFile"
        ? new Set(["image/png", "image/jpeg", "image/webp"])
        : ALLOWED_TYPES;
      if (!allowedTypes.has(file.type)) {
        return NextResponse.json(
          {
            error: field === "photoFile"
              ? "photoFile must be a JPG, PNG, or WEBP image."
              : `${field} must be a PDF, JPG, PNG, or WEBP file.`,
          },
          { status: 400 },
        );
      }
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: "Each file must be less than 10MB." }, { status: 400 });
      }
    }

    if ((!frontFile && !registration.idFrontFileUrl) || (!backFile && !registration.idBackFileUrl)) {
      return NextResponse.json({ error: "Please upload both the front and back of your valid ID." }, { status: 400 });
    }
    if (!residencyFile && !registration.idSingleFileUrl) {
      return NextResponse.json({ error: "Please upload your Certificate of Residency." }, { status: 400 });
    }
    if (!photoFile && !registration.photoFileUrl) {
      return NextResponse.json({ error: "Please upload your 2x2 ID picture." }, { status: 400 });
    }
    if (!birthCertificateFile && !registration.birthCertificateFileUrl) {
      return NextResponse.json({ error: "Please upload your Birth Certificate." }, { status: 400 });
    }

    const updatedFileUrls: Partial<Record<DocumentSuffix, string>> = {};
    for (const { suffix, file } of files) {
      updatedFileUrls[suffix] = await uploadFile(user.id, file, suffix);
    }

    const frontFileUrl = updatedFileUrls.front ?? registration.idFrontFileUrl;
    const backFileUrl = updatedFileUrls.back ?? registration.idBackFileUrl;
    const residencyFileUrl = updatedFileUrls.residency ?? registration.idSingleFileUrl;
    const photoFileUrl = updatedFileUrls.photo ?? registration.photoFileUrl;
    const birthCertificateFileUrl = updatedFileUrls["birth-certificate"] ?? registration.birthCertificateFileUrl;
    if (!frontFileUrl || !backFileUrl) {
      return NextResponse.json({ error: "Please upload both the front and back of your valid ID." }, { status: 400 });
    }
    if (!residencyFileUrl) {
      return NextResponse.json({ error: "Please upload your Certificate of Residency." }, { status: 400 });
    }
    if (!photoFileUrl) {
      return NextResponse.json({ error: "Please upload your 2x2 ID picture." }, { status: 400 });
    }
    if (!birthCertificateFileUrl) {
      return NextResponse.json({ error: "Please upload your Birth Certificate." }, { status: 400 });
    }

    const updateData: Prisma.ProfilingRegistrationUpdateInput = {
      fullName: String(formData.get("fullName") || registration.fullName),
      address: String(formData.get("address") || registration.address),
      sex: String(formData.get("sex") || registration.sex),
      age: Number(formData.get("age") ?? registration.age),
      birthDate: new Date(String(formData.get("birthDate") || registration.birthDate.toISOString().slice(0, 10))),
      email: String(formData.get("email") || registration.email),
      facebook: String(formData.get("facebook") || registration.facebook),
      contactNumber,
      civilStatus: String(formData.get("civilStatus") || registration.civilStatus),
      youthClassification: String(formData.get("youthClassification") || registration.youthClassification),
      youthAgeGroup: String(formData.get("youthAgeGroup") || registration.youthAgeGroup),
      workStatus: String(formData.get("workStatus") || registration.workStatus),
      educationalBackground: String(formData.get("educationalBackground") || registration.educationalBackground),
      registeredSKVoter: String(formData.get("registeredSKVoter") || registration.registeredSKVoter),
      votedLastSK: String(formData.get("votedLastSK") || registration.votedLastSK),
      registeredNationalVoter: String(formData.get("registeredNationalVoter") || registration.registeredNationalVoter),
      attendedKKAssembly: String(formData.get("attendedKKAssembly") || registration.attendedKKAssembly),
      assemblyTimes: formData.get("assemblyTimes")
        ? String(formData.get("assemblyTimes"))
        : registration.assemblyTimes,
      noAssemblyReason: formData.get("noAssemblyReason")
        ? String(formData.get("noAssemblyReason"))
        : registration.noAssemblyReason,
      idDocumentType: "2x2 ID Picture + Birth Certificate + Valid ID + Certificate of Residency",
      reviewStatus: "Resubmitted",
      submittedAt: new Date(),
    };

    if (updatedFileUrls.front) updateData.idFrontFileUrl = updatedFileUrls.front;
    if (updatedFileUrls.back) updateData.idBackFileUrl = updatedFileUrls.back;
    if (updatedFileUrls.residency) updateData.idSingleFileUrl = updatedFileUrls.residency;
    if (updatedFileUrls.photo) updateData.photoFileUrl = updatedFileUrls.photo;
    if (updatedFileUrls["birth-certificate"]) {
      updateData.birthCertificateFileUrl = updatedFileUrls["birth-certificate"];
    }

    const updated = await prisma.profilingRegistration.update({
      where: { id: registration.id },
      data: updateData,
    });

    return NextResponse.json({
      ...updated,
      submittedAt: updated.submittedAt.toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;
    console.error("Failed to resubmit KK Profiling registration:", stack ?? error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
