import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findRegistration: vi.fn(),
  updateRegistration: vi.fn(),
  transaction: vi.fn(),
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
  refreshKkAdminView: vi.fn(),
  refreshSkeapAdminView: vi.fn(),
  closeSkeapApplications: vi.fn(),
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

vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshKkProfilingApplicationsAdminView: mocks.refreshKkAdminView,
  refreshSkeapApplicationsAdminView: mocks.refreshSkeapAdminView,
}));

vi.mock("@/lib/kk-archive-skeap-applications", () => ({
  closeOpenSkeapApplicationsForKkArchive: mocks.closeSkeapApplications,
}));

vi.mock("@/lib/kk-profile-sync", () => ({
  syncKkProfileFromLatestRegistration: vi.fn(),
}));

import { PATCH } from "@/app/api/admin/members/[id]/archive/route";

function requestWithReason(archiveReason: string) {
  return new Request("http://localhost", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ archiveReason }),
  });
}

describe("KK member profile archive lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "admin-id" });
    mocks.findRegistration.mockResolvedValue({
      id: "profile-id",
      userId: "user-id",
      reviewStatus: "Approved",
      fullName: "Aldrin Jay Acosta",
      user: {
        id: "user-id",
        fullName: "Aldrin Jay Acosta",
        grantee: {
          id: "grantee-id",
          status: "REMOVED",
          remarks: null,
        },
      },
    });
    mocks.updateRegistration.mockResolvedValue({
      id: "profile-id",
      reviewStatus: "Archived",
      archivedReason: "Transferred Residence",
      archivedAt: new Date("2026-11-07T00:00:00.000Z"),
      archivedBy: "admin-id",
    });
    mocks.closeSkeapApplications.mockResolvedValue({ closedCount: 0 });
    mocks.transaction.mockImplementation(async (callback) => callback({
      profilingRegistration: {
        findUnique: mocks.findRegistration,
        update: mocks.updateRegistration,
      },
    }));
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.refreshKkAdminView.mockResolvedValue(undefined);
    mocks.refreshSkeapAdminView.mockResolvedValue(undefined);
  });

  it("blocks archiving an active SKEAP grantee in the KK registry", async () => {
    mocks.findRegistration.mockResolvedValue({
      id: "profile-id",
      userId: "user-id",
      reviewStatus: "Approved",
      fullName: "Aldrin Jay Acosta",
      user: { id: "user-id", grantee: { id: "grantee-id", status: "ACTIVE" } },
    });

    const response = await PATCH(requestWithReason("Transferred Residence"), {
      params: Promise.resolve({ id: "profile-id" }),
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Active SKEAP grantees must be managed in Active Grantees first.",
    });
    expect(mocks.updateRegistration).not.toHaveBeenCalled();
    expect(mocks.closeSkeapApplications).not.toHaveBeenCalled();
  });

  it("archives a non-grantee and closes open SKEAP applications for residence transfer", async () => {
    const response = await PATCH(requestWithReason("Transferred Residence"), {
      params: Promise.resolve({ id: "profile-id" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.updateRegistration).toHaveBeenCalledWith({
      where: { id: "profile-id" },
      data: {
        reviewStatus: "Archived",
        archivedReason: "Transferred Residence",
        archivedAt: expect.any(Date),
        archivedBy: "admin-id",
      },
    });
    expect(mocks.closeSkeapApplications).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        userId: "user-id",
        actorId: "admin-id",
        reason: "Transferred Residence",
      }),
    );
    expect(mocks.refreshKkAdminView).toHaveBeenCalledOnce();
    expect(mocks.refreshSkeapAdminView).toHaveBeenCalledOnce();
  });

  it("does not close SKEAP applications for a duplicate-record archive", async () => {
    const response = await PATCH(requestWithReason("Duplicate Record"), {
      params: Promise.resolve({ id: "profile-id" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.closeSkeapApplications).not.toHaveBeenCalled();
  });

  it("rejects automatic age-out as a manual archive reason", async () => {
    const response = await PATCH(requestWithReason("AGED_OUT_31"), {
      params: Promise.resolve({ id: "profile-id" }),
    });

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
