import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  transaction: vi.fn(),
  updateProfile: vi.fn(),
  updateGrantee: vi.fn(),
  writeAuditLog: vi.fn(),
  refreshView: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    profilingRegistration: { findMany: mocks.findMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/grantee-archive-view", () => ({
  refreshInactiveGranteesView: mocks.refreshView,
}));

import { checkAndArchiveAgedOutMembers } from "@/lib/archiveAgedOutMembers";

describe("checkAndArchiveAgedOutMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        id: "profile-id",
        fullName: "Aldrin Jay Acosta",
        birthDate: new Date("1990-01-01T00:00:00.000Z"),
        reviewStatus: "Approved",
        archivedReason: null,
        archivedAt: null,
        userId: "user-id",
        user: {
          grantee: {
            id: "grantee-id",
            status: "ACTIVE",
            remarks: null,
          },
        },
      },
    ]);
    mocks.updateProfile.mockResolvedValue({ count: 1 });
    mocks.updateGrantee.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) => callback({
      profilingRegistration: { updateMany: mocks.updateProfile },
      grantee: { updateMany: mocks.updateGrantee },
    }));
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.refreshView.mockResolvedValue(undefined);
  });

  it("archives approved profiles past the 31-year cutoff and removes active grantees", async () => {
    const result = await checkAndArchiveAgedOutMembers("admin-id");
    const cutoff = new Date();
    cutoff.setFullYear(cutoff.getFullYear() - 31);

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        reviewStatus: "Approved",
        birthDate: { lte: expect.any(Date) },
      },
    }));
    const queryCutoff = mocks.findMany.mock.calls[0][0].where.birthDate.lte as Date;
    expect(queryCutoff.getFullYear()).toBe(cutoff.getFullYear());
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "profile-id",
        reviewStatus: "Approved",
        birthDate: { lte: queryCutoff },
      },
      data: {
        reviewStatus: "Archived",
        archivedReason: "Aged Out (Turned 31)",
        archivedAt: expect.any(Date),
      },
    }));
    expect(mocks.updateGrantee).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "grantee-id", status: "ACTIVE" },
      data: {
        status: "REMOVED",
        dateRemoved: expect.any(Date),
        remarks: "Disqualified: Exceeded KK age limit (Turned 31)",
      },
    }));
    expect(mocks.writeAuditLog).toHaveBeenCalledTimes(2);
    expect(mocks.refreshView).toHaveBeenCalledOnce();
    expect(result).toEqual({ archivedCount: 1, removedGranteeCount: 1 });
  });

  it("does not refresh the grantee view when no profiles are eligible", async () => {
    mocks.findMany.mockResolvedValue([]);

    await expect(checkAndArchiveAgedOutMembers("admin-id")).resolves.toEqual({
      archivedCount: 0,
      removedGranteeCount: 0,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.refreshView).not.toHaveBeenCalled();
  });

  it("does not archive the same profile twice", async () => {
    mocks.updateProfile.mockResolvedValue({ count: 0 });

    await expect(checkAndArchiveAgedOutMembers("admin-id")).resolves.toEqual({
      archivedCount: 0,
      removedGranteeCount: 0,
    });
    expect(mocks.updateGrantee).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
