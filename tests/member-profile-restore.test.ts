import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
  requireRole: vi.fn(),
  writeAuditLog: vi.fn(),
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

import { PATCH } from "@/app/api/admin/members/[id]/restore/route";

describe("member profile restore", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireRole.mockResolvedValue({ id: "admin-id" });
    mocks.findUnique.mockResolvedValue({
      id: "profile-id",
      fullName: "Member Name",
      reviewStatus: "Archived",
    });
    mocks.update.mockImplementation(async ({ data }) => ({
      id: "profile-id",
      reviewStatus: data.reviewStatus,
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
      data: { reviewStatus: "Approved", archivedReason: null, archivedAt: null },
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
  });

  it("returns rejected profiles to Pending without retaining the rejection reason", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "profile-id",
      fullName: "Member Name",
      reviewStatus: "Rejected",
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
        reviewNotes: null,
      },
    });
  });
});
