import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
  refreshKkAdminView: vi.fn(),
  notifyProfileRestored: vi.fn(),
  revalidatePath: vi.fn(),
  syncKkProfile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("@/lib/auth", () => ({
  requireRole: mocks.requireRole,
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshKkProfilingApplicationsAdminView: mocks.refreshKkAdminView,
}));

vi.mock("@/lib/notify-profile-restored", () => ({
  notifyProfileRestored: mocks.notifyProfileRestored,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/kk-profile-sync", () => ({
  syncKkProfileFromLatestRegistration: mocks.syncKkProfile,
}));

import { PATCH } from "@/app/api/admin/members/[id]/restore/route";

describe("member profile restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "admin-id" });
    mocks.findUnique.mockResolvedValue({
      id: "profile-id",
      fullName: "Member Name",
      email: "member@example.test",
      userId: "user-id",
      birthDate: new Date("2000-01-01T00:00:00.000Z"),
      reviewStatus: "Archived",
      archivedReason: "Transferred Residence",
      archivedAt: new Date("2025-01-01T00:00:00.000Z"),
      archivedBy: "old-admin",
    });
    mocks.update.mockImplementation(async ({ data }) => ({
      id: "profile-id",
      reviewStatus: data.reviewStatus,
      fullName: "Member Name",
      email: "member@example.test",
      userId: "user-id",
    }));
    mocks.transaction.mockImplementation(async (callback) => callback({
      profilingRegistration: {
        findUnique: mocks.findUnique,
        update: mocks.update,
      },
    }));
  });

  it("restores archived profiles to Approved", async () => {
    const response = await PATCH(new Request("http://localhost"), {
      params: Promise.resolve({ id: "profile-id" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "profile-id" },
      data: {
        reviewStatus: "Approved",
        archivedReason: null,
        archivedAt: null,
        archivedBy: null,
      },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
    expect(mocks.notifyProfileRestored).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/members/records");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/registry/masterlist");
  });

  it("rejects archived profiles aged 31 or older without updating or notifying", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "profile-id",
      fullName: "Member Name",
      email: "member@example.test",
      userId: "user-id",
      birthDate: new Date("1990-01-01T00:00:00.000Z"),
      reviewStatus: "Archived",
      archivedReason: "Transferred Residence",
    });

    const response = await PATCH(new Request("http://localhost"), {
      params: Promise.resolve({ id: "profile-id" }),
    });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toContain("This resident is 31+ years old");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.notifyProfileRestored).not.toHaveBeenCalled();
  });

  it("returns rejected profiles to Pending without retaining the rejection reason", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "profile-id",
      fullName: "Member Name",
      reviewStatus: "Rejected",
      birthDate: new Date("2000-01-01T00:00:00.000Z"),
      userId: null,
      email: "member@example.test",
      reviewNotes: "Duplicate registration",
    });

    const response = await PATCH(new Request("http://localhost"), {
      params: Promise.resolve({ id: "profile-id" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: "profile-id" },
      data: {
        reviewStatus: "Pending",
        archivedReason: null,
        archivedAt: null,
        archivedBy: null,
        reviewNotes: null,
      },
    });
    expect(mocks.notifyProfileRestored).not.toHaveBeenCalled();
  });
});
