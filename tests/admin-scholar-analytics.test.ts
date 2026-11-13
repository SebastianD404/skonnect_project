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

import { getScholarDistributionAnalytics } from "@/lib/admin-scholar-analytics";

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
      ])
      .mockResolvedValueOnce([
        { yearLevel: "1st Year", _count: { _all: 2 } },
        { yearLevel: "2nd Year", _count: { _all: 3 } },
        { yearLevel: "3rd Year", _count: { _all: 4 } },
        { yearLevel: "4th Year", _count: { _all: 5 } },
      ]);
    mocks.capacityCount.mockResolvedValue(3);
    mocks.maxSlots.mockResolvedValue(20);
    mocks.inquiryCount.mockResolvedValue(1);
    mocks.profilingCount.mockResolvedValue(7);
    mocks.queryRaw
      .mockResolvedValueOnce([{ count: 101 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { sex: "MALE", count: 8 },
        { sex: "FEMALE", count: 9 },
        { sex: "NOT_SPECIFIED", count: 2 },
      ])
      .mockResolvedValueOnce([
        { sex: "MALE", count: 62 },
        { sex: "FEMALE", count: 51 },
        { sex: "NOT_SPECIFIED", count: 7 },
      ]);
  });

  it("counts youth and scholar demographics and groups active outcomes consistently", async () => {
    const analytics = await getScholarDistributionAnalytics();

    expect(analytics.totalRegisteredYouth).toBe(101);
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
      male: 62,
      female: 51,
      notSpecified: 7,
    });
    const youthSexQuery = (mocks.queryRaw.mock.calls[4][0] as TemplateStringsArray).join("");
    expect(youthSexQuery).toContain('profile."sex"');
    expect(youthSexQuery).not.toContain('user_record."sex"');
    const totalYouthQuery = (mocks.queryRaw.mock.calls[0][0] as TemplateStringsArray).join("");
    expect(totalYouthQuery).toContain('registration."reviewStatus" = \'Approved\'');
    expect(totalYouthQuery).toContain("identity_rank = 1");
    expect(analytics.yearLevelDistribution).toEqual([
      { yearLevel: "1st Year", count: 2 },
      { yearLevel: "2nd Year", count: 3 },
      { yearLevel: "3rd Year", count: 4 },
      { yearLevel: "4th Year", count: 5 },
    ]);
    expect(analytics.programOutcomes).toEqual({
      activeGrantees: 3,
      graduated: 3,
      removedOrRevoked: 9,
    });
  });
});
