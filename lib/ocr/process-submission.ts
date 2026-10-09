import { SubmissionOcrStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { processGradeReportOcr } from "@/lib/ocr/grade-report-ocr";
import { getSubmissionStorageObject } from "@/lib/ocr/storage";

const OCR_TIMEOUT_MS = 30_000;

export async function processSubmissionGradeReportOcr(submissionId: string) {
  let gradeReportUrl: string | null = null;

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        gradeFileUrl: true,
        grantee: { select: { user: { select: { authId: true } } } },
      },
    });

    if (!submission?.gradeFileUrl) {
      throw new Error("The submission does not have a grade report.");
    }
    gradeReportUrl = submission.gradeFileUrl;

    const processing = async () => {
      const storageObject = getSubmissionStorageObject(
        submission.gradeFileUrl,
        submission.grantee.user.authId
      );
      const { data, error } = await createAdminClient()
        .storage.from(storageObject.bucket)
        .download(storageObject.path);

      if (error) throw error;
      if (!data) throw new Error("The uploaded grade report could not be downloaded.");

      const result = await processGradeReportOcr(
        Buffer.from(await data.arrayBuffer()),
        data.type
      );
      await prisma.submission.updateMany({
        where: {
          id: submission.id,
          gradeFileUrl: submission.gradeFileUrl,
          ocrStatus: SubmissionOcrStatus.OCR_PENDING,
        },
        data: {
          ocrStatus: result.status,
          ocrRawText: result.rawText,
          ocrParsedRows: {
            rows: result.parsed.rows,
            unrecognizedRows: result.parsed.unrecognizedRows,
          },
          ocrGwa: result.parsed.gwa,
          ocrTotalUnits: result.parsed.totalUnits,
          ocrConfidence: result.confidence,
        },
      });
    };

    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        processing(),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(
            () => reject(new Error("Grade report OCR exceeded the 30-second processing limit.")),
            OCR_TIMEOUT_MS
          );
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
  } catch (error) {
    console.error("Submission grade report OCR failed:", {
      submissionId,
      error,
    });
    await prisma.submission.updateMany({
      where: gradeReportUrl
        ? {
            id: submissionId,
            gradeFileUrl: gradeReportUrl,
            ocrStatus: SubmissionOcrStatus.OCR_PENDING,
          }
        : { id: submissionId, ocrStatus: SubmissionOcrStatus.OCR_PENDING },
      data: {
        ocrStatus: SubmissionOcrStatus.OCR_FAILED,
        ocrGwa: null,
        ocrTotalUnits: null,
        ocrConfidence: null,
      },
    });
  }
}
