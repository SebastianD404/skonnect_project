import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  count: vi.fn(),
  findMany: vi.fn(),
  getAcademicTermScheduleState: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/prisma", () => ({
  prisma: { submission: { count: mocks.count, findMany: mocks.findMany } },
}));
vi.mock("@/lib/academic-term-schedule", () => ({
  getAcademicTermScheduleState: mocks.getAcademicTermScheduleState,
}));

import { GET } from "@/app/api/admin/submissions/route";

describe("admin submission review buckets", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-auth-id" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-id", role: "SK_OFFICIAL" });
    let countCall = 0;
    mocks.count.mockImplementation(async () => [1, 1, 0, 1, 0, 4][countCall++] ?? 0);
    mocks.getAcademicTermScheduleState.mockResolvedValue({
      window: { status: "OPEN", semester: "2026-2027 First Semester" },
    });

    const submission = {
      id: "submission-resubmitted",
      semester: "2026-2027 First Semester",
      gradeFileUrl: "grade-report.pdf",
      coeFileUrl: "coe.pdf",
      requiresStrictManualReview: true,
      ocrStatus: "OCR_PENDING",
      ocrGwa: null,
      ocrParsedRows: {
        clientGradeDiagnostics: {
          hasPossibleFailingGrade: true,
          flaggedSubjects: ["Systems Administration: 5"],
          flaggedGrades: ["Systems Administration: 5"],
        },
      },
      ocrRawText: "3rd Year, First Semester\nWMAD301 Accounting 3.0 94\nWMAD302 Systems 3.0 91",
      status: "PENDING",
      coeStatus: "PENDING",
      gradesStatus: "PENDING",
      reviewNotes: null,
      flaggedFields: [],
      resubmittedFields: ["GRADE_REPORT"],
      submittedAt: new Date("2026-11-10T00:00:00.000Z"),
      grantee: {
        id: "grantee-1",
        school: "Example School",
        yearLevel: "Third Year",
        user: { fullName: "Example Grantee", email: "example@test.invalid" },
      },
    };
    const firstTimeSubmission = {
      ...submission,
      id: "submission-first-time",
      resubmittedFields: [],
      submittedAt: new Date("2026-11-17T00:00:00.000Z"),
    };

    mocks.findMany.mockImplementation(async ({ where }: {
      where: {
        AND?: Array<{ resubmittedFields?: { isEmpty?: boolean } }>;
      };
    }) => {
      const filter = where.AND?.find((condition) => condition.resubmittedFields);
      if (filter?.resubmittedFields?.isEmpty === false) return [submission];
      if (filter?.resubmittedFields?.isEmpty === true) return [firstTimeSubmission];
      return [];
    });
  });

  it("keeps first-time pending submissions separate from resubmissions", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/submissions?status=pending"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rows.map((row: { id: string }) => row.id)).toEqual([
      "submission-first-time",
    ]);
    expect(data.counts).toMatchObject({ pending: 1, resubmitted: 1 });
    expect(data.rows[0].gradeDiagnostics).toMatchObject({
      hasPossibleFailingGrade: false,
      flaggedSubjects: [],
      detectedScale: "PERCENTAGE_100",
    });
  });

  it("returns only packages with resubmitted documents in the resubmitted bucket", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/submissions?status=resubmitted"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.rows.map((row: { id: string }) => row.id)).toEqual([
      "submission-resubmitted",
    ]);
    expect(data.counts).toMatchObject({ pending: 1, resubmitted: 1 });
    expect(data.rows[0].resubmittedFields).toEqual(["GRADE_REPORT"]);
  });

  it("excludes removed, revoked, and inactive grantees from active queue rows and counts", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/submissions?status=pending"),
    );

    expect(response.status).toBe(200);
    const activeGranteeFilter = {
      grantee: {
        is: {
          status: { notIn: ["REMOVED", "REVOKED"] },
          user: { is: { isActive: true } },
        },
      },
    };

    for (const callNumber of [2, 3, 4, 5]) {
      expect(mocks.count).toHaveBeenNthCalledWith(
        callNumber,
        expect.objectContaining({ where: expect.objectContaining(activeGranteeFilter) }),
      );
    }
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining(activeGranteeFilter)]),
        }),
      }),
    );
  });

  it("keeps physical CTC packages out of the digital review buckets", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/admin/submissions?status=physical"),
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.counts).toMatchObject({
      pending: 1,
      returned: 0,
      resubmitted: 1,
      physical: 0,
      cleared: 4,
    });
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({ status: "AWAITING_PHYSICAL_CTC" }),
          ]),
        }),
      }),
    );
  });
});
