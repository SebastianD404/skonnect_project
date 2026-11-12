import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRegistration: vi.fn(),
  updateRegistration: vi.fn(),
  updateGrantee: vi.fn(),
  transaction: vi.fn(),
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
  refreshView: vi.fn(),
  updateUser: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mocks.requireRole,
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/grantee-archive-view", () => ({
  refreshInactiveGranteesView: mocks.refreshView,
}));

import { PATCH } from "@/app/api/admin/members/[id]/archive/route";

describe("member profile archive and linked grantee lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "admin-id" });
    mocks.findRegistration.mockResolvedValue({
      id: "profile-id",
      reviewStatus: "Approved",
      fullName: "Aldrin Jay Acosta",
      user: {
        grantee: {
          id: "grantee-id",
          status: "ACTIVE",
          remarks: null,
        },
      },
    });
    mocks.updateRegistration.mockResolvedValue({
      id: "profile-id",
      reviewStatus: "Archived",
      archivedReason: "Transferred Residence",
      archivedAt: new Date("2026-11-07T00:00:00.000Z"),
    });
    mocks.updateGrantee.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) => callback({
      profilingRegistration: {
        findUnique: mocks.findRegistration,
        update: mocks.updateRegistration,
      },
      grantee: { updateMany: mocks.updateGrantee },
      user: { update: mocks.updateUser },
    }));
    mocks.refreshView.mockResolvedValue(undefined);
  });

  it("archives the member and removes an active linked grantee without changing the user", async () => {
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveReason: "Transferred Residence" }),
    }), {
      params: Promise.resolve({ id: "profile-id" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateRegistration).toHaveBeenCalledWith({
      where: { id: "profile-id" },
      data: {
        reviewStatus: "Archived",
        archivedReason: "Transferred Residence",
        archivedAt: expect.any(Date),
      },
    });
    expect(mocks.updateGrantee).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "grantee-id", status: { in: ["ACTIVE", "PROBATIONARY"] } },
      data: expect.objectContaining({
        status: "REMOVED",
        remarks: "Member profile archived by administrator",
      }),
    }));
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(2);
    expect(mocks.refreshView).toHaveBeenCalledOnce();
  });

  it("does not cascade to a graduated grantee", async () => {
    mocks.findRegistration.mockResolvedValue({
      id: "profile-id",
      reviewStatus: "Approved",
      fullName: "Aldrin Jay Acosta",
      user: { grantee: { id: "grantee-id", status: "GRADUATED", remarks: null } },
    });

    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveReason: "Deceased" }),
    }), {
      params: Promise.resolve({ id: "profile-id" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateGrantee).not.toHaveBeenCalled();
    expect(mocks.refreshView).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects archive reasons outside the supported list", async () => {
    const response = await PATCH(new Request("http://localhost", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveReason: "Archived by administrator" }),
    }), {
      params: Promise.resolve({ id: "profile-id" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
