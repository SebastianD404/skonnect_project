import { NextRequest, NextResponse } from "next/server";
import { Prisma, SubmissionOcrStatus } from "@prisma/client";
import { writeAuditLog } from "@/lib/audit/logger";
import { prisma } from "@/lib/prisma";
import { getOcrAdminActor } from "@/lib/ocr/admin-access";
import {
  computeGradeReportGwa,
  validateCorrectedGradeReportRows,
} from "@/lib/ocr/override-validation";
import {
  getPreviousAcademicSemester,
  isAllowedAcademicSemester,
} from "@/lib/semester-progress";

export async function PATCH(request: NextRequest) {
  const { actor, error, status } = await getOcrAdminActor();
  if (!actor) {
    return NextResponse.json({ error }, { status: status ?? 401 });
  }

  const body = await request.json().catch(() => null);
  const submissionId =
    body && typeof body.submissionId === "string" ? body.submissionId.trim() : "";
  if (!submissionId) {
    return NextResponse.json({ error: "Submission ID is required." }, { status: 400 });
  }

  let rows;
  try {
    rows = validateCorrectedGradeReportRows(body.correctedRows);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Corrected rows are invalid.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: {
      id: true,
      semester: true,
      gradeReportSemester: true,
      ocrStatus: true,
      ocrParsedRows: true,
      ocrGwa: true,
      ocrTotalUnits: true,
      ocrConfidence: true,
      gradeFileUrl: true,
    },
  });
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (!submission.gradeFileUrl) {
    return NextResponse.json({ error: "Submission has no grade report." }, { status: 400 });
  }
  if (!isAllowedAcademicSemester(submission.semester)) {
    return NextResponse.json(
      { error: "The submission semester is invalid. Summer terms are not supported." },
      { status: 400 }
    );
  }

  const previousSemester = getPreviousAcademicSemester(submission.semester);
  if (!previousSemester || !isAllowedAcademicSemester(previousSemester)) {
    return NextResponse.json({ error: "Could not determine the previous academic semester." }, { status: 400 });
  }
  const existingReportSemester = submission.gradeReportSemester?.trim();
  if (existingReportSemester && !isAllowedAcademicSemester(existingReportSemester)) {
    return NextResponse.json(
      { error: "The grade report semester is invalid. Summer terms are not supported." },
      { status: 400 }
    );
  }
  const resolvedReportSemester = previousSemester;
  const { gwa, totalUnits } = computeGradeReportGwa(rows);
  const nextRows = { rows, unrecognizedRows: [] };

  const updated = await prisma.$transaction(async (transaction) => {
    const result = await transaction.submission.update({
      where: { id: submission.id },
      data: {
        gradeReportSemester: resolvedReportSemester,
        ocrStatus: SubmissionOcrStatus.OCR_DONE,
        ocrParsedRows: nextRows as Prisma.InputJsonValue,
        ocrGwa: gwa,
        ocrTotalUnits: totalUnits,
      },
      select: {
        id: true,
        gradeReportSemester: true,
        ocrStatus: true,
        ocrParsedRows: true,
        ocrGwa: true,
        ocrTotalUnits: true,
      },
    });

    await writeAuditLog(transaction, {
      action: "ADMIN_OCR_OVERRIDE",
      actorId: actor.id,
      targetTable: "submissions",
      targetId: submission.id,
      beforeData: {
        gradeReportSemester: submission.gradeReportSemester,
        ocrStatus: submission.ocrStatus,
        ocrParsedRows: submission.ocrParsedRows,
        ocrGwa: submission.ocrGwa,
        ocrTotalUnits: submission.ocrTotalUnits,
      },
      afterData: {
        gradeReportSemester: result.gradeReportSemester,
        ocrStatus: result.ocrStatus,
        ocrParsedRows: result.ocrParsedRows,
        ocrGwa: result.ocrGwa,
        ocrTotalUnits: result.ocrTotalUnits,
      },
      metadata: {
        operation: "ocr_override",
        summary: "Admin manually verified corrected OCR grade rows.",
        submissionId: submission.id,
        adminUserId: actor.id,
      },
    });

    return result;
  });

  return NextResponse.json({ success: true, ...updated });
}
