import { SubmissionOcrStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  extractDocumentOcr,
  processGradeReportOcr,
  type GradeReportOcrResult,
} from "@/lib/ocr/grade-report-ocr";
import {
  validateCertificateOfEnrollment,
  validateGradeReport,
} from "@/lib/ocr/document-validation";
import { getSubmissionStorageObject } from "@/lib/ocr/storage";
import { hasFailingGradeIndicators } from "@/lib/ocr/failing-grade-indicators";

const OCR_TIMEOUT_MS = 30_000;

export type SubmissionOcrAnalysis = GradeReportOcrResult & {
  documentValidation: {
    certificateOfEnrollment: boolean;
    gradeReport: boolean;
  };
  status: SubmissionOcrStatus;
};

export async function analyzeSubmissionOcr(
  gradeReportUrl: string,
  certificateOfEnrollmentUrl: string,
  authId: string
): Promise<SubmissionOcrAnalysis> {
  const processing = async () => {
    const gradeReportObject = getSubmissionStorageObject(gradeReportUrl, authId);
    const coeObject = getSubmissionStorageObject(certificateOfEnrollmentUrl, authId);
    const storage = createAdminClient().storage;
    const [gradeReportDownload, coeDownload] = await Promise.all([
      storage.from(gradeReportObject.bucket).download(gradeReportObject.path),
      storage.from(coeObject.bucket).download(coeObject.path),
    ]);

    if (gradeReportDownload.error) throw gradeReportDownload.error;
    if (!gradeReportDownload.data) {
      throw new Error("The uploaded grade report could not be downloaded.");
    }
    if (coeDownload.error) throw coeDownload.error;
    if (!coeDownload.data) {
      throw new Error("The uploaded Certificate of Enrollment could not be downloaded.");
    }

    const coeResult = await extractDocumentOcr(
      Buffer.from(await coeDownload.data.arrayBuffer()),
      coeDownload.data.type,
      "Certificate of Enrollment"
    );
    const gradeReportResult = await processGradeReportOcr(
      Buffer.from(await gradeReportDownload.data.arrayBuffer()),
      gradeReportDownload.data.type
    );
    const documentValidation = {
      certificateOfEnrollment: validateCertificateOfEnrollment(coeResult.rawText),
      gradeReport: validateGradeReport(gradeReportResult.rawText),
    };
    const status = Object.values(documentValidation).every(Boolean)
      ? gradeReportResult.status
      : SubmissionOcrStatus.OCR_NEEDS_REVIEW;

    return { ...gradeReportResult, documentValidation, status };
  };

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      processing(),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(
          () => reject(new Error("Submission OCR exceeded the 30-second processing limit.")),
          OCR_TIMEOUT_MS
        );
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function processSubmissionGradeReportOcr(
  submissionId: string,
  { manualReviewRequired = false }: { manualReviewRequired?: boolean } = {}
) {
  let gradeReportUrl: string | null = null;
  let certificateOfEnrollmentUrl: string | null = null;

  try {
    const submission = await prisma.submission.findUnique({
      where: { id: submissionId },
      select: {
        id: true,
        gradeFileUrl: true,
        coeFileUrl: true,
        requiresStrictManualReview: true,
        grantee: { select: { user: { select: { authId: true } } } },
      },
    });

    if (!submission?.gradeFileUrl || !submission.coeFileUrl) {
      throw new Error("The submission does not have both required documents.");
    }
    gradeReportUrl = submission.gradeFileUrl;
    certificateOfEnrollmentUrl = submission.coeFileUrl;

    const processing = async () => {
      const result = await analyzeSubmissionOcr(
        submission.gradeFileUrl,
        submission.coeFileUrl,
        submission.grantee.user.authId
      );

      await prisma.submission.updateMany({
        where: {
          id: submission.id,
          gradeFileUrl: submission.gradeFileUrl,
          coeFileUrl: submission.coeFileUrl,
          ocrStatus: SubmissionOcrStatus.OCR_PENDING,
        },
        data: {
          ocrStatus: manualReviewRequired
            ? SubmissionOcrStatus.OCR_NEEDS_REVIEW
            : result.status,
          ocrRawText: result.rawText,
          ocrParsedRows: {
            rows: result.parsed.rows,
            unrecognizedRows: result.parsed.unrecognizedRows,
            documentValidation: result.documentValidation,
            ...(manualReviewRequired ? { forcedManualReview: true } : {}),
          },
          ocrGwa: result.parsed.gwa,
          ocrTotalUnits: result.parsed.totalUnits,
          ocrConfidence: result.confidence,
          requiresStrictManualReview:
            submission.requiresStrictManualReview || hasFailingGradeIndicators(result.rawText),
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
            ...(certificateOfEnrollmentUrl ? { coeFileUrl: certificateOfEnrollmentUrl } : {}),
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
