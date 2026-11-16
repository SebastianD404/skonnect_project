import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  transaction: vi.fn(),
  updateProfile: vi.fn(),
  findApplications: vi.fn(),
  updateApplication: vi.fn(),
  updateInquiry: vi.fn(),
  createMessage: vi.fn(),
  upsertNotification: vi.fn(),
  writeAuditLog: vi.fn(),
  refreshKkView: vi.fn(),
  refreshSkeapView: vi.fn(),
  syncKkProfile: vi.fn(),
  sendEmail: vi.fn(),
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

vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshKkProfilingApplicationsAdminView: mocks.refreshKkView,
  refreshSkeapApplicationsAdminView: mocks.refreshSkeapView,
}));

vi.mock("@/lib/kk-profile-sync", () => ({
  syncKkProfileFromLatestRegistration: mocks.syncKkProfile,
}));

vi.mock("@/lib/kk-archive-skeap-applications", () => ({
  closeOpenSkeapApplicationsForKkArchive: vi.fn(async () => {
    const applications = await mocks.findApplications();
    for (const application of applications) {
      await mocks.updateApplication(application);
      if (application.inquiry) await mocks.updateInquiry(application.inquiry.id);
    }
    return { closedCount: applications.length };
  }),
}));

vi.mock("@/lib/broadcast-email", () => ({
  createGmailTransporter: vi.fn(() => ({})),
  sendBroadcastEmail: mocks.sendEmail,
}));

import { sweepAgedOutKkProfiles } from "@/lib/archiveAgedOutMembers";
import { KK_MEMBER_AGE_OUT_NOTICE_MESSAGE } from "@/lib/kk-member-archive";

function createProfile(birthDate = new Date("1990-01-01T00:00:00.000Z")) {
  return {
    id: "profile-id",
    fullName: "Aldrin Jay Acosta",
    birthDate,
    reviewStatus: "Approved",
    archivedReason: null,
    archivedAt: null,
    userId: "user-id",
    user: {
      id: "user-id",
      email: "youth@example.com",
      fullName: "Aldrin Jay Acosta",
      emailNotifications: false,
    },
  };
}

describe("sweepAgedOutKkProfiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([createProfile()]);
    mocks.updateProfile.mockResolvedValue({ count: 1 });
    mocks.findApplications.mockResolvedValue([]);
    mocks.updateApplication.mockResolvedValue({ count: 1 });
    mocks.createMessage.mockResolvedValue({ id: "message-id" });
    mocks.upsertNotification.mockResolvedValue({});
    mocks.transaction.mockImplementation(async (callback) => callback({
      profilingRegistration: { updateMany: mocks.updateProfile },
      skeapApplication: {
        findMany: mocks.findApplications,
        updateMany: mocks.updateApplication,
      },
      inquiry: { update: mocks.updateInquiry },
      granteeMessage: { create: mocks.createMessage },
      notification: { upsert: mocks.upsertNotification },
    }));
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.refreshKkView.mockResolvedValue(undefined);
    mocks.refreshSkeapView.mockResolvedValue(undefined);
    mocks.syncKkProfile.mockResolvedValue(undefined);
  });

  it("archives eligible profiles as system auto without revoking scholarship records", async () => {
    const result = await sweepAgedOutKkProfiles("admin-id");
    const cutoff = new Date();
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 31);

    expect(mocks.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        reviewStatus: "Approved",
        birthDate: { lte: expect.any(Date) },
      },
    }));
    const queryCutoff = mocks.findMany.mock.calls[0][0].where.birthDate.lte as Date;
    expect(queryCutoff.getUTCFullYear()).toBe(cutoff.getUTCFullYear());
    expect(mocks.updateProfile).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        id: "profile-id",
        reviewStatus: "Approved",
        birthDate: { lte: queryCutoff },
      },
      data: {
        reviewStatus: "Archived",
        archivedReason: "AGED_OUT_31",
        archivedAt: expect.any(Date),
        archivedBy: "SYSTEM_AUTO",
      },
    }));
    expect(mocks.upsertNotification).toHaveBeenCalledWith({
      where: {
        userId_sourceKey: {
          userId: "user-id",
          sourceKey: "kk-age-out:profile-id",
        },
      },
      create: {
        userId: "user-id",
        sourceKey: "kk-age-out:profile-id",
        message: expect.stringContaining(KK_MEMBER_AGE_OUT_NOTICE_MESSAGE),
      },
      update: {
        message: expect.stringContaining(KK_MEMBER_AGE_OUT_NOTICE_MESSAGE),
      },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "PROFILE_ARCHIVED",
      afterData: expect.objectContaining({ archivedBy: "SYSTEM_AUTO" }),
    }));
    expect(mocks.refreshKkView).toHaveBeenCalledOnce();
    expect(mocks.refreshSkeapView).toHaveBeenCalledOnce();
    expect(result).toEqual({ archivedCount: 1, closedApplicationCount: 0 });
  });

  it("withdraws pending and waitlisted SKEAP applications when archiving an aged-out profile", async () => {
    mocks.findApplications.mockResolvedValue([
      { id: "pending-app", status: "PENDING" },
      { id: "waitlisted-app", status: "WAITLISTED", inquiry: { id: "waitlist-inquiry" } },
    ]);

    const result = await sweepAgedOutKkProfiles("admin-id", "scheduled");

    expect(mocks.updateApplication).toHaveBeenCalledTimes(2);
    expect(mocks.updateInquiry).toHaveBeenCalledWith("waitlist-inquiry");
    expect(result).toEqual({ archivedCount: 1, closedApplicationCount: 2 });
  });

  it("does not archive a profile until its exact current age reaches 31", async () => {
    const today = new Date();
    const birthDate = new Date(today);
    birthDate.setUTCFullYear(birthDate.getUTCFullYear() - 31);
    birthDate.setUTCDate(birthDate.getUTCDate() + 1);
    mocks.findMany.mockResolvedValue([createProfile(birthDate)]);

    await expect(sweepAgedOutKkProfiles("admin-id")).resolves.toEqual({
      archivedCount: 0,
      closedApplicationCount: 0,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("archives the profile on its 31st birthday and includes the exact age in its notice", async () => {
    const birthDate = new Date();
    birthDate.setUTCFullYear(birthDate.getUTCFullYear() - 31);
    mocks.findMany.mockResolvedValue([createProfile(birthDate)]);

    await expect(sweepAgedOutKkProfiles("admin-id")).resolves.toEqual({
      archivedCount: 1,
      closedApplicationCount: 0,
    });

    expect(mocks.updateProfile).toHaveBeenCalledOnce();
    expect(mocks.upsertNotification).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        message: expect.stringContaining("Your recorded age is 31."),
      }),
    }));
  });

  it("does not refresh views or archive when no profiles are eligible", async () => {
    mocks.findMany.mockResolvedValue([]);

    await expect(sweepAgedOutKkProfiles("admin-id")).resolves.toEqual({
      archivedCount: 0,
      closedApplicationCount: 0,
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.refreshKkView).not.toHaveBeenCalled();
  });

  it("does not archive the same profile twice", async () => {
    mocks.updateProfile.mockResolvedValue({ count: 0 });

    await expect(sweepAgedOutKkProfiles("admin-id")).resolves.toEqual({
      archivedCount: 0,
      closedApplicationCount: 0,
    });
    expect(mocks.createMessage).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
