import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindFirst: vi.fn(),
  submissionFindFirst: vi.fn(),
  submissionUpdate: vi.fn(),
  transactionSubmissionFindFirst: vi.fn(),
  transactionSubmissionUpdate: vi.fn(),
  transactionSubmissionCreate: vi.fn(),
  transactionGranteeUpdateMany: vi.fn(),
  adminNotificationUpsert: vi.fn(),
  transaction: vi.fn(),
  storageUpload: vi.fn(),
  uploadPrivateDocument: vi.fn(),
  removePrivateDocument: vi.fn(),
  detectGranteeTargetTerm: vi.fn(),
  getAcademicTermScheduleState: vi.fn(),
  processSubmissionGradeReportOcr: vi.fn(),
  after: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.userFindFirst },
    submission: {
      findFirst: mocks.submissionFindFirst,
      update: mocks.submissionUpdate,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "auth-1" } } }) },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({ upload: mocks.storageUpload }),
    },
  }),
}));

vi.mock("@/lib/private-documents", () => ({
  uploadPrivateDocument: mocks.uploadPrivateDocument,
  removePrivateDocument: mocks.removePrivateDocument,
}));

vi.mock("@/lib/grantee-semester", () => ({
  detectGranteeTargetTerm: mocks.detectGranteeTargetTerm,
  getScheduleSemesterForTargetTerm: () => "2025-2026 First Semester",
}));

vi.mock("@/lib/academic-term-schedule", () => ({
  getAcademicTermScheduleState: mocks.getAcademicTermScheduleState,
}));

vi.mock("@/lib/grantee-profile", () => ({
  isGranteeProfileComplete: () => true,
}));

vi.mock("@/lib/ocr/process-submission", () => ({
  processSubmissionGradeReportOcr: mocks.processSubmissionGradeReportOcr,
}));

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: mocks.after };
});

import { NextRequest } from "next/server";
import { POST as uploadRequirement } from "../app/api/grantee/submissions/upload/route";
import { POST as submitRequirements } from "../app/api/grantee/submissions/route";
import { POST as submitExitClearance } from "../app/api/grantee/exit-clearance/route";

const returnedTerm = {
  schoolYear: "2025-2026",
  semester: "First Semester",
  termLabel: "2025-2026 First Semester",
  isResubmission: true,
  detectionSummary: "Returned for corrections",
  previousApprovedTerm: null,
  hasPendingSubmission: false,
  hasApprovedSubmission: false,
};

const returnedSubmission = {
  id: "submission-1",
  semester: returnedTerm.termLabel,
  status: "RETURNED_FOR_EDIT",
  gradeFileUrl: "old-grade.pdf",
  coeFileUrl: "saved-coe.pdf",
  flaggedFields: ["GRADE_REPORT"],
  resubmittedFields: [],
  reviewNotes: "Please upload a clearer grade report.",
  requiresStrictManualReview: false,
};

function createFileRequest(url: string, fields: Record<string, string>, fileName: string) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) formData.set(key, value);
  formData.set("file", new File(["%PDF-1.7 replacement"], fileName, { type: "application/pdf" }));
  return new NextRequest(url, { method: "POST", body: formData });
}

