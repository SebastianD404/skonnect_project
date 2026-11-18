import { beforeEach, describe, expect, it, vi } from "vitest";
import { PICO_SITIOS } from "@/lib/barangay-sitios";

const mocks = vi.hoisted(() => ({
  granteeGroupBy: vi.fn(),
  inquiryCount: vi.fn(),
  queryRaw: vi.fn(),
  profilingCount: vi.fn(),
  capacitySnapshot: vi.fn(),
}));

function flattenSql(part: unknown): string {
  if (typeof part === "string") return part;
  if (Array.isArray(part)) return part.map(flattenSql).join("");
  if (typeof part === "object" && part !== null && "strings" in part && "values" in part) {
    const sql = part as { strings: string[]; values: unknown[] };
    return sql.strings.reduce(
      (result, chunk, index) => result + chunk + (index < sql.values.length ? flattenSql(sql.values[index]) : ""),
      "",
    );
  }
  return "";
}

vi.mock("@/lib/prisma", () => ({
  prisma: {
    grantee: { groupBy: mocks.granteeGroupBy },
    inquiry: { count: mocks.inquiryCount },
    $queryRaw: mocks.queryRaw,
  },
  getProfilingRegistrationCountByStatus: mocks.profilingCount,
}));

vi.mock("@/lib/skeap-capacity", () => ({
  getSkeapCapacitySnapshot: mocks.capacitySnapshot,
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
    mocks.capacitySnapshot.mockResolvedValue({
      activeCount: 3,
      maxSlots: 20,
      availableSlots: 17,
      isFull: false,
    });
    mocks.inquiryCount.mockResolvedValue(1);
    mocks.profilingCount.mockResolvedValue(7);
    mocks.queryRaw
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { sitio: PICO_SITIOS[0] ?? "Purok 1", sex: "MALE" },
        { sitio: "Unspecified", sex: "FEMALE" },
        { sitio: null, sex: "OTHER" },
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

    expect(analytics.totalRegisteredYouth).toBe(3);
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
    expect(analytics.activeGranteeGenderDistribution).toEqual({
      male: 8,
      female: 9,
      notSpecified: 2,
    });
    expect(analytics.youthGenderDistribution).toEqual({
      male: 1,
      female: 1,
      notSpecified: 1,
    });
    expect(
      analytics.youthGenderDistribution.male +
      analytics.youthGenderDistribution.female +
      analytics.youthGenderDistribution.notSpecified,
    ).toBe(analytics.totalRegisteredYouth);
    expect(analytics.populationDistribution.reduce((total, row) => total + row.population, 0))
      .toBe(analytics.totalRegisteredYouth);
    expect(analytics.populationDistribution[analytics.populationDistribution.length - 1]).toEqual({
      sitio: "Unspecified",
      population: 2,
    });
    const youthCohortQuery = mocks.queryRaw.mock.calls[1]
      .map((part: unknown) => flattenSql(part))
      .join("");
    expect(youthCohortQuery).toContain('registration."reviewStatus" =');
    expect(youthCohortQuery).toContain('registration."archivedAt" IS NULL');
    expect(youthCohortQuery).toContain('user_record."isActive" =');
    expect(youthCohortQuery).toContain("identity_rank = 1");
    expect(youthCohortQuery).toContain(", profiles_by_sitio AS");
    expect(youthCohortQuery).toContain('public."kk_profiling_registrations"');
    expect(youthCohortQuery).toContain('public."grantees"');
    const granteeSexQuery = (mocks.queryRaw.mock.calls[2][0] as TemplateStringsArray).join("");
    expect(granteeSexQuery).toContain(`profile."sex"::text IN ('MALE', 'FEMALE')`);
    expect(granteeSexQuery).toContain('public."kk_profiling_registrations"');
    expect(granteeSexQuery).toContain('registration."userId" = grantee."userId"');
    expect(granteeSexQuery).toContain('public."skeap_applications"');
    expect(granteeSexQuery).toContain('application."userId" = grantee."userId"');
    expect(granteeSexQuery).toContain(`grantee."status" IN ('ACTIVE', 'PROBATIONARY')`);
    expect(granteeSexQuery).not.toContain("GRADUATED");
    const yearLevelQuery = (mocks.queryRaw.mock.calls[3][0] as TemplateStringsArray).join("");
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
