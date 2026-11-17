import { after, NextRequest, NextResponse } from "next/server";
import { Prisma, SubmissionOcrStatus, SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { isGranteeProfileComplete } from "@/lib/grantee-profile";
import { processSubmissionGradeReportOcr } from "@/lib/ocr/process-submission";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import { detectGranteeTargetTerm, getScheduleSemesterForTargetTerm } from "@/lib/grantee-semester";
import type { GradeReportDiagnostics } from "@/lib/grade-report-parser";

export const runtime = "nodejs";
export const maxDuration = 300;

function getClientGradeDiagnostics(value: unknown): GradeReportDiagnostics | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const detectedScale =
    record.detectedScale === "PERCENTAGE_100" || record.detectedScale === "SCALE_1_TO_5"
      ? record.detectedScale
      : null;
  const estimatedGwa =
    typeof record.estimatedGwa === "number" && Number.isFinite(record.estimatedGwa)
      ? record.estimatedGwa
      : null;
  const isValidEstimatedGwa =
    estimatedGwa !== null &&
    (detectedScale === "PERCENTAGE_100"
      ? estimatedGwa >= 0 && estimatedGwa <= 100
      : detectedScale === "SCALE_1_TO_5"
        ? estimatedGwa >= 1 && estimatedGwa <= 5
        : false);
  const normalizedEstimatedGwa = isValidEstimatedGwa ? estimatedGwa : null;
  const flaggedSubjectsValue = Array.isArray(record.flaggedSubjects)
    ? record.flaggedSubjects
    : record.flaggedGrades;
  const flaggedSubjects = Array.isArray(flaggedSubjectsValue)
    ? flaggedSubjectsValue
        .filter((grade): grade is string => typeof grade === "string")
        .map((grade) => grade.slice(0, 160))
        .slice(0, 30)
    : [];
  const hasPossibleFailingGrade =
    record.hasPossibleFailingGrade === true || flaggedSubjects.length > 0;
  const meetsGwaRequirement =
    normalizedEstimatedGwa === null
      ? null
      : detectedScale === "PERCENTAGE_100"
        ? normalizedEstimatedGwa >= 80
        : normalizedEstimatedGwa <= 2.5;
  const gwaCheckStatus =
    meetsGwaRequirement === null
      ? "UNAVAILABLE"
      : meetsGwaRequirement
        ? "MEETS_REQUIREMENT"
        : "BELOW_REQUIREMENT";
  return {
    detectedScale,
    estimatedGwa: normalizedEstimatedGwa,
    gwaCheckStatus,
    meetsGwaRequirement,
    gwaMessage:
      normalizedEstimatedGwa !== null
        ? meetsGwaRequirement
          ? "Estimated GWA meets the 80% maintenance requirement."
          : "Estimated GWA does not meet the 80% maintenance requirement."
        : typeof record.gwaMessage === "string"
        ? record.gwaMessage.slice(0, 200)
        : "GWA could not be auto-calculated — SK Admin will verify.",
    hasPossibleFailingGrade,
    flaggedSubjects,
    flaggedGrades: flaggedSubjects,
    possibleFailingGradeMessage:
      hasPossibleFailingGrade
        ? "Possible failing grade detected. An SK Admin will verify your official grade report."
        : typeof record.possibleFailingGradeMessage === "string"
          ? record.possibleFailingGradeMessage.slice(0, 200)
          : null,
  };
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
    const clientGradeDiagnostics = getClientGradeDiagnostics(body.gradeDiagnostics);

    const detectedTerm = await detectGranteeTargetTerm(appUser.id);
    if (!detectedTerm) {
      return NextResponse.json(
        { error: "Your next requirement term could not be detected. Please contact SK admin." },
        { status: 409 }
      );
    }
    const semester = detectedTerm.termLabel;

    const [existing, lockedExisting] = await Promise.all([
      prisma.submission.findFirst({
        where: { granteeId, semester },
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
          submittedAt: true,
        },
      }),
      prisma.submission.findFirst({
        where: {
          granteeId,
          semester,
          status: { in: [SubmissionStatus.PENDING, SubmissionStatus.APPROVED] },
        },
        orderBy: { submittedAt: "desc" },
        select: { id: true, status: true },
      }),
    ]);

    if (
      lockedExisting ||
      existing?.status === SubmissionStatus.PENDING ||
      existing?.status === SubmissionStatus.APPROVED
    ) {
      return NextResponse.json(
        { error: "Your submission for this term is already under review." },
        { status: 409 }
      );
    }
    if (existing && existing.status !== SubmissionStatus.RETURNED_FOR_EDIT) {
      return NextResponse.json(
        { error: "This submission can only be updated when an SK Admin requests edits." },
        { status: 409 }
      );
    }

    const { window: termWindow } = await getAcademicTermScheduleState();
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
    const clientDiagnosticsRequireReview = Boolean(
      clientGradeDiagnostics &&
      (
        clientGradeDiagnostics.hasPossibleFailingGrade ||
        clientGradeDiagnostics.gwaCheckStatus === "BELOW_REQUIREMENT" ||
        clientGradeDiagnostics.gwaCheckStatus === "UNAVAILABLE"
      )
    );
    const requiresStrictManualReview = gradeFileChanged
      ? clientRequiresStrictManualReview || clientDiagnosticsRequireReview
      : existing.requiresStrictManualReview ||
        clientRequiresStrictManualReview ||
        clientDiagnosticsRequireReview;

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
      status: SubmissionStatus.PENDING,
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
        ...(clientGradeDiagnostics ? { clientGradeDiagnostics } : {}),
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
      const currentLocked = await tx.submission.findFirst({
        where: {
          granteeId,
          semester,
          status: { in: [SubmissionStatus.PENDING, SubmissionStatus.APPROVED] },
        },
        select: { id: true, status: true },
      });
      if (currentLocked) {
        throw new Error("TERM_ALREADY_UNDER_REVIEW");
      }

      const current = await tx.submission.findFirst({
        where: { granteeId, semester },
        orderBy: { submittedAt: "desc" },
        select: {
          id: true,
          status: true,
          reviewedById: true,
          reviewedAt: true,
          submittedAt: true,
        },
      });
      if (
        current?.status === SubmissionStatus.PENDING ||
        current?.status === SubmissionStatus.APPROVED
      ) {
        throw new Error("TERM_ALREADY_UNDER_REVIEW");
      }
      if (current && current.status !== SubmissionStatus.RETURNED_FOR_EDIT && existing) {
        throw new Error("TERM_NOT_EDITABLE");
      }
      if (
        (current?.id ?? null) !== (existing?.id ?? null) ||
        (current?.status ?? null) !== (existing?.status ?? null) ||
        (current?.reviewedById ?? null) !== (existing?.reviewedById ?? null) ||
        (current?.reviewedAt?.getTime() ?? null) !== (existing?.reviewedAt?.getTime() ?? null) ||
        (current?.submittedAt?.getTime() ?? null) !== (existing?.submittedAt?.getTime() ?? null)
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
      resubmittedFields: submission.resubmittedFields,
      ocrStatus: submission.ocrStatus,
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
        { error: "Your submission for this term is already under review." },
        { status: 409 }
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Your submission for this term is already under review." },
        { status: 409 }
      );
    }
    if (
      error instanceof Error &&
      ["TERM_ALREADY_UNDER_REVIEW", "TERM_NOT_EDITABLE", "TERM_SUBMISSION_CHANGED"].includes(error.message)
    ) {
      const conflictMessages: Record<string, string> = {
        TERM_ALREADY_UNDER_REVIEW: "Your submission for this term is already under review.",
        TERM_NOT_EDITABLE: "This submission can only be updated when an SK Admin requests edits.",
        TERM_SUBMISSION_CHANGED: "Your submission changed while it was being saved. Refresh the page and try again.",
      };
      return NextResponse.json(
        { error: conflictMessages[error.message] },
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
