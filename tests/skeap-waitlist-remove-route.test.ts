import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  findApplication: vi.fn(),
  updateApplication: vi.fn(),
  updateInquiry: vi.fn(),
  writeAuditLog: vi.fn(),
  refreshAdminView: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/audit/logger", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/skeap-waitlist", () => ({ reindexSkeapWaitlist: vi.fn() }));
vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshSkeapApplicationsAdminView: mocks.refreshAdminView,
}));
vi.mock("@/lib/skeap-capacity", () => ({ lockSkeapCapacity: vi.fn() }));

import { DELETE } from "@/app/api/admin/skeap-applications/waitlist/[id]/route";

function createTransactionClient() {
  return {
    skeapApplication: {
      findUnique: mocks.findApplication,
      update: mocks.updateApplication,
    },
    inquiry: { update: mocks.updateInquiry },
  };
}

describe("SKEAP waitlist removal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: "SK_OFFICIAL" });
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "WAITLISTED",
      waitlistPosition: 1,
      applicantName: "Sample Applicant",
      userId: "user-1",
      inquiry: { id: "inquiry-1" },
    });
    mocks.updateApplication.mockResolvedValue({});
    mocks.updateInquiry.mockResolvedValue({});
    mocks.writeAuditLog.mockResolvedValue({});
    mocks.refreshAdminView.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback(createTransactionClient()));
  });

  it("releases an overdue offer only when an official removes the applicant", async () => {
    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Waitlist removal endpoint did not return a response.");
    expect(response.status).toBe(200);
    expect(mocks.updateApplication).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: {
        status: "PENDING",
        waitlistPosition: null,
        waitlistOfferStatus: "NONE",
        waitlistOfferedAt: null,
        waitlistOfferExpiresAt: null,
        waitlistOfferReminderSentAt: null,
      },
    });
    expect(mocks.updateApplication).toHaveBeenCalledTimes(1);
    expect(mocks.refreshAdminView).toHaveBeenCalledTimes(1);
  });
});
