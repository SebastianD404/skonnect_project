import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
    },
  });
  if (!submission) {
    return NextResponse.json({ error: "Submission not found." }, { status: 404 });
  }
  if (!submission.gradeFileUrl) {
    return NextResponse.json({ error: "Submission has no grade report." }, { status: 404 });
  }

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
    fileUrl: `/api/submissions/${submission.id}/file?kind=grade`,
    fileExtension: submission.gradeFileUrl.split(/[?#]/, 1)[0].split(".").pop()?.toLowerCase() ?? "",
  });
}
