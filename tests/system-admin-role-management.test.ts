import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  findTarget: vi.fn(),
  updateUser: vi.fn(),
  findLatestApplication: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
  refreshSystemUsersAdminView: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshSystemUsersAdminView: mocks.refreshSystemUsersAdminView,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { PATCH } from "@/app/api/system-admin/users/[id]/role/route";

function makeRequest(role: string) {
  return new NextRequest("http://localhost/api/system-admin/users/target-profile/role", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role }),
  });
}

function patchRole(role: string, targetId = "target-profile") {
  return PATCH(makeRequest(role), { params: Promise.resolve({ id: targetId }) });
}

describe("system-admin SK Admin role governance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-admin" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-profile", role: "SUPER_ADMIN" });
    mocks.findTarget.mockResolvedValue({
      id: "target-profile",
      authId: "auth-target",
      fullName: "Youth Applicant",
      email: "youth@example.com",
      role: "YOUTH",
      isActive: true,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      grantee: null,
    });
    mocks.updateUser.mockImplementation(async ({ data }) => ({
      id: "target-profile",
      fullName: "Youth Applicant",
      email: "youth@example.com",
      role: data.role,
      isActive: true,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    }));
    mocks.findLatestApplication.mockResolvedValue({ status: "PENDING" });
    mocks.writeAuditLog.mockResolvedValue({});
    mocks.refreshSystemUsersAdminView.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback({
      user: { findUnique: mocks.findTarget, update: mocks.updateUser },
      skeapApplication: { findFirst: mocks.findLatestApplication },
    }));
  });

  it("rejects manual Grantee role requests with the SKEAP-managed status message", async () => {
    const response = await patchRole("GRANTEE");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Grantee status is managed automatically through SKEAP Applications and Active Grantees and cannot be changed manually.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("blocks changing a current GRANTEE to Youth", async () => {
    mocks.findTarget.mockResolvedValueOnce({
      id: "target-profile",
      authId: "auth-target",
      fullName: "Current Grantee",
      email: "grantee@example.com",
      role: "GRANTEE",
      isActive: true,
      updatedAt: new Date(),
      grantee: { status: "REVOKED" },
    });

    const response = await patchRole("YOUTH");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Grantee status is managed automatically through SKEAP Applications and Active Grantees and cannot be changed manually.",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });

  it.each([
    ["active Grantee record", { status: "ACTIVE" }, "PENDING"],
    ["approved SKEAP application", null, "APPROVED"],
  ])("blocks SK Admin elevation for an account with an %s", async (_label, grantee, latestStatus) => {
    mocks.findTarget.mockResolvedValueOnce({
      id: "target-profile",
      authId: "auth-target",
      fullName: "Youth Applicant",
      email: "youth@example.com",
      role: "YOUTH",
      isActive: true,
      updatedAt: new Date(),
      grantee,
    });
    if (grantee === null) {
      mocks.findLatestApplication.mockResolvedValueOnce({ status: latestStatus });
    }

    const response = await patchRole("SK_OFFICIAL");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: "Grantee status is managed automatically through SKEAP Applications and Active Grantees and cannot be changed manually.",
    });
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it.each([
    ["YOUTH", "SK_OFFICIAL"],
    ["SK_OFFICIAL", "YOUTH"],
  ])("allows the %s to %s transition and audits it", async (previousRole, newRole) => {
    mocks.findTarget.mockResolvedValueOnce({
      id: "target-profile",
      authId: "auth-target",
      fullName: "Youth Applicant",
      email: "youth@example.com",
      role: previousRole,
      isActive: true,
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
      grantee: null,
    });
    mocks.updateUser.mockResolvedValueOnce({
      id: "target-profile",
      fullName: "Youth Applicant",
      email: "youth@example.com",
      role: newRole,
      isActive: true,
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
    });

    const response = await patchRole(newRole);

    expect(response.status).toBe(200);
    expect(mocks.updateUser).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "target-profile" },
      data: { role: newRole },
    }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorId: "admin-profile",
      targetTable: "users",
      targetId: "target-profile",
      beforeData: { role: previousRole },
      afterData: { role: newRole },
      metadata: expect.objectContaining({
        actorId: "admin-profile",
        targetUserId: "target-profile",
        previousRole,
        newRole,
        timestamp: expect.any(String),
      }),
    }));
    expect(mocks.refreshSystemUsersAdminView).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/system-admin/users",
      "/system-admin",
    ]);
  });

  it.each([
    ["System Admin account", "SUPER_ADMIN", "auth-target"],
    ["current account", "SK_OFFICIAL", "auth-admin"],
  ])("rejects role changes for a %s", async (_label, role, authId) => {
    mocks.findTarget.mockResolvedValueOnce({
      id: authId === "auth-admin" ? "another-profile-id" : "target-profile",
      authId,
      fullName: "Protected Account",
      email: "protected@example.com",
      role,
      isActive: true,
      updatedAt: new Date(),
      grantee: null,
    });

    const response = await patchRole("YOUTH");

    expect(response.status).toBe(403);
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
