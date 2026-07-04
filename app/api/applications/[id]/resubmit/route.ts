import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeUploadedFiles } from "@/lib/skeap-upload";

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params?.id;
  const body = await request.json().catch(() => null);

  if (!body || !Array.isArray(body.urls) || !Array.isArray(body.replacements) || typeof body.message !== "string") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reviewThreadUpdate = await prisma.inquiry.findUnique({
    where: { id },
    select: { reviewThread: true, applicationId: true },
  });

  const existingThread = Array.isArray(reviewThreadUpdate?.reviewThread) ? reviewThreadUpdate!.reviewThread : [];
  const newEntry = {
    id: crypto.randomUUID(),
    role: "applicant",
    createdAt: new Date().toISOString(),
    text: body.message,
    attachments: body.replacements.map((replacement: any) => ({
      fileId: replacement.fileUrl,
      fileName: replacement.fileName,
      fileUrl: replacement.fileUrl,
      fileType: replacement.fileType,
      adminRemark: "Applicant replacement upload",
    })),
  };

  const inquiry = await prisma.inquiry.update({
    where: { id },
    data: {
      isResolved: false,
      response: "Applicant resubmitted files for review.",
      reviewStatus: "Resubmitted",
      lastUpdatedBy: "applicant",
      resubmittedAt: new Date(),
      reviewThread: [...existingThread, newEntry],
    },
  });

  // If this inquiry is linked to a SKEAP application, update the application's uploadedFiles
  try {
    const appId = reviewThreadUpdate?.applicationId;
    if (appId && Array.isArray(body.replacements) && body.replacements.length > 0) {
      const updatedUploadedFiles: Record<string, { url?: string; name?: string }> = {};
      for (const r of body.replacements) {
        if (r && r.slotId) {
          updatedUploadedFiles[r.slotId] = { url: r.fileUrl, name: r.fileName };
        }
      }
      // Merge with existing uploadedFiles if present
      try {
        const existingApp = await prisma.skeapApplication.findUnique({ where: { id: appId }, select: { uploadedFiles: true } });
        let merged: any = updatedUploadedFiles;
        if (existingApp?.uploadedFiles) {
          const existingRaw = typeof existingApp.uploadedFiles === "string" ? JSON.parse(existingApp.uploadedFiles) : existingApp.uploadedFiles;
          const existing = normalizeUploadedFiles(existingRaw);
          if (existing && typeof existing === "object") {
            merged = { ...existing, ...updatedUploadedFiles };
          }
        }
        await prisma.skeapApplication.update({ where: { id: appId }, data: { uploadedFiles: merged } });
      } catch (e) {
        console.error("Failed to update SkeapApplication.uploadedFiles:", e);
      }
    }
  } catch (e) {
    console.error("Error while attempting to sync resubmitted files to application:", e);
  }

  return NextResponse.json({ inquiry });
}
