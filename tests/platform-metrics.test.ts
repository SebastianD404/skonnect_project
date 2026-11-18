import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
  userFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $queryRaw: mocks.queryRaw,
    user: { findMany: mocks.userFindMany },
  },
}));

import {
  getPlatformAccountMetricSegment,
  getPlatformAccountMetrics,
  getPlatformAccountUsersPage,
  getPlatformAccountUsersForExport,
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
    expect(mocks.queryRaw.mock.calls[0]?.[0].sql).toMatch(
      /WHEN account\."is_active"\s+AND account\."role" IN \('SK_OFFICIAL', 'SUPER_ADMIN'\)\s+THEN 'ADMIN_STAFF'/,
    );
  });

  it("maps metric keys to the materialized-view segments", () => {
    expect(getPlatformAccountMetricSegment("verified")).toBe("VERIFIED_KK");
    expect(getPlatformAccountMetricSegment("all")).toBeNull();
  });

  it("normalizes the SK Admin segment before filtering users", async () => {
    const rows = [{
      id: "user-1",
      fullName: "Ada Lovelace",
      displayName: "LOVELACE, ADA",
      email: "ada@example.test",
      avatarUrl: null,
      role: "SK_OFFICIAL",
      isActive: true,
      kkStatus: "UNPROFILED",
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
      metric: "adminStaff",
      role: null,
      query: "Ada",
      page: 2,
      pageSize: 10,
    });

    expect(result).toEqual({ rows, totalCount: 1 });
    expect(mocks.queryRaw).toHaveBeenCalledTimes(2);
    expect(mocks.queryRaw.mock.calls[0]?.[0].sql).toContain(`account."metric_segment" = ?`);
    expect(mocks.queryRaw.mock.calls[0]?.[0].sql).toContain("categorized_users");
    expect(mocks.queryRaw.mock.calls[0]?.[0].sql).toContain(`LEFT JOIN "public"."users" AS user_record`);
    expect(mocks.queryRaw.mock.calls[0]?.[0].sql).toContain(`AS "kkStatus"`);
    expect(mocks.queryRaw.mock.calls[0]?.[0].sql).toMatch(
      /account\."role" IN \('SK_OFFICIAL', 'SUPER_ADMIN'\)/,
    );
  });

  it("loads every export user matching the active metric, role, and search filters", async () => {
    const accounts = [
      { id: "user-1", skeapStatus: "Active Scholar" },
      { id: "user-2", skeapStatus: "N/A" },
    ];
    const users = [
      {
        id: "user-2",
        fullName: "Ada Lovelace",
        email: "ada@example.test",
        role: "SK_OFFICIAL",
        isActive: true,
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "user-1",
        fullName: "Grace Hopper",
        email: "grace@example.test",
        role: "SK_OFFICIAL",
        isActive: true,
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ];
    mocks.queryRaw.mockResolvedValueOnce(accounts);
    mocks.userFindMany.mockResolvedValueOnce(users);

    const result = await getPlatformAccountUsersForExport({
      metric: "adminStaff",
      role: "SK_OFFICIAL",
      query: "Ada",
    });

    expect(result).toEqual([
      { ...users[1], skeapStatus: "Active Scholar" },
      { ...users[0], skeapStatus: "N/A" },
    ]);
    const sql = mocks.queryRaw.mock.calls[0]?.[0].sql as string;
    expect(sql).toContain(`account."metric_segment" = ?`);
    expect(sql).toContain(`account."role" = ?`);
    expect(sql).toContain(`LOWER(account."full_name")`);
    expect(sql).not.toMatch(/\bLIMIT\b|\bOFFSET\b/i);
    expect(mocks.userFindMany).toHaveBeenCalledWith({
      where: { id: { in: ["user-1", "user-2"] } },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
  });
});
