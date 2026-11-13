import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userCount: vi.fn(),
  granteeGroupBy: vi.fn(),
  applicationCount: vi.fn(),
  queryRaw: vi.fn(),
  profilingCount: vi.fn(),
  capacityCount: vi.fn(),
  maxSlots: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { count: mocks.userCount },
    grantee: { groupBy: mocks.granteeGroupBy },
    skeapApplication: { count: mocks.applicationCount },
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
    mocks.userCount.mockResolvedValue(120);
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
    mocks.applicationCount.mockResolvedValue(6);
    mocks.profilingCount.mockResolvedValue(7);
    mocks.queryRaw
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
    const youthSexQuery = (mocks.queryRaw.mock.calls[3][0] as TemplateStringsArray).join("");
    expect(youthSexQuery).toContain('profile."sex"');
    expect(youthSexQuery).not.toContain('user_record."sex"');
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
