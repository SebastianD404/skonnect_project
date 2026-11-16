import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
  },
}));

import {
  getPlatformAccountMetricSegment,
  getPlatformAccountMetrics,
  getPlatformAccountUsersPage,
} from "@/lib/platform-metrics";

describe("platform account metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reconciles all account segments to the materialized-view total", async () => {
    mocks.queryRaw.mockResolvedValueOnce([
      { segment: "VERIFIED_KK", count: BigInt(50) },
      { segment: "PENDING_UNPROFILED", count: BigInt(30) },
      { segment: "ADMIN_STAFF", count: BigInt(10) },
      { segment: "ARCHIVED_INACTIVE", count: BigInt(10) },
    ]);

    const metrics = await getPlatformAccountMetrics();

    expect(metrics).toEqual({
      totalAccounts: 100,
      activeKkYouthAndGrantees: 50,
      unprofiledOrPending: 30,
      adminStaff: 10,
      archivedOrInactive: 10,
    });
    expect(
      metrics.activeKkYouthAndGrantees +
        metrics.unprofiledOrPending +
        metrics.adminStaff +
        metrics.archivedOrInactive,
    ).toBe(metrics.totalAccounts);
  });

  it("maps metric keys to the materialized-view segments", () => {
    expect(getPlatformAccountMetricSegment("verified")).toBe("VERIFIED_KK");
    expect(getPlatformAccountMetricSegment("all")).toBeNull();
  });

  it("returns a filtered page and matching count from the materialized view", async () => {
    const rows = [{
      id: "user-1",
      fullName: "Ada Lovelace",
      displayName: "LOVELACE, ADA",
      email: "ada@example.test",
      avatarUrl: null,
      role: "YOUTH",
      isActive: true,
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      username: null,
      phoneNumber: null,
      barangay: "Pico",
      languagePref: "en",
      skeapStatus: "N/A",
      skeapApplicationStatus: null,
      granteeStatus: null,
      granteeSchool: null,
      granteeYearLevel: null,
      granteeGeneralAverage: null,
      granteeDateEnrolled: null,
      granteeArchivedAt: null,
      granteeRetentionExpiresAt: null,
    }];
    mocks.queryRaw
      .mockResolvedValueOnce(rows)
      .mockResolvedValueOnce([{ count: BigInt(1) }]);

    const result = await getPlatformAccountUsersPage({
      metric: "verified",
      role: null,
      query: "Ada",
      page: 2,
      pageSize: 10,
    });

    expect(result).toEqual({ rows, totalCount: 1 });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
  });
});
