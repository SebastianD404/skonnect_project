import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  getUsers: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
}));

vi.mock("@/lib/platform-metrics", () => ({
  getPlatformAccountUsersForExport: mocks.getUsers,
  isPlatformAccountMetricKey: (value: string) =>
    ["all", "verified", "pending", "adminStaff", "archived"].includes(value),
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {},
}));

import { Role } from "@prisma/client";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/system-admin/users/export/route";

describe("system admin user export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-admin" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: Role.SUPER_ADMIN });
    mocks.getUsers.mockResolvedValue([
      {
        id: "user-1",
        fullName: "Ada Lovelace",
        email: "ada@example.test",
        role: Role.SUPER_ADMIN,
        isActive: true,
        skeapStatus: "N/A",
        createdAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ]);
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it("exports all filtered rows with governance columns and role-aware filename", async () => {
    const request = new NextRequest(
      "http://localhost/api/system-admin/users/export?role=SYSTEM_ADMIN&metric=verified&q=Ada",
    );
    const response = await GET(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(
      `skonnect-system-admins-${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
    expect(mocks.getUsers).toHaveBeenCalledWith({
      metric: "verified",
      role: Role.SUPER_ADMIN,
      query: "Ada",
    });

    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "RECORDS_EXPORTED",
        actorId: "admin-1",
        targetTable: "users",
        targetId: "bulk",
        metadata: expect.objectContaining({
          selectedRoleFilter: "SYSTEM_ADMIN",
          metricFilter: "verified",
          searchQuery: "Ada",
          exportedRowCount: 1,
        }),
      }),
    );
  });

  it("rejects unsupported role filters", async () => {
    const response = await GET(
      new NextRequest("http://localhost/api/system-admin/users/export?role=UNKNOWN"),
    );

    expect(response.status).toBe(400);
    expect(mocks.getUsers).not.toHaveBeenCalled();
  });
});
