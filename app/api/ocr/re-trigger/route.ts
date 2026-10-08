import { after, NextRequest, NextResponse } from "next/server";
import { Prisma, SubmissionOcrStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getOcrAdminActor } from "@/lib/ocr/admin-access";
import { processSubmissionGradeReportOcr } from "@/lib/ocr/process-submission";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
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

  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    select: { id: true, gradeFileUrl: true },
  });
  if (!submission?.gradeFileUrl) {
    return NextResponse.json({ error: "Submission or grade report not found." }, { status: 404 });
  }

  await prisma.submission.update({
    where: { id: submission.id },
    data: {
      ocrStatus: SubmissionOcrStatus.OCR_PENDING,
      ocrRawText: null,
      ocrParsedRows: Prisma.DbNull,
      ocrGwa: null,
      ocrTotalUnits: null,
      ocrConfidence: null,
    },
  });
  after(async () => {
    await processSubmissionGradeReportOcr(submission.id);
  });

  return NextResponse.json({ success: true, ocrStatus: SubmissionOcrStatus.OCR_PENDING });
}
