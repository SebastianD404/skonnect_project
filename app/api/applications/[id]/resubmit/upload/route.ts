import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { isSkeapApplicationRejected, isSkeapApplicationReturned } from "@/lib/skeap-applications";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { CORE_UPLOAD_KEYS, mergeSkeapDraftReplacement } from "@/lib/skeap-upload";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);
const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: "Application ID is required." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
    }

    const appUser = await ensureProfile(user);
    if (!appUser) {
      return NextResponse.json({ error: "User profile not found." }, { status: 401 });
    }

    const inquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: { userId: true, reviewStatus: true, applicationId: true },
    });
    if (!inquiry) {
      return NextResponse.json({ error: "Application not found." }, { status: 404 });
    }
    if (inquiry.userId !== appUser.id) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }
    if (isSkeapApplicationRejected(inquiry.reviewStatus)) {
      return NextResponse.json(
        { error: "This application has been rejected and cannot be resubmitted." },
        { status: 409 }
      );
    }
    if (!isSkeapApplicationReturned(inquiry.reviewStatus)) {
      return NextResponse.json(
        { error: "This application can only be resubmitted after it has been returned for edits." },
        { status: 409 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    const slotId = formData.get("slotId");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided." }, { status: 400 });
    }
    if (typeof slotId !== "string" || !CORE_UPLOAD_KEYS.includes(slotId as (typeof CORE_UPLOAD_KEYS)[number])) {
      return NextResponse.json({ error: "A valid document type is required." }, { status: 400 });
    }
    if (!inquiry.applicationId) {
      return NextResponse.json({ error: "The linked application document record could not be found." }, { status: 409 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: "Only PDF, DOC/DOCX, PNG, JPG, and WEBP files are allowed." },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File size must not exceed 15MB." }, { status: 400 });
    }

    const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "") || "upload";
    const filePath = `skeap-applications/${user.id}/${Date.now()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("public image")
      .upload(filePath, await file.arrayBuffer(), {
        contentType: file.type,
        cacheControl: "3600",
        upsert: false,
      });
    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data } = supabase.storage.from("public image").getPublicUrl(filePath);
    if (!data.publicUrl) {
      const { error: cleanupError } = await supabase.storage.from("public image").remove([filePath]);
      if (cleanupError) console.error("Failed to remove unreferenced SKEAP replacement upload:", cleanupError);
      return NextResponse.json({ error: "Failed to generate file URL." }, { status: 500 });
    }

    let result: "saved" | "status-changed" | "missing-application";
    try {
      result = await prisma.$transaction(async (tx) => {
        const currentInquiry = await tx.inquiry.findUnique({
          where: { id },
          select: { userId: true, reviewStatus: true, applicationId: true },
        });
        if (
          !currentInquiry ||
          currentInquiry.userId !== appUser.id ||
          currentInquiry.reviewStatus !== inquiry.reviewStatus ||
          currentInquiry.applicationId !== inquiry.applicationId ||
          !isSkeapApplicationReturned(currentInquiry.reviewStatus) ||
          isSkeapApplicationRejected(currentInquiry.reviewStatus)
        ) {
          return "status-changed";
        }

        const currentApplication = await tx.skeapApplication.findUnique({
          where: { id: inquiry.applicationId! },
          select: { uploadedFiles: true },
        });
        if (!currentApplication) return "missing-application";

        const uploadedFiles = mergeSkeapDraftReplacement(currentApplication.uploadedFiles, {
          slotId,
          fileUrl: data.publicUrl,
          fileName: file.name,
          fileType: file.type,
        });
        await tx.skeapApplication.update({
          where: { id: inquiry.applicationId! },
          data: { uploadedFiles },
        });
        return "saved";
      });
    } catch (error) {
      const { error: cleanupError } = await supabase.storage.from("public image").remove([filePath]);
      if (cleanupError) console.error("Failed to remove unreferenced SKEAP replacement upload:", cleanupError);
      throw error;
    }

    if (result !== "saved") {
      const { error: cleanupError } = await supabase.storage.from("public image").remove([filePath]);
      if (cleanupError) console.error("Failed to remove unreferenced SKEAP replacement upload:", cleanupError);
      return result === "missing-application"
        ? NextResponse.json({ error: "The linked application document record could not be found." }, { status: 409 })
        : NextResponse.json({ error: "The application status changed. Refresh the page and try again." }, { status: 409 });
    }

    return NextResponse.json({ success: true, url: data.publicUrl, fileName: file.name, fileType: file.type });
  } catch (error) {
    console.error("SKEAP replacement upload failed:", error);
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
