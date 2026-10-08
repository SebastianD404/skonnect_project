import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSignedSubmissionFileUrl } from "@/lib/ocr/storage";
import { getOcrAdminActor } from "@/lib/ocr/admin-access";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { actor, error, status } = await getOcrAdminActor();
  if (!actor) {
    return NextResponse.json({ error }, { status: status ?? 401 });
  }

  const { id } = await context.params;
  const submission = await prisma.submission.findUnique({
    where: { id },
    select: {
      id: true,
      semester: true,
      gradeReportSemester: true,
      gradeFileUrl: true,
      ocrStatus: true,
      ocrRawText: true,
      ocrParsedRows: true,
      ocrGwa: true,
      ocrTotalUnits: true,
      ocrConfidence: true,
      grantee: { select: { user: { select: { authId: true } } } },
    },
  });
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (!submission.gradeFileUrl) {
    return NextResponse.json({ error: "Submission has no grade report." }, { status: 404 });
  }

  try {
    const fileUrl = await createSignedSubmissionFileUrl(
      submission.gradeFileUrl,
      submission.grantee.user.authId
    );
    return NextResponse.json({
      id: submission.id,
      semester: submission.semester,
      gradeReportSemester: submission.gradeReportSemester,
      ocrStatus: submission.ocrStatus,
      ocrRawText: submission.ocrRawText,
      ocrParsedRows: submission.ocrParsedRows,
      ocrGwa: submission.ocrGwa,
      ocrTotalUnits: submission.ocrTotalUnits,
      ocrConfidence: submission.ocrConfidence,
      fileUrl,
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Could not create secure file URL.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
