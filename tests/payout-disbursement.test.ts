import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionClient = {
    accountingPayout: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    notification: {
      upsert: vi.fn(),
    },
  };

  return {
    granteeFindUnique: vi.fn(),
    payoutUpdateMany: vi.fn(),
    payoutFindUnique: transactionClient.accountingPayout.findUnique,
    payoutUpsert: transactionClient.accountingPayout.upsert,
    notificationUpsert: transactionClient.notification.upsert,
    transaction: vi.fn((callback: (client: typeof transactionClient) => Promise<unknown>) =>
      callback(transactionClient),
    ),
    sendEmail: vi.fn(),
    createTransporter: vi.fn(),
    writeAuditLog: vi.fn(),
  };
});

vi.mock("@/lib/prisma", () => ({
  prisma: {
    grantee: { findUnique: mocks.granteeFindUnique },
    accountingPayout: { updateMany: mocks.payoutUpdateMany },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/broadcast-email", () => ({
  createGmailTransporter: mocks.createTransporter,
  sendPayoutDisbursementEmail: mocks.sendEmail,
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

import { dispatchPayout } from "@/lib/payout-disbursement";

describe("dispatchPayout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "https://skonnect.example";
    delete process.env.VERCEL_URL;
    mocks.granteeFindUnique.mockResolvedValue({
      id: "grantee-1",
      user: { id: "user-1", email: "student@example.test", fullName: "Student User" },
    });
    mocks.payoutFindUnique.mockResolvedValue(null);
    mocks.payoutUpsert.mockResolvedValue({
      id: "payout-1",
      granteeId: "grantee-1",
      amount: 5000,
      semester: "2026-2027 First Semester",
      status: "DISBURSED_UNCONFIRMED",
      disbursedAt: new Date("2026-11-12T00:00:00.000Z"),
      claimedAt: null,
      disbursementEmailSentAt: null,
    });
    mocks.createTransporter.mockReturnValue({});
    mocks.sendEmail.mockResolvedValue({ accepted: ["student@example.test"] });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("disburses once, records the in-app message, and emails a confirmation link", async () => {
    const result = await dispatchPayout({
      granteeId: "grantee-1",
      semester: "2026-2027 First Semester",
      actorId: "admin-1",
    });

    expect(result.payout.status).toBe("DISBURSED_UNCONFIRMED");
    expect(result.emailStatus).toBe("sent");
    expect(mocks.notificationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        userId: "user-1",
        sourceKey: "payout-disbursed:payout-1",
        message: "The 2026-2027 First Semester payout of ₱5,000 has been disbursed. Please confirm receipt in your payouts dashboard.",
      }),
    }));
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      "student@example.test",
      expect.objectContaining({
        recipientName: "Student User",
        semester: "2026-2027 First Semester",
        amount: 5000,
        confirmationUrl: "https://skonnect.example/login",
      }),
    );
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ action: "PAYOUT_DISBURSED", actorId: "admin-1" }),
    );
  });

  it("does not duplicate dispatch records or resend an already-delivered email", async () => {
    mocks.payoutFindUnique.mockResolvedValue({
      id: "payout-1",
      granteeId: "grantee-1",
      amount: 5000,
      semester: "2026-2027 First Semester",
      status: "DISBURSED_UNCONFIRMED",
      disbursedAt: new Date("2026-11-12T00:00:00.000Z"),
      claimedAt: null,
      disbursementEmailSentAt: new Date("2026-11-12T00:01:00.000Z"),
    });

    const result = await dispatchPayout({
      granteeId: "grantee-1",
      semester: "2026-2027 First Semester",
      actorId: "admin-1",
    });

    expect(result.dispatchedNow).toBe(false);
    expect(result.emailStatus).toBe("sent");
    expect(mocks.payoutUpsert).not.toHaveBeenCalled();
    expect(mocks.notificationUpsert).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("keeps an undelivered email retryable without duplicating the notification", async () => {
    mocks.sendEmail.mockRejectedValueOnce(new Error("Mail server unavailable"));

    const firstAttempt = await dispatchPayout({
      granteeId: "grantee-1",
      semester: "2026-2027 First Semester",
      actorId: "admin-1",
    });

    expect(firstAttempt.emailStatus).toBe("failed");
    expect(mocks.payoutUpdateMany).not.toHaveBeenCalled();

    mocks.payoutFindUnique.mockResolvedValue({
      id: "payout-1",
      granteeId: "grantee-1",
      amount: 5000,
      semester: "2026-2027 First Semester",
      status: "DISBURSED_UNCONFIRMED",
      disbursedAt: new Date("2026-11-12T00:00:00.000Z"),
      claimedAt: null,
      disbursementEmailSentAt: null,
    });
    const retry = await dispatchPayout({
      granteeId: "grantee-1",
      semester: "2026-2027 First Semester",
      actorId: "admin-1",
    });

    expect(retry.emailStatus).toBe("sent");
    expect(mocks.notificationUpsert).toHaveBeenCalledTimes(1);
    expect(mocks.payoutUpdateMany).toHaveBeenCalledTimes(1);
  });

  it("uses localhost for payout confirmation links in development when no public URL is configured", async () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    vi.stubEnv("NODE_ENV", "development");

    await dispatchPayout({
      granteeId: "grantee-1",
      semester: "2026-2027 First Semester",
      actorId: "admin-1",
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      "student@example.test",
      expect.objectContaining({ confirmationUrl: "http://localhost:3000/login" }),
    );
  });
});
