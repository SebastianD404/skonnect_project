import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  granteeGroupBy: vi.fn(),
  inquiryCount: vi.fn(),
  queryRaw: vi.fn(),
  profilingCount: vi.fn(),
  capacityCount: vi.fn(),
  maxSlots: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    grantee: { groupBy: mocks.granteeGroupBy },
    inquiry: { count: mocks.inquiryCount },
    $queryRaw: mocks.queryRaw,
  },
  getProfilingRegistrationCountByStatus: mocks.profilingCount,
}));

vi.mock("@/lib/skeap-capacity", () => ({
  getSkeapCapacityCount: mocks.capacityCount,
  getSkeapMaxSlots: mocks.maxSlots,
}));

import {
  buildYearLevelDistributions,
  getScholarDistributionAnalytics,
} from "@/lib/admin-scholar-analytics";

describe("admin scholar demographics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.granteeGroupBy
      .mockResolvedValueOnce([
        { status: "ACTIVE", _count: { _all: 2 } },
        { status: "PROBATIONARY", _count: { _all: 1 } },
        { status: "GRADUATED", _count: { _all: 3 } },
        { status: "REMOVED", _count: { _all: 4 } },
        { status: "REVOKED", _count: { _all: 5 } },
      ]);
    mocks.capacityCount.mockResolvedValue(3);
    mocks.maxSlots.mockResolvedValue(20);
    mocks.inquiryCount.mockResolvedValue(1);
    mocks.profilingCount.mockResolvedValue(7);
    mocks.queryRaw
      .mockResolvedValueOnce([{ count: 943 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { sex: "MALE", count: 400 },
        { sex: "m", count: 100 },
        { sex: "FEMALE", count: 350 },
        { sex: "F", count: 50 },
        { sex: null, count: 20 },
        { sex: "", count: 10 },
        { sex: "OTHER", count: 13 },
      ])
      .mockResolvedValueOnce([
        { sex: "MALE", count: 8 },
        { sex: "FEMALE", count: 9 },
        { sex: "NOT_SPECIFIED", count: 2 },
      ])
      .mockResolvedValueOnce([
        { yearLevel: "Grade 7", count: 1 },
        { yearLevel: "Grade 8", count: 2 },
        { yearLevel: "Grade 9", count: 3 },
        { yearLevel: "Grade 10", count: 4 },
        { yearLevel: "Grade 11", count: 5 },
        { yearLevel: "Grade 12", count: 6 },
        { yearLevel: "1st Year", count: 7 },
        { yearLevel: "2nd Year", count: 8 },
        { yearLevel: "3rd Year", count: 9 },
        { yearLevel: "5th Year", count: 10 },
        { yearLevel: "Tech-Voc", count: 11 },
      ]);
  });

  it("counts youth and scholar demographics and groups active outcomes consistently", async () => {
    const analytics = await getScholarDistributionAnalytics();

    expect(analytics.totalRegisteredYouth).toBe(943);
    expect(analytics.pendingApplications).toBe(1);
    expect(mocks.inquiryCount).toHaveBeenCalledWith({
      where: expect.objectContaining({
        subject: { contains: "SKEAP application", mode: "insensitive" },
        AND: expect.arrayContaining([
          expect.objectContaining({ createdAt: expect.any(Object) }),
          expect.objectContaining({
            OR: expect.arrayContaining([
              { reviewStatus: { contains: "pending", mode: "insensitive" } },
              { reviewStatus: { contains: "pre_qualified", mode: "insensitive" } },
            ]),
          }),
        ]),
      }),
    });
    expect(analytics.genderDistribution).toEqual({
      male: 8,
      female: 9,
      notSpecified: 2,
    });
    expect(analytics.youthGenderDistribution).toEqual({
      male: 500,
      female: 400,
      notSpecified: 43,
    });
    expect(
      analytics.youthGenderDistribution.male +
      analytics.youthGenderDistribution.female +
      analytics.youthGenderDistribution.notSpecified,
    ).toBe(analytics.totalRegisteredYouth);
    const youthSexQuery = (mocks.queryRaw.mock.calls[3][0] as TemplateStringsArray).join("");
    expect(youthSexQuery).toContain('registration."reviewStatus" = \'Approved\'');
    expect(youthSexQuery).toContain("identity_rank = 1");
    expect(youthSexQuery).toContain('public."kk_profiling_registrations"');
    expect(youthSexQuery).not.toContain('public."grantees"');
    const totalYouthQuery = (mocks.queryRaw.mock.calls[0][0] as TemplateStringsArray).join("");
    expect(totalYouthQuery).toContain('registration."reviewStatus" = \'Approved\'');
    expect(totalYouthQuery).toContain("identity_rank = 1");
    const granteeSexQuery = (mocks.queryRaw.mock.calls[4][0] as TemplateStringsArray).join("");
    expect(granteeSexQuery).toContain(`profile."sex"::text IN ('MALE', 'FEMALE')`);
    expect(granteeSexQuery).toContain('public."kk_profiling_registrations"');
    expect(granteeSexQuery).toContain('registration."userId" = grantee."userId"');
    expect(granteeSexQuery).toContain('public."skeap_applications"');
    expect(granteeSexQuery).toContain('application."userId" = grantee."userId"');
    const yearLevelQuery = (mocks.queryRaw.mock.calls[5][0] as TemplateStringsArray).join("");
    expect(yearLevelQuery).toContain(`grantee."status" = 'ACTIVE'`);
    expect(yearLevelQuery).toContain(`application."status" = 'APPROVED'`);
    expect(analytics.yearLevelDistribution).toEqual([
      { yearLevel: "Junior High", count: 10 },
      { yearLevel: "Senior High", count: 11 },
      { yearLevel: "College", count: 45 },
    ]);
    expect(analytics.yearLevelBreakdowns.highSchool).toEqual([
      { yearLevel: "Grade 7", count: 1 },
      { yearLevel: "Grade 8", count: 2 },
      { yearLevel: "Grade 9", count: 3 },
      { yearLevel: "Grade 10", count: 4 },
      { yearLevel: "Grade 11", count: 5 },
      { yearLevel: "Grade 12", count: 6 },
    ]);
    expect(analytics.yearLevelBreakdowns.college).toEqual([
      { yearLevel: "1st Year", count: 7 },
      { yearLevel: "2nd Year", count: 8 },
      { yearLevel: "3rd Year", count: 9 },
      { yearLevel: "4th Year+", count: 21 },
    ]);
    expect(analytics.programOutcomes).toEqual({
      activeGrantees: 3,
      graduated: 3,
      removedOrRevoked: 9,
    });
  });

  it("classifies abbreviated ordinal grades and Tech-Voc in the correct breakdowns", () => {
    expect(buildYearLevelDistributions([
        { yearLevel: "7th Grade", count: 1 },
        { yearLevel: "4th Year College", count: 2 },
        { yearLevel: "Technical and Vocational (Tech-Voc)", count: 3 },
    ])).toEqual({
      all: [
        { yearLevel: "Junior High", count: 1 },
        { yearLevel: "Senior High", count: 0 },
        { yearLevel: "College", count: 5 },
      ],
      highSchool: [
        { yearLevel: "Grade 7", count: 1 },
        { yearLevel: "Grade 8", count: 0 },
        { yearLevel: "Grade 9", count: 0 },
        { yearLevel: "Grade 10", count: 0 },
        { yearLevel: "Grade 11", count: 0 },
        { yearLevel: "Grade 12", count: 0 },
      ],
      college: [
        { yearLevel: "1st Year", count: 0 },
        { yearLevel: "2nd Year", count: 0 },
        { yearLevel: "3rd Year", count: 0 },
        { yearLevel: "4th Year+", count: 5 },
      ],
    });
  });
});
