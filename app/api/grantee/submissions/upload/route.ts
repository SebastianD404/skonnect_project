import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import {
  COE_MIME_TYPES,
  GRADE_REPORT_MIME_TYPES,
  hasGradeReportSignature,
} from "@/lib/ocr/grade-report-file";
import { createAdminClient } from "@/lib/supabase/admin";
import { SubmissionStatus } from "@prisma/client";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import { detectGranteeTargetTerm, getScheduleSemesterForTargetTerm } from "@/lib/grantee-semester";
import {
  MAX_SKEAP_UPLOAD_SIZE_BYTES,
  SKEAP_UPLOAD_TOO_LARGE_MESSAGE,
} from "@/lib/skeap-upload";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const appUser = await prisma.user.findFirst({
      where: { authId: user.id, isActive: true },
      select: { id: true, role: true, grantee: { select: { id: true, status: true } } },
    });
    if (!appUser || appUser.role !== "GRANTEE" || !appUser.grantee) {
      return NextResponse.json({ error: "Only grantee accounts can upload submission documents." }, { status: 403 });
    }
    if (appUser.grantee.status === "GRADUATED") {
      return NextResponse.json({ error: "Graduated scholar records are locked for statutory retention." }, { status: 409 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const kind = formData.get("kind");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (kind !== "grade" && kind !== "coe") {
      return NextResponse.json({ error: "Document kind must be grade or coe." }, { status: 400 });
    }

    const detectedTerm = await detectGranteeTargetTerm(appUser.id);
    if (!detectedTerm) {
      return NextResponse.json(
        { error: "Your next requirement term could not be detected. Please contact SK admin." },
        { status: 409 }
      );
    }
    const [termState, existing] = await Promise.all([
      getAcademicTermScheduleState(),
      prisma.submission.findFirst({
        where: { granteeId: appUser.grantee.id, semester: detectedTerm.termLabel },
        select: { status: true, flaggedFields: true, reviewedById: true, reviewedAt: true },
      }),
    ]);
    if (
      existing?.status === SubmissionStatus.AWAITING_PHYSICAL_CTC ||
      existing?.status === SubmissionStatus.APPROVED
    ) {
      return NextResponse.json(
        { error: "Your submission for this term has already passed initial review and cannot be overwritten." },
        { status: 409 }
      );
    }
    const canReplaceUnlockedPending =
      existing?.status === SubmissionStatus.PENDING &&
      !existing.reviewedById &&
      !existing.reviewedAt;
    if (detectedTerm.hasPendingSubmission && !canReplaceUnlockedPending) {
      return NextResponse.json(
        { error: "Your requirements for this term are already under SK Admin review." },
        { status: 409 }
      );
    }
    if (
      existing?.status === SubmissionStatus.PRE_QUALIFIED ||
      (existing?.status === SubmissionStatus.PENDING && !canReplaceUnlockedPending)
    ) {
      return NextResponse.json(
        { error: "Your requirements for this term are already under SK Admin review." },
        { status: 409 }
      );
    }
    const canUploadForOpenTerm =
      termState.window.status === "OPEN" &&
      getScheduleSemesterForTargetTerm(detectedTerm) === termState.window.semester;
    const canUploadReturnedCorrection =
      detectedTerm.isResubmission &&
      existing?.status === SubmissionStatus.RETURNED_FOR_EDIT;
    if (!canUploadForOpenTerm && !canUploadReturnedCorrection) {
      return NextResponse.json(
        { error: "Document uploads are only available during the scheduled submission window or for requested corrections." },
        { status: 400 }
      );
    }

    const submittedContentType = file.type.toLowerCase();
    const isGenericJfif = /\.jfif$/i.test(file.name) &&
      (!submittedContentType || submittedContentType === "application/octet-stream");
    const contentType = submittedContentType === "image/jfif" || isGenericJfif
      ? "image/jpeg"
      : submittedContentType;
    const allowedTypes = kind === "grade" ? GRADE_REPORT_MIME_TYPES : COE_MIME_TYPES;
    if (!allowedTypes.has(submittedContentType) && !isGenericJfif) {
      return NextResponse.json(
        {
          error:
            kind === "grade"
              ? "Grade reports must be PDF, JPG/JFIF, PNG, or WEBP files."
              : "Certificates of Enrollment must be PDF, JPG/JFIF, PNG, or WEBP files.",
        },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json({ error: "The selected file is empty." }, { status: 400 });
    }
    if (file.size > MAX_SKEAP_UPLOAD_SIZE_BYTES) {
      return NextResponse.json({ error: SKEAP_UPLOAD_TOO_LARGE_MESSAGE }, { status: 400 });
    }

    const safeName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
    const filePath = `grantee-submissions/${user.id}/${kind}-${Date.now()}-${randomUUID()}-${safeName}`;
    const buffer = await file.arrayBuffer();
    if (
      kind === "grade" &&
      !hasGradeReportSignature(new Uint8Array(buffer), contentType)
    ) {
      return NextResponse.json(
        { error: "The uploaded file does not match its declared file type." },
        { status: 400 }
      );
    }

    const { error: uploadError } = await createAdminClient()
      .storage.from("grantee-submissions")
      .upload(filePath, buffer, {
        contentType: contentType === "image/jpg" ? "image/jpeg" : contentType,
        cacheControl: "31536000",
        upsert: true,
      });

    if (uploadError) {
      console.error("Could not save grantee requirement document to storage.", uploadError);
      return NextResponse.json(
        { error: "We couldn't save this document securely. Please try uploading it again." },
        { status: 503 }
      );
    }

    return NextResponse.json({
      success: true,
      path: filePath,
      kind,
      semester: detectedTerm.termLabel,
    });
  } catch (error) {
    console.error("Grantee requirement file upload failed.", error);
    return NextResponse.json(
      { error: "We couldn't upload this document right now. Please try again." },
      { status: 500 }
    );
  }
}
