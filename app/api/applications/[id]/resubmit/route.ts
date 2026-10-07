import { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  buildSkeapResubmissionActivity,
  CORE_UPLOAD_KEYS,
  getPendingSkeapDraftReplacements,
  mergeSkeapResubmittedFiles,
} from "@/lib/skeap-upload";
import { ensureProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isSkeapApplicationRejected, isSkeapApplicationReturned } from "@/lib/skeap-applications";

type ReplacementUpload = {
  slotId: string;
  fileUrl: string;
  fileName: string;
  fileType: string;
};

type ResubmissionBody = {
  urls: string[];
  replacements: ReplacementUpload[];
  message: string;
};

function isResubmissionBody(value: unknown): value is ResubmissionBody {
  if (typeof value !== "object" || value === null) return false;

  const body = value as Record<string, unknown>;
  return (
    Array.isArray(body.urls) &&
    body.urls.every((url) => typeof url === "string") &&
    Array.isArray(body.replacements) &&
    body.replacements.length > 0 &&
    body.replacements.every(
      (replacement) =>
        typeof replacement === "object" &&
        replacement !== null &&
        "slotId" in replacement &&
        typeof replacement.slotId === "string" &&
        CORE_UPLOAD_KEYS.includes(replacement.slotId as (typeof CORE_UPLOAD_KEYS)[number]) &&
        "fileUrl" in replacement &&
        typeof replacement.fileUrl === "string" &&
        "fileName" in replacement &&
        typeof replacement.fileName === "string" &&
        "fileType" in replacement &&
        typeof replacement.fileType === "string"
    ) &&
    typeof body.message === "string"
  );
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params?.id;
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
    return NextResponse.json({ error: "User not found." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  if (!isResubmissionBody(body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const reviewThreadUpdate = await prisma.inquiry.findUnique({
    where: { id },
    select: { userId: true, reviewThread: true, applicationId: true, reviewStatus: true },
  });
  if (!reviewThreadUpdate) {
    return NextResponse.json({ error: "Application not found." }, { status: 404 });
  }
  if (reviewThreadUpdate.userId !== appUser.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }
  if (isSkeapApplicationRejected(reviewThreadUpdate.reviewStatus)) {
    return NextResponse.json(
      { error: "This application has been rejected and cannot be resubmitted." },
      { status: 409 }
    );
  }
  if (!isSkeapApplicationReturned(reviewThreadUpdate.reviewStatus)) {
    return NextResponse.json(
      { error: "This application can only be resubmitted after it has been returned for edits." },
      { status: 409 }
    );
  }

  if (!reviewThreadUpdate.applicationId) {
    return NextResponse.json(
      { error: "This application is missing its linked document record. Contact the review team." },
      { status: 409 }
    );
  }

  let result:
    | { kind: "success"; inquiry: Awaited<ReturnType<typeof prisma.inquiry.findUniqueOrThrow>> }
    | { kind: "status-changed" }
    | { kind: "missing-documents" }
    | { kind: "no-saved-replacements" };
  try {
    result = await prisma.$transaction(async (tx) => {
      const currentInquiry = await tx.inquiry.findUnique({
        where: { id },
        select: { userId: true, reviewStatus: true, reviewThread: true, applicationId: true },
      });
      if (
        !currentInquiry ||
        currentInquiry.userId !== appUser.id ||
        currentInquiry.reviewStatus !== reviewThreadUpdate.reviewStatus ||
        currentInquiry.applicationId !== reviewThreadUpdate.applicationId
      ) {
        return { kind: "status-changed" as const };
      }

      const currentApplication = await tx.skeapApplication.findUnique({
        where: { id: reviewThreadUpdate.applicationId! },
        select: { uploadedFiles: true },
      });
      if (!currentApplication) return { kind: "missing-documents" as const };

      const replacements = getPendingSkeapDraftReplacements(currentApplication.uploadedFiles);
      if (replacements.length === 0) return { kind: "no-saved-replacements" as const };

      const existingThread = Array.isArray(currentInquiry.reviewThread)
        ? currentInquiry.reviewThread
        : [];
      const newEntry = {
        id: crypto.randomUUID(),
        role: "applicant",
        createdAt: new Date().toISOString(),
        ...buildSkeapResubmissionActivity(replacements),
      };
      const updateResult = await tx.inquiry.updateMany({
        where: { id, userId: appUser.id, reviewStatus: reviewThreadUpdate.reviewStatus },
        data: {
          isResolved: false,
          response: "Applicant resubmitted files for review.",
          reviewStatus: "Resubmitted",
          lastUpdatedBy: "applicant",
          resubmittedAt: new Date(),
          reviewThread: [...existingThread, newEntry] as Prisma.InputJsonArray,
        },
      });
      if (updateResult.count === 0) return { kind: "status-changed" as const };

      const uploadedFiles = mergeSkeapResubmittedFiles(currentApplication.uploadedFiles, replacements);
      await tx.skeapApplication.update({
        where: { id: reviewThreadUpdate.applicationId! },
        data: { uploadedFiles: uploadedFiles as Prisma.InputJsonValue },
      });

      const inquiry = await tx.inquiry.findUniqueOrThrow({ where: { id } });
      return { kind: "success" as const, inquiry };
    });
  } catch (error) {
    console.error("Failed to persist SKEAP resubmission:", error);
    return NextResponse.json(
      { error: "The replacement files could not be saved. Please refresh and try again." },
      { status: 500 }
    );
  }

  if (result.kind === "missing-documents") {
    return NextResponse.json(
      { error: "The linked application document record could not be found." },
      { status: 409 }
    );
  }
  if (result.kind === "no-saved-replacements") {
    return NextResponse.json(
      { error: "No saved replacement files were found. Upload the files again before resubmitting." },
      { status: 409 }
    );
  }
  if (result.kind === "status-changed") {
    const currentInquiry = await prisma.inquiry.findUnique({
      where: { id },
      select: { reviewStatus: true },
    });
    if (isSkeapApplicationRejected(currentInquiry?.reviewStatus)) {
      return NextResponse.json(
        { error: "This application has been rejected and cannot be resubmitted." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "The application status changed. Refresh the page and try again." },
      { status: 409 }
    );
  }

  return NextResponse.json({ inquiry: result.inquiry });
}
