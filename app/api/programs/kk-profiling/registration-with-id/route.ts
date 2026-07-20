import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg", "image/jpg", "image/webp"]);

function isImageType(type: string) {
  return type.startsWith("image/");
}

async function uploadFile(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, file: File, suffix: string) {
  const safeFileName = String(file.name)
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .slice(0, 200);
  const path = `kk-verification/${userId}/${Date.now()}-${suffix}-${safeFileName}`;
  const fileBuffer = await file.arrayBuffer();

  const { error: uploadError } = await supabase.storage.from("public image").upload(path, fileBuffer, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { data: publicUrlData } = await supabase.storage.from("public image").getPublicUrl(path);
  return publicUrlData?.publicUrl ?? null;
}

export async function PUT(request: NextRequest) {
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

  const payload = {
    fullName: String(formData.get("fullName") || registration.fullName),
    address: String(formData.get("address") || registration.address),
    sex: String(formData.get("sex") || registration.sex),
    age: Number(formData.get("age") ?? registration.age),
    birthDate: String(formData.get("birthDate") || registration.birthDate.toISOString().slice(0, 10)),
    email: String(formData.get("email") || registration.email),
    facebook: String(formData.get("facebook") || registration.facebook),
    contactNumber: String(formData.get("contactNumber") || registration.contactNumber),
    civilStatus: String(formData.get("civilStatus") || registration.civilStatus),
    youthClassification: String(formData.get("youthClassification") || registration.youthClassification),
    youthAgeGroup: String(formData.get("youthAgeGroup") || registration.youthAgeGroup),
    workStatus: String(formData.get("workStatus") || registration.workStatus),
    educationalBackground: String(formData.get("educationalBackground") || registration.educationalBackground),
    registeredSKVoter: String(formData.get("registeredSKVoter") || registration.registeredSKVoter),
    votedLastSK: String(formData.get("votedLastSK") || registration.votedLastSK),
    registeredNationalVoter: String(formData.get("registeredNationalVoter") || registration.registeredNationalVoter),
    attendedKKAssembly: String(formData.get("attendedKKAssembly") || registration.attendedKKAssembly),
    assemblyTimes: formData.get("assemblyTimes") ? String(formData.get("assemblyTimes")) : registration.assemblyTimes,
    noAssemblyReason: formData.get("noAssemblyReason") ? String(formData.get("noAssemblyReason")) : registration.noAssemblyReason,
  };

  const uploads: Array<{ label: string; file: File }> = [];
  const frontFile = formData.get("frontFile") as File | null;
  const backFile = formData.get("backFile") as File | null;
  const residencyFile = formData.get("residencyFile") as File | null;
  const residencyStatementAcknowledgement = formData.get("residencyStatementConfirmed") === "true";

  if (frontFile && !backFile) {
    return NextResponse.json({ error: "Please upload both the front and back of your valid ID." }, { status: 400 });
  }
  if (backFile && !frontFile) {
    return NextResponse.json({ error: "Please upload both the front and back of your valid ID." }, { status: 400 });
  }

  if (!residencyFile && !registration.idSingleFileUrl) {
    return NextResponse.json({ error: "Please upload your Certificate of Residency." }, { status: 400 });
  }

  if (residencyFile && !residencyStatementAcknowledgement) {
    return NextResponse.json(
      { error: "Please confirm that your Certificate of Residency states you have lived in the barangay for at least 8 months." },
      { status: 400 }
    );
  }

  if (frontFile && backFile) {
    uploads.push({ label: "front", file: frontFile });
    uploads.push({ label: "back", file: backFile });
  } else if (!registration.idFrontFileUrl || !registration.idBackFileUrl) {
    return NextResponse.json({ error: "Please upload both the front and back of your valid ID." }, { status: 400 });
  }

  if (residencyFile) {
    uploads.push({ label: "residency", file: residencyFile });
  }

  const uploadResults: Record<string, string | null> = {
    front: registration.idFrontFileUrl,
    back: registration.idBackFileUrl,
    residency: registration.idSingleFileUrl,
  };

  for (const upload of uploads) {
    if (!ALLOWED_TYPES.has(upload.file.type)) {
      return NextResponse.json({ error: "Only PDF, JPG, PNG, and WEBP files are allowed." }, { status: 400 });
    }

    if (upload.file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "Each file must be less than 10MB." }, { status: 400 });
    }

    const url = await uploadFile(supabase, user.id, upload.file, upload.label);
    uploadResults[upload.label] = url;
  }

  const updated = await prisma.profilingRegistration.update({
    where: { id: registration.id },
    data: {
      ...payload,
      birthDate: new Date(payload.birthDate),
      idDocumentType: "Valid ID + Certificate of Residency",
      idFrontFileUrl: uploadResults.front,
      idBackFileUrl: uploadResults.back,
      idSingleFileUrl: uploadResults.residency,
      residencyStatementAcknowledgement: residencyFile
        ? residencyStatementAcknowledgement
        : registration.residencyStatementAcknowledgement,
      reviewStatus: "Resubmitted",
    },
  });

  return NextResponse.json({
    ...updated,
    submittedAt: updated.submittedAt.toISOString(),
  });
}
