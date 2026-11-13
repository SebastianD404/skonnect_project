import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  transaction: vi.fn(),
  updateProfile: vi.fn(),
  updateGrantee: vi.fn(),
  writeAuditLog: vi.fn(),
  refreshView: vi.fn(),
  syncKkProfile: vi.fn(),
  upsertNotification: vi.fn(),
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

vi.mock("@/lib/kk-profile-sync", () => ({
  syncKkProfileFromLatestRegistration: mocks.syncKkProfile,
}));

import { checkAndArchiveAgedOutMembers } from "@/lib/archiveAgedOutMembers";
import { KK_MEMBER_AGE_OUT_NOTICE_MESSAGE } from "@/lib/kk-member-archive";

function createProfile(granteeStatus: "ACTIVE" | "PROBATIONARY" = "ACTIVE") {
  return {
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
        status: granteeStatus,
        remarks: null,
      },
    },
  };
}

describe("checkAndArchiveAgedOutMembers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([createProfile()]);
    mocks.updateProfile.mockResolvedValue({ count: 1 });
    mocks.updateGrantee.mockResolvedValue({ count: 1 });
    mocks.transaction.mockImplementation(async (callback) => callback({
      profilingRegistration: { updateMany: mocks.updateProfile },
      grantee: { updateMany: mocks.updateGrantee },
      notification: { upsert: mocks.upsertNotification },
    }));
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.refreshView.mockResolvedValue(undefined);
    mocks.syncKkProfile.mockResolvedValue(undefined);
    mocks.upsertNotification.mockResolvedValue({});
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
        archivedReason: "Aged Out (31+)",
        archivedAt: expect.any(Date),
      },
    }));
    expect(mocks.updateGrantee).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "grantee-id", status: { in: ["ACTIVE", "PROBATIONARY"] } },
      data: {
        status: "REMOVED",
        dateRemoved: expect.any(Date),
        remarks: "Disqualified: Exceeded KK age limit (Turned 31)",
      },
    }));
    expect(mocks.upsertNotification).toHaveBeenCalledWith({
      where: {
        userId_sourceKey: {
          userId: "user-id",
          sourceKey: "kk-age-out:age-limit-reached",
        },
      },
      create: {
        userId: "user-id",
        sourceKey: "kk-age-out:age-limit-reached",
        message: `KK age-limit update: ${KK_MEMBER_AGE_OUT_NOTICE_MESSAGE}`,
      },
      update: {
        message: `KK age-limit update: ${KK_MEMBER_AGE_OUT_NOTICE_MESSAGE}`,
      },
    });
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

  it("removes probationary grantees and records the scheduled trigger", async () => {
    mocks.findMany.mockResolvedValue([createProfile("PROBATIONARY")]);

    await checkAndArchiveAgedOutMembers("admin-id", "scheduled");

    expect(mocks.updateGrantee).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "grantee-id", status: { in: ["ACTIVE", "PROBATIONARY"] } },
    }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "PROFILE_ARCHIVED",
        metadata: expect.objectContaining({ trigger: "scheduled" }),
      }),
    );
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
