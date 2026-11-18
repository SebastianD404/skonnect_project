import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  ensureProfile: vi.fn(),
  userFindUnique: vi.fn(),
  granteeFindUnique: vi.fn(),
  granteeUpdateMany: vi.fn(),
  granteeMessageCreate: vi.fn(),
  notificationCreate: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
  revalidatePath: vi.fn(),
  createGmailTransporter: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
}));

vi.mock("@/lib/prisma", () => ({
  hasGranteeColumn: vi.fn(),
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: "admin-auth-id" } } }) },
  }),
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/broadcast-email", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/broadcast-email")>();
  return {
    ...actual,
    createGmailTransporter: mocks.createGmailTransporter,
    sendTransactionalEmail: mocks.sendTransactionalEmail,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { PATCH as returnExitClearance } from "../app/api/admin/grantees/[id]/exit-clearance/route";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("returning a submitted exit clearance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://skonnect.example");
    mocks.ensureProfile.mockResolvedValue({ id: "admin-user-id", role: "SK_OFFICIAL" });
    mocks.userFindUnique.mockResolvedValue({ isActive: true });
    mocks.granteeFindUnique.mockResolvedValue({
      id: "grantee-1",
      userId: "scholar-user-id",
      status: "ACTIVE",
      exitClearanceStatus: "SUBMITTED",
      exitClearanceUrl: "grantee-clearances/scholar-auth-id/clearance.pdf",
      graduationRemarks: null,
      user: { fullName: "Mira Santos", email: "mira@example.com" },
    });
    mocks.granteeUpdateMany.mockResolvedValue({ count: 1 });
    mocks.granteeMessageCreate.mockResolvedValue({ id: "message-1" });
    mocks.notificationCreate.mockResolvedValue({});
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.createGmailTransporter.mockReturnValue({});
    mocks.sendTransactionalEmail.mockResolvedValue({ messageId: "mail-1" });
    mocks.transaction.mockImplementation(async (callback) =>
      callback({
        grantee: {
          findUnique: mocks.granteeFindUnique,
          updateMany: mocks.granteeUpdateMany,
        },
        granteeMessage: { create: mocks.granteeMessageCreate },
        notification: { create: mocks.notificationCreate },
      }),
    );
  });

  it("marks the clearance returned, saves the reason, notifies the grantee, and revalidates graduation pages", async () => {
    const response = await returnExitClearance(
      new Request("http://localhost/api/admin/grantees/grantee-1/exit-clearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: "Please upload a clearer scan." }),
      }),
      { params: Promise.resolve({ id: "grantee-1" }) },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      exitClearanceStatus: "RETURNED",
    });
    expect(mocks.granteeUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        exitClearanceStatus: "RETURNED",
        graduationRemarks: "Please upload a clearer scan.",
      },
    }));
    expect(mocks.granteeMessageCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "scholar-user-id",
        subject: "Action Required: Re-upload Your SKEAP Exit Clearance",
        body: expect.stringContaining("Please upload a clearer scan."),
      }),
    }));
    expect(mocks.notificationCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        userId: "scholar-user-id",
        message: expect.stringContaining("Reason from SK Admin:\nPlease upload a clearer scan."),
      }),
    }));
    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      {},
      "mira@example.com",
      "Action Required: Re-upload Your SKEAP Exit Clearance",
      expect.stringContaining("Please upload a clearer scan."),
      expect.stringMatching(/^exit-clearance-returned-grantee-1-\d+$/),
      expect.stringContaining('href="https://skonnect.example/grantee-dashboard"'),
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/exit-clearances");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/grantees");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/grantees/records");
  });

  it("keeps the return successful if email delivery fails", async () => {
    const errorLog = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.sendTransactionalEmail.mockRejectedValueOnce(new Error("Mail provider unavailable"));

    const response = await returnExitClearance(
      new Request("http://localhost/api/admin/grantees/grantee-1/exit-clearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: "Please upload a clearer scan." }),
      }),
      { params: Promise.resolve({ id: "grantee-1" }) },
    );

    expect(response.status).toBe(200);
    expect(mocks.granteeUpdateMany).toHaveBeenCalled();
    expect(mocks.notificationCreate).toHaveBeenCalled();
    expect(errorLog).toHaveBeenCalledWith(
      "Exit clearance was returned, but email notification failed.",
      expect.objectContaining({ granteeId: "grantee-1" }),
    );
  });

  it("requires a non-empty return reason", async () => {
    const response = await returnExitClearance(
      new Request("http://localhost/api/admin/grantees/grantee-1/exit-clearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: "   " }),
      }),
      { params: Promise.resolve({ id: "grantee-1" }) },
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("can return an uploaded file even when its status is not SUBMITTED", async () => {
    mocks.granteeFindUnique.mockResolvedValueOnce({
      id: "grantee-1",
      userId: "scholar-user-id",
      status: "ACTIVE",
      exitClearanceStatus: "NONE",
      exitClearanceUrl: "grantee-clearances/scholar-auth-id/clearance.pdf",
      graduationRemarks: null,
      user: { fullName: "Mira Santos" },
    });

    const response = await returnExitClearance(
      new Request("http://localhost/api/admin/grantees/grantee-1/exit-clearance", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remarks: "Please upload a clearer scan." }),
      }),
      { params: Promise.resolve({ id: "grantee-1" }) },
    );

    expect(response.status).toBe(200);
  });
});
