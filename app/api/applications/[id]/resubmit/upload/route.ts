import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { isSkeapApplicationRejected, isSkeapApplicationReturned } from "@/lib/skeap-applications";
import { removePrivateDocument, uploadPrivateDocument } from "@/lib/private-documents";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  CORE_UPLOAD_KEYS,
  isClientGradeOcrStatus,
  isGradeReportDiagnostics,
  MAX_SKEAP_UPLOAD_SIZE_BYTES,
  mergeSkeapDraftReplacement,
  SKEAP_UPLOAD_TOO_LARGE_MESSAGE,
} from "@/lib/skeap-upload";
import { refreshSkeapApplicationsAdminView } from "@/lib/application-admin-view-refresh";

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/png",
  "image/jpeg",
  "image/jfif",
  "image/jpg",
  "image/webp",
]);
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
    const fileType = file.type.toLowerCase();
    const isGenericJfif = /\.jfif$/i.test(file.name) &&
      (!fileType || fileType === "application/octet-stream");
    if (!ALLOWED_TYPES.has(fileType) && !isGenericJfif) {
      return NextResponse.json(
        { error: "Only PDF, DOC/DOCX, PNG, JPG/JFIF, and WEBP files are allowed." },
        { status: 400 }
      );
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }
    if (file.size > MAX_SKEAP_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: SKEAP_UPLOAD_TOO_LARGE_MESSAGE }, { status: 400 });
    }
    let gradeDiagnostics: import("@/lib/grade-report-parser").GradeReportDiagnostics | null | undefined;
    let ocrStatus: "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED" | undefined;
    if (slotId === "gradeReport") {
      const diagnosticsValue = formData.get("gradeDiagnostics");
      const statusValue = formData.get("ocrStatus");
      if (typeof diagnosticsValue !== "string" || typeof statusValue !== "string") {
        return NextResponse.json(
          { error: "Grade Report OCR results are required for replacement uploads." },
          { status: 400 },
        );
      }
      try {
        gradeDiagnostics = JSON.parse(diagnosticsValue);
      } catch {
        return NextResponse.json({ error: "Grade Report OCR results are invalid." }, { status: 400 });
      }
      if (
        (gradeDiagnostics !== null && !isGradeReportDiagnostics(gradeDiagnostics)) ||
        !isClientGradeOcrStatus(statusValue)
      ) {
        return NextResponse.json({ error: "Grade Report OCR results are invalid." }, { status: 400 });
      }
      ocrStatus = statusValue;
    }

    const storedFile = fileType === "image/jfif" || isGenericJfif
      ? new File([file], file.name, { type: "image/jpeg", lastModified: file.lastModified })
      : file;
    const { path: filePath, url: fileUrl } = await uploadPrivateDocument(
      user.id,
      storedFile,
      "skeap-applications",
    );

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
          fileUrl,
          fileName: file.name,
          fileType: storedFile.type,
          ...(slotId === "gradeReport" ? { gradeDiagnostics, ocrStatus } : {}),
        });
        await tx.skeapApplication.update({
          where: { id: inquiry.applicationId! },
          data: { uploadedFiles },
        });
        return "saved";
      });
    } catch (error) {
      try {
        await removePrivateDocument(filePath);
      } catch (cleanupError) {
        console.error("Failed to remove unreferenced private SKEAP replacement upload:", cleanupError);
      }
      throw error;
    }

    if (result !== "saved") {
      try {
        await removePrivateDocument(filePath);
      } catch (cleanupError) {
        console.error("Failed to remove unreferenced private SKEAP replacement upload:", cleanupError);
      }
      return result === "missing-application"
        ? NextResponse.json({ error: "The linked application document record could not be found." }, { status: 409 })
        : NextResponse.json({ error: "The application status changed. Refresh the page and try again." }, { status: 409 });
    }

    await refreshSkeapApplicationsAdminView();
    return NextResponse.json({
      success: true,
      url: fileUrl,
      fileName: file.name,
      fileType: storedFile.type,
      ...(slotId === "gradeReport" ? { gradeDiagnostics, ocrStatus } : {}),
    });
  } catch (error) {
    console.error("SKEAP replacement upload failed:", error);
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
