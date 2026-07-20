import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

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
  const publicUrl = publicUrlData?.publicUrl;

  return { path, url: publicUrl ?? null };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const frontFile = formData.get("frontFile") as File | null;
    const backFile = formData.get("backFile") as File | null;
    const residencyFile = formData.get("residencyFile") as File | null;
    const residencyStatementConfirmed = formData.get("residencyStatementConfirmed") === "true";

    const uploads: Array<{ label: string; file: File }> = [];

    if (!frontFile || !backFile) {
      return NextResponse.json(
        { error: "Please upload both the front and back of your valid ID." },
        { status: 400 }
      );
    }

    if (!residencyFile) {
      return NextResponse.json(
        { error: "Please upload your Certificate of Residency." },
        { status: 400 }
      );
    }

    if (!residencyStatementConfirmed) {
      return NextResponse.json(
        { error: "Please confirm that your Certificate of Residency states you have lived in the barangay for at least 8 months." },
        { status: 400 }
      );
    }

    if (!isImageType(frontFile.type) || !isImageType(backFile.type)) {
      return NextResponse.json(
        { error: "Valid ID uploads must be image files (JPG, PNG, or WEBP)." },
        { status: 400 }
      );
    }

    uploads.push({ label: "front", file: frontFile });
    uploads.push({ label: "back", file: backFile });
    uploads.push({ label: "residency", file: residencyFile });

    const uploadedFiles: Array<{ label: string; path: string; url: string | null }> = [];

    for (const upload of uploads) {
      if (upload.file.size > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Each file must be less than 10MB." },
          { status: 400 }
        );
      }

      const result = await uploadFile(supabase, user.id, upload.file, upload.label);
      uploadedFiles.push({ label: upload.label, path: result.path, url: result.url });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "KK profiling registration not found." }, { status: 404 });
    }

    const latestRegistration = await prisma.profilingRegistration.findFirst({
      where: { userId: appUser.id },
      orderBy: { submittedAt: "desc" },
    });

    if (!latestRegistration) {
      return NextResponse.json({ error: "KK profiling registration not found." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      reviewStatus: "Resubmitted",
      idDocumentType: "Valid ID + Certificate of Residency",
      residencyStatementAcknowledgement: true,
    };

    updateData.idFrontFileUrl = uploadedFiles.find((file) => file.label === "front")?.url ?? null;
    updateData.idBackFileUrl = uploadedFiles.find((file) => file.label === "back")?.url ?? null;
    updateData.idSingleFileUrl = uploadedFiles.find((file) => file.label === "residency")?.url ?? null;

    const updatedRegistration = await prisma.profilingRegistration.update({
      where: { id: latestRegistration.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      files: uploadedFiles,
      reviewStatus: updatedRegistration.reviewStatus,
      idDocumentType: updatedRegistration.idDocumentType,
      idFrontFileUrl: updatedRegistration.idFrontFileUrl,
      idBackFileUrl: updatedRegistration.idBackFileUrl,
      idSingleFileUrl: updatedRegistration.idSingleFileUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
