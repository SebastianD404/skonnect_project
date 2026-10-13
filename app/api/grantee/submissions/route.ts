import { NextRequest, NextResponse } from "next/server";
import { SubmissionOcrStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGranteeProfileComplete } from "@/lib/grantee-profile";
import { analyzeSubmissionOcr } from "@/lib/ocr/process-submission";
import { getCurrentAcademicSemester, isAllowedAcademicSemester } from "@/lib/semester-progress";

export const runtime = "nodejs";
export const maxDuration = 300;

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
      where: {
        OR: [{ authId: user.id }, { email: user.email ?? "" }],
      },
      include: { grantee: true },
    });

    if (appUser && appUser.authId !== user.id) {
      try {
        await prisma.user.update({
          where: { id: appUser.id },
          data: { authId: user.id },
        });
      } catch {
        // Ignore relink failures; request can proceed with resolved user.
      }
    }

    if (!appUser || appUser.role !== "GRANTEE" || !appUser.grantee) {
      return NextResponse.json({ error: "Only grantee accounts can submit documents" }, { status: 403 });
    }
    if (appUser.grantee.status === "GRADUATED") {
      return NextResponse.json({ error: "Graduated scholar records are locked for statutory retention." }, { status: 409 });
    }

    if (!isGranteeProfileComplete(appUser.grantee)) {
      return NextResponse.json(
        {
          error:
            "Complete your grantee profile (school and year level) in Profile settings before submitting documents.",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const semester = String(body.semester ?? "").trim();
    const gradeFileUrl = String(body.gradeFileUrl ?? "").trim();
    const coeFileUrl = String(body.coeFileUrl ?? "").trim();
    const forceSubmit = body.forceSubmit === true;

    if (!isAllowedAcademicSemester(semester) || semester !== getCurrentAcademicSemester()) {
      return NextResponse.json(
        { error: "Submissions are only accepted for the current academic semester." },
        { status: 400 }
      );
    }

    const existing = await prisma.submission.findFirst({
      where: {
        granteeId: appUser.grantee.id,
        semester,
      },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        status: true,
        gradeFileUrl: true,
        coeFileUrl: true,
        flaggedFields: true,
        reviewNotes: true,
      },
    });

    const mergedGradeFileUrl = gradeFileUrl || existing?.gradeFileUrl || "";
    const mergedCoeFileUrl = coeFileUrl || existing?.coeFileUrl || "";

    if (!mergedGradeFileUrl || !mergedCoeFileUrl) {
      return NextResponse.json(
        { error: "Both a grade report and Certificate of Enrollment are required." },
        { status: 400 }
      );
    }

    // Only block if submission is fully completed (both COE and grades approved)
    if (existing?.status === "APPROVED" && existing?.gradeFileUrl) {
      return NextResponse.json(
        { error: "An approved submission for this semester cannot be modified." },
        { status: 409 }
      );
    }

    const ocrAnalysis = await analyzeSubmissionOcr(
      mergedGradeFileUrl,
      mergedCoeFileUrl,
      user.id
    );
    if (
      !forceSubmit &&
      (!ocrAnalysis.documentValidation.certificateOfEnrollment ||
        !ocrAnalysis.documentValidation.gradeReport)
    ) {
      return NextResponse.json(
        {
          requiresOverride: true,
          error:
            "We couldn't detect the required academic information in your documents. Please check that both files are clear and correct. You can still proceed for manual review.",
        },
        { status: 422 }
      );
    }

    const resolvedFlaggedFields = new Set<string>();

    if (existing?.status === "RETURNED_FOR_EDIT") {
      if (gradeFileUrl && existing.flaggedFields.includes("GRADE_REPORT")) {
        resolvedFlaggedFields.add("GRADE_REPORT");
      }
      if (coeFileUrl && existing.flaggedFields.includes("COE")) {
        resolvedFlaggedFields.add("COE");
      }
    }

    const nextFlaggedFields = existing?.status === "RETURNED_FOR_EDIT"
      ? existing.flaggedFields.filter((field) => !resolvedFlaggedFields.has(field))
      : [];
    const payload = {
      semester,
      gradeFileUrl: mergedGradeFileUrl,
      coeFileUrl: mergedCoeFileUrl,
      status:
        existing?.status === "RETURNED_FOR_EDIT" && nextFlaggedFields.length > 0
          ? SubmissionStatus.RETURNED_FOR_EDIT
          : SubmissionStatus.PENDING,
      reviewNotes: nextFlaggedFields.length > 0 ? existing?.reviewNotes : null,
      flaggedFields: nextFlaggedFields,
      ocrStatus: forceSubmit ? SubmissionOcrStatus.OCR_NEEDS_REVIEW : ocrAnalysis.status,
      ocrRawText: ocrAnalysis.rawText,
      ocrParsedRows: {
        rows: ocrAnalysis.parsed.rows,
        unrecognizedRows: ocrAnalysis.parsed.unrecognizedRows,
        documentValidation: ocrAnalysis.documentValidation,
        forcedManualReview: forceSubmit,
      },
      ocrGwa: ocrAnalysis.parsed.gwa,
      ocrTotalUnits: ocrAnalysis.parsed.totalUnits,
      ocrConfidence: ocrAnalysis.confidence,
      reviewedAt: null,
      submittedAt: new Date(),
    };

    const submission = existing
      ? await prisma.submission.update({
          where: { id: existing.id },
          data: payload,
        })
      : await prisma.submission.create({
          data: {
            ...payload,
            granteeId: appUser.grantee.id,
          },
        });

    const submissionForGrantee = {
      id: submission.id,
      granteeId: submission.granteeId,
      semester: submission.semester,
      gradeFileUrl: submission.gradeFileUrl,
      coeFileUrl: submission.coeFileUrl,
      status: submission.status,
      reviewedById: submission.reviewedById,
      reviewNotes: submission.reviewNotes,
      submittedAt: submission.submittedAt,
      reviewedAt: submission.reviewedAt,
      flaggedFields: submission.flaggedFields,
      coeStatus: submission.coeStatus,
      gradesStatus: submission.gradesStatus,
      coeSubmittedAt: submission.coeSubmittedAt,
      coeApprovedAt: submission.coeApprovedAt,
      gradesSubmittedAt: submission.gradesSubmittedAt,
      gradesApprovedAt: submission.gradesApprovedAt,
    };

    return NextResponse.json({ success: true, submission: submissionForGrantee });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to submit documents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
