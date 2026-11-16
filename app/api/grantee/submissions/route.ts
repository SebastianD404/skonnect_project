import { after, NextRequest, NextResponse } from "next/server";
import { Prisma, SubmissionOcrStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGranteeProfileComplete } from "@/lib/grantee-profile";
import { processSubmissionGradeReportOcr } from "@/lib/ocr/process-submission";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import { detectGranteeTargetTerm, getScheduleSemesterForTargetTerm } from "@/lib/grantee-semester";

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
        authId: user.id,
        isActive: true,
      },
      include: { grantee: true },
    });

    if (!appUser || appUser.role !== "GRANTEE" || !appUser.grantee) {
      return NextResponse.json({ error: "Only grantee accounts can submit documents" }, { status: 403 });
    }
    const granteeId = appUser.grantee.id;
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
    const gradeFileUrl = String(body.gradeFileUrl ?? "").trim();
    const coeFileUrl = String(body.coeFileUrl ?? "").trim();
    const forceSubmit = body.forceSubmit === true;
    const clientRequiresStrictManualReview = body.requiresStrictManualReview === true;

    const detectedTerm = await detectGranteeTargetTerm(appUser.id);
    if (!detectedTerm) {
      return NextResponse.json(
        { error: "Your next requirement term could not be detected. Please contact SK admin." },
        { status: 409 }
      );
    }
    const semester = detectedTerm.termLabel;

    const existing = await prisma.submission.findFirst({
      where: {
        granteeId,
        semester,
      },
      orderBy: { submittedAt: "desc" },
      select: {
        id: true,
        semester: true,
        status: true,
        gradeFileUrl: true,
        coeFileUrl: true,
        flaggedFields: true,
        resubmittedFields: true,
        reviewNotes: true,
        requiresStrictManualReview: true,
        reviewedById: true,
        reviewedAt: true,
      },
    });

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

    const { window: termWindow } = await getAcademicTermScheduleState();
    if (
      existing?.status === SubmissionStatus.PRE_QUALIFIED ||
      (existing?.status === SubmissionStatus.PENDING && !canReplaceUnlockedPending)
    ) {
      return NextResponse.json(
        { error: "Your requirements for this term are already under SK Admin review." },
        { status: 409 }
      );
    }
    const canSubmitInOpenWindow =
      termWindow.status === "OPEN" &&
      getScheduleSemesterForTargetTerm(detectedTerm) === termWindow.semester;
    const canCorrectReturnedSubmission =
      existing?.semester === semester &&
      existing.status === SubmissionStatus.RETURNED_FOR_EDIT;

    if (!canSubmitInOpenWindow && !canCorrectReturnedSubmission) {
      const error =
        termWindow.status === "UNCONFIGURED"
          ? "Academic document submissions are not scheduled yet. Please check back later."
          : termWindow.status === "UPCOMING"
            ? `Submissions for ${termWindow.semester} open at the scheduled time.`
            : termWindow.status === "CLOSED"
              ? `The submission window for ${termWindow.semester} is closed.`
              : "Submissions are only accepted for the currently open academic term.";
      return NextResponse.json({ error }, { status: 400 });
    }

    const mergedGradeFileUrl = gradeFileUrl || existing?.gradeFileUrl || "";
    const mergedCoeFileUrl = coeFileUrl || existing?.coeFileUrl || "";

    if (!mergedGradeFileUrl || !mergedCoeFileUrl) {
      return NextResponse.json(
        { error: "Both a grade report and Certificate of Enrollment are required." },
        { status: 400 }
      );
    }

    const gradeFileChanged = !existing || mergedGradeFileUrl !== existing.gradeFileUrl;
    const requiresStrictManualReview = gradeFileChanged
      ? clientRequiresStrictManualReview
      : existing.requiresStrictManualReview ||
        clientRequiresStrictManualReview;

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
    const nextResubmittedFields = Array.from(
      new Set([...(existing?.resubmittedFields ?? []), ...resolvedFlaggedFields])
    );
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
      resubmittedFields: nextResubmittedFields,
      ...(resolvedFlaggedFields.has("COE") ? { coeStatus: SubmissionStatus.PENDING } : {}),
      ...(resolvedFlaggedFields.has("GRADE_REPORT") ? { gradesStatus: SubmissionStatus.PENDING } : {}),
      ocrStatus: SubmissionOcrStatus.OCR_PENDING,
      ocrRawText: "",
      ocrParsedRows: {
        rows: [],
        unrecognizedRows: [],
        documentValidation: {
          certificateOfEnrollment: false,
          gradeReport: false,
        },
        forcedManualReview: forceSubmit,
      },
      ocrGwa: null,
      ocrTotalUnits: null,
      ocrConfidence: null,
      requiresStrictManualReview,
      reviewedAt: null,
      reviewedById: null,
      submittedAt: new Date(),
    };

    const submission = await prisma.$transaction(async (tx) => {
      const current = await tx.submission.findFirst({
        where: { granteeId, semester },
        orderBy: { submittedAt: "desc" },
        select: { id: true, status: true, reviewedById: true, reviewedAt: true },
      });
      if (
        current?.status === SubmissionStatus.PRE_QUALIFIED ||
        (current?.status === SubmissionStatus.PENDING &&
          (current.reviewedById !== null || current.reviewedAt !== null))
      ) {
        throw new Error("TERM_ALREADY_SUBMITTED");
      }
      if (
        current?.status === SubmissionStatus.AWAITING_PHYSICAL_CTC ||
        current?.status === SubmissionStatus.APPROVED
      ) {
        throw new Error("TERM_ALREADY_APPROVED");
      }
      if (
        (current?.id ?? null) !== (existing?.id ?? null) ||
        (current?.status ?? null) !== (existing?.status ?? null) ||
        (current?.reviewedById ?? null) !== (existing?.reviewedById ?? null) ||
        (current?.reviewedAt?.getTime() ?? null) !== (existing?.reviewedAt?.getTime() ?? null)
      ) {
        throw new Error("TERM_SUBMISSION_CHANGED");
      }

      return existing
        ? tx.submission.update({
            where: { id: existing.id },
            data: payload,
          })
        : tx.submission.create({
            data: {
              ...payload,
              granteeId,
            },
          });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    after(async () => {
      await processSubmissionGradeReportOcr(submission.id, { manualReviewRequired: forceSubmit });
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
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { error: "Another submission for this term was saved. Refresh the page to check its status." },
        { status: 409 }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A submission for this term was saved while you were uploading. Refresh to check its latest status." },
        { status: 409 }
      );
    }
    if (
      error instanceof Error &&
      ["TERM_ALREADY_SUBMITTED", "TERM_ALREADY_APPROVED", "TERM_SUBMISSION_CHANGED"].includes(error.message)
    ) {
      const conflictMessage =
        error.message === "TERM_ALREADY_APPROVED"
          ? "Your submission for this term has already passed initial review and cannot be overwritten."
          : error.message === "TERM_SUBMISSION_CHANGED"
            ? "Your submission changed while it was being saved. Refresh the page and try again."
            : "Your requirements for this term are already under SK Admin review.";
      return NextResponse.json(
        { error: conflictMessage },
        { status: 409 }
      );
    }
    console.error("Grantee document submission failed:", error);
    return NextResponse.json(
      { error: "We couldn't submit your requirements right now. Please try again." },
      { status: 500 }
    );
  }
}
