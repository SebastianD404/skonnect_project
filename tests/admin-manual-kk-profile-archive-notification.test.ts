import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireRole: vi.fn(),
  transaction: vi.fn(),
  findRegistration: vi.fn(),
  updateRegistration: vi.fn(),
  writeAuditLog: vi.fn(),
  closeOpenApplications: vi.fn(),
  syncKkProfile: vi.fn(),
  refreshKkView: vi.fn(),
  refreshSkeapView: vi.fn(),
  notifyProfileArchived: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireRole: mocks.requireRole }));
vi.mock("@/lib/prisma", () => ({ prisma: { $transaction: mocks.transaction } }));
vi.mock("@/lib/audit/logger", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/kk-archive-skeap-applications", () => ({
  closeOpenSkeapApplicationsForKkArchive: mocks.closeOpenApplications,
}));
vi.mock("@/lib/kk-profile-sync", () => ({
  syncKkProfileFromLatestRegistration: mocks.syncKkProfile,
}));
vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshKkProfilingApplicationsAdminView: mocks.refreshKkView,
  refreshSkeapApplicationsAdminView: mocks.refreshSkeapView,
}));
vi.mock("@/lib/notify-profile-archived", () => ({
  notifyProfileArchived: mocks.notifyProfileArchived,
}));

import { PATCH } from "@/app/api/admin/members/[id]/archive/route";

describe("manual KK profile archive notification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "admin-1" });
    mocks.findRegistration.mockResolvedValue({
      id: "registration-1",
      userId: "user-1",
      fullName: "Resident Name",
      email: "resident@example.com",
      reviewStatus: "Approved",
      user: {
        id: "user-1",
        email: "resident@example.com",
        fullName: "Resident Name",
        grantee: null,
      },
    });
    mocks.updateRegistration.mockImplementation(async ({ data }) => ({
      id: "registration-1",
      userId: "user-1",
      reviewStatus: data.reviewStatus,
      archivedReason: data.archivedReason,
      archivedAt: new Date("2026-11-18T10:00:00.000Z"),
      archivedBy: data.archivedBy,
    }));
    mocks.transaction.mockImplementation(async (callback) => callback({
      profilingRegistration: {
        findUnique: mocks.findRegistration,
        update: mocks.updateRegistration,
      },
    }));
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.closeOpenApplications.mockResolvedValue(undefined);
    mocks.syncKkProfile.mockResolvedValue(undefined);
    mocks.refreshKkView.mockResolvedValue(undefined);
    mocks.refreshSkeapView.mockResolvedValue(undefined);
    mocks.notifyProfileArchived.mockResolvedValue({
      emailStatus: "SENT",
      inAppStatus: "SENT",
    });
  });

  it("notifies the resident after a manual archive and returns delivery status", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/members/registration-1/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveReason: "Transferred Residence" }),
      }),
      { params: Promise.resolve({ id: "registration-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      archiveNotification: { emailStatus: "SENT", inAppStatus: "SENT" },
    });
    expect(mocks.notifyProfileArchived).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      email: "resident@example.com",
      fullName: "Resident Name",
      archiveType: "ADMIN_ARCHIVED",
      reason: "Transferred Residence",
      archivedAt: new Date("2026-11-18T10:00:00.000Z"),
    }));
  });

  it("trims and persists custom reasons and records them in the audit log", async () => {
    const response = await PATCH(
      new Request("http://localhost/api/admin/members/registration-1/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          archiveReason: "Other (Specify)",
          customReason: "  Moved to a different district  ",
        }),
      }),
      { params: Promise.resolve({ id: "registration-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.updateRegistration).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ archivedReason: "Other: Moved to a different district" }),
    }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      actorId: "admin-1",
      afterData: expect.objectContaining({ archivedReason: "Other: Moved to a different district" }),
      metadata: expect.objectContaining({ archivedReason: "Other: Moved to a different district" }),
    }));
    expect(mocks.notifyProfileArchived).toHaveBeenCalledWith(expect.objectContaining({
      reason: "Other: Moved to a different district",
    }));
  });

  it("rejects an empty custom reason before archiving", async () => {
    for (const customReason of ["  ", "x".repeat(121)]) {
      const response = await PATCH(
        new Request("http://localhost/api/admin/members/registration-1/archive", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ archiveReason: "Other (Specify)", customReason }),
        }),
        { params: Promise.resolve({ id: "registration-1" }) },
      );
      expect(response.status).toBe(400);
    }

    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("archives deceased residents without dispatching notifications", async () => {
    mocks.notifyProfileArchived.mockResolvedValue({
      emailStatus: "SKIPPED_DECEASED",
      inAppStatus: "SKIPPED_DECEASED",
    });

    const response = await PATCH(
      new Request("http://localhost/api/admin/members/registration-1/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archiveReason: "Deceased" }),
      }),
      { params: Promise.resolve({ id: "registration-1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      archiveNotification: {
        emailStatus: "SKIPPED_DECEASED",
        inAppStatus: "SKIPPED_DECEASED",
      },
    });
    expect(mocks.notifyProfileArchived).toHaveBeenCalledWith(expect.objectContaining({
      reason: "Deceased",
    }));
  });
});