describe("grantee file re-uploads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.userFindFirst.mockResolvedValue({
      id: "user-1",
      role: "GRANTEE",
      fullName: "Test Grantee",
      grantee: {
        id: "grantee-1",
        status: "ACTIVE",
        exitClearanceStatus: "SUBMITTED",
        exitClearanceUrl: "/api/private-documents/grantee-clearances/auth-1/old-clearance.pdf",
      },
    });
    mocks.detectGranteeTargetTerm.mockResolvedValue(returnedTerm);
    mocks.getAcademicTermScheduleState.mockResolvedValue({
      schedules: [],
      window: { status: "CLOSED", semester: null, opensAt: null, closesAt: null },
    });
    mocks.submissionFindFirst.mockResolvedValue(returnedSubmission);
    mocks.storageUpload.mockResolvedValue({ error: null });
    mocks.uploadPrivateDocument.mockResolvedValue({
      path: "grantee-clearances/auth-1/new-clearance.pdf",
      url: "/api/private-documents/grantee-clearances/auth-1/new-clearance.pdf",
    });
    mocks.removePrivateDocument.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        submission: {
          findFirst: mocks.transactionSubmissionFindFirst,
          update: mocks.transactionSubmissionUpdate,
          create: mocks.transactionSubmissionCreate,
        },
        grantee: { updateMany: mocks.transactionGranteeUpdateMany },
        adminNotification: { upsert: mocks.adminNotificationUpsert },
      })
    );
    mocks.transactionSubmissionFindFirst.mockResolvedValue({
      id: returnedSubmission.id,
      status: returnedSubmission.status,
    });
    mocks.transactionSubmissionUpdate.mockImplementation(async ({ data }) => ({
      id: returnedSubmission.id,
      granteeId: "grantee-1",
      semester: data.semester,
      gradeFileUrl: data.gradeFileUrl,
      coeFileUrl: data.coeFileUrl,
      status: data.status,
      reviewedById: null,
      reviewNotes: data.reviewNotes,
      submittedAt: data.submittedAt,
      reviewedAt: null,
      flaggedFields: data.flaggedFields,
      coeStatus: "PENDING",
      gradesStatus: "PENDING",
      coeSubmittedAt: data.submittedAt,
      coeApprovedAt: null,
      gradesSubmittedAt: null,
      gradesApprovedAt: null,
    }));
    mocks.transactionGranteeUpdateMany.mockResolvedValue({ count: 1 });
    mocks.adminNotificationUpsert.mockResolvedValue({});
    mocks.after.mockImplementation(() => undefined);
  });

  it("uploads and resubmits a returned requirement after the term window closes", async () => {
    const uploadResponse = await uploadRequirement(
      createFileRequest(
        "http://localhost/api/grantee/submissions/upload",
        { kind: "grade" },
        "grade-report.pdf"
      )
    );
    const uploadBody = await uploadResponse.json();

    expect(uploadResponse.status).toBe(200);
    expect(mocks.storageUpload).toHaveBeenCalledWith(
      expect.stringMatching(/^grantee-submissions\/auth-1\/grade-\d+-[0-9a-f-]+-grade-report\.pdf$/i),
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: true, cacheControl: "0" })
    );

    const submitResponse = await submitRequirements(
      new NextRequest("http://localhost/api/grantee/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gradeFileUrl: uploadBody.path, coeFileUrl: "" }),
      })
    );
    const submitBody = await submitResponse.json();

    expect(submitResponse.status).toBe(200);
    expect(submitBody.submission.status).toBe("PENDING");
    expect(mocks.transactionSubmissionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: returnedSubmission.id },
      data: expect.objectContaining({
        gradeFileUrl: uploadBody.path,
        coeFileUrl: returnedSubmission.coeFileUrl,
        status: "PENDING",
        reviewNotes: null,
        flaggedFields: [],
      }),
    }));
    expect(mocks.transactionSubmissionCreate).not.toHaveBeenCalled();
  });

  it("replaces an already-submitted exit clearance without a duplicate conflict", async () => {
    const formData = new FormData();
    formData.set("file", new File(["%PDF-1.7 clearance"], "clearance.pdf", { type: "application/pdf" }));
    formData.set("note", "Updated scan");

    const response = await submitExitClearance(
      new NextRequest("http://localhost/api/grantee/exit-clearance", {
        method: "POST",
        body: formData,
      })
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.exitClearanceStatus).toBe("SUBMITTED");
    expect(mocks.transactionGranteeUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        exitClearanceStatus: { in: ["NONE", "SUBMITTED"] },
        exitClearanceUrl: "/api/private-documents/grantee-clearances/auth-1/old-clearance.pdf",
      }),
      data: expect.objectContaining({
        exitClearanceStatus: "SUBMITTED",
        exitClearanceUrl: "/api/private-documents/grantee-clearances/auth-1/new-clearance.pdf",
        schoolClearanceVerified: false,
        skClearanceVerified: false,
        graduationRemarks: "Updated scan",
      }),
    }));
  });

  it("allows replacing a pending submission until an admin starts its review", async () => {
    const unlockedPending = {
      ...returnedSubmission,
      status: "PENDING",
      flaggedFields: [],
      reviewNotes: null,
      reviewedById: null,
      reviewedAt: null,
    };
    mocks.submissionFindFirst.mockResolvedValue(unlockedPending);
    mocks.transactionSubmissionFindFirst.mockResolvedValue({
      id: unlockedPending.id,
      status: "PENDING",
      reviewedById: null,
      reviewedAt: null,
    });
    mocks.detectGranteeTargetTerm.mockResolvedValue({
      ...returnedTerm,
      isResubmission: false,
      hasPendingSubmission: true,
      canReplacePendingSubmission: true,
    });
    mocks.getAcademicTermScheduleState.mockResolvedValue({
      schedules: [],
      window: {
        status: "OPEN",
        semester: returnedTerm.termLabel,
        opensAt: new Date(Date.now() - 60_000),
        closesAt: new Date(Date.now() + 60_000),
      },
    });

    const response = await submitRequirements(
      new NextRequest("http://localhost/api/grantee/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeFileUrl: "new-grade.pdf",
          coeFileUrl: "new-coe.pdf",
        }),
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.transactionSubmissionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: "PENDING",
        reviewedById: null,
        reviewedAt: null,
        submittedAt: expect.any(Date),
      }),
    }));
  });

  it("keeps a pending submission locked after an admin begins review", async () => {
    const lockedPending = {
      ...returnedSubmission,
      status: "PENDING",
      flaggedFields: [],
      reviewNotes: null,
      reviewedById: "admin-1",
      reviewedAt: new Date(),
    };
    mocks.submissionFindFirst.mockResolvedValue(lockedPending);
    mocks.detectGranteeTargetTerm.mockResolvedValue({
      ...returnedTerm,
      isResubmission: false,
      hasPendingSubmission: true,
      canReplacePendingSubmission: false,
    });

    const response = await submitRequirements(
      new NextRequest("http://localhost/api/grantee/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gradeFileUrl: "new-grade.pdf",
          coeFileUrl: "new-coe.pdf",
        }),
      })
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toContain("already under SK Admin review");
    expect(mocks.transactionSubmissionUpdate).not.toHaveBeenCalled();
  });
});
