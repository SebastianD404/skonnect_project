import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  notificationUpsert: vi.fn(),
  notificationLogCreate: vi.fn(),
  createTransporter: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { upsert: mocks.notificationUpsert },
    notificationLog: { create: mocks.notificationLogCreate },
  },
}));

vi.mock("@/lib/broadcast-email", () => ({
  createGmailTransporter: mocks.createTransporter,
  sendTransactionalEmail: mocks.sendEmail,
}));

import { notifyProfileRestored } from "@/lib/notify-profile-restored";

describe("KK profile restored notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notificationUpsert.mockResolvedValue({});
    mocks.notificationLogCreate.mockResolvedValue({});
    mocks.createTransporter.mockReturnValue({});
    mocks.sendEmail.mockResolvedValue({});
  });

  it.each(["resident@example.invalid", "resident@demo.skonnect"])(
    "creates an in-app notice and skips demo email address %s",
    async (email) => {
      const result = await notifyProfileRestored({
        userId: "user-1",
        email,
        fullName: "Resident",
        registrationId: "registration-1",
        restoredAt: new Date("2026-11-18T12:00:00.000Z"),
      });

      expect(result).toEqual({ inAppStatus: "SENT", emailStatus: "SKIPPED_DEMO" });
      expect(mocks.notificationUpsert).toHaveBeenCalledOnce();
      expect(mocks.sendEmail).not.toHaveBeenCalled();
      expect(mocks.notificationLogCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          type: "PROFILE_RESTORED_EMAIL_SKIPPED_DEMO",
          success: false,
        }),
      });
    },
  );

  it("does not fail restoration notification delivery when email transport fails", async () => {
    mocks.sendEmail.mockRejectedValue(new Error("SMTP unavailable"));

    const result = await notifyProfileRestored({
      userId: "user-1",
      email: "resident@example.test",
      fullName: "Resident",
      registrationId: "registration-1",
      restoredAt: new Date("2026-11-18T12:00:00.000Z"),
    });

    expect(result).toEqual({ inAppStatus: "SENT", emailStatus: "FAILED" });
    expect(mocks.notificationUpsert).toHaveBeenCalledOnce();
    expect(mocks.notificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "PROFILE_RESTORED_EMAIL_FAILED",
        success: false,
      }),
    });
  });
});
