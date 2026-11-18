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

import { notifyProfileArchived } from "@/lib/notify-profile-archived";

const archiveEvent = {
  userId: "user-1",
  email: "resident@example.com",
  fullName: "Resident Name",
  archivedAt: new Date("2026-11-18T10:00:00.000Z"),
};

describe("notifyProfileArchived", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.notificationUpsert.mockResolvedValue({});
    mocks.notificationLogCreate.mockResolvedValue({});
    mocks.createTransporter.mockReturnValue({});
    mocks.sendEmail.mockResolvedValue({});
  });

  it("sends the age-out notice through both channels with the required subject", async () => {
    await expect(notifyProfileArchived({
      ...archiveEvent,
      archiveType: "AGED_OUT",
      reason: "AGED_OUT",
    })).resolves.toEqual({ emailStatus: "SENT", inAppStatus: "SENT" });

    expect(mocks.notificationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        sourceKey: expect.stringContaining("kk-profile-archived:aged_out:"),
        message: expect.stringContaining("31 years old"),
      }),
    }));
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      archiveEvent.email,
      "Notice of Katipunan ng Kabataan (KK) Profile Archival — Age Milestone (31+)",
      expect.stringContaining("ongoing SKEAP disbursement inquiry"),
      expect.any(String),
      expect.stringContaining("historical archive records"),
    );
    expect(mocks.notificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "PROFILE_ARCHIVED_EMAIL_SENT",
        channel: "email",
        success: true,
      }),
    });
  });

  it("skips demo email delivery but still creates an in-app notification and log", async () => {
    for (const email of ["resident@example.invalid", "resident@demo.skonnect"]) {
      const result = await notifyProfileArchived({
        ...archiveEvent,
        email,
        archiveType: "ADMIN_ARCHIVED",
        reason: "Transferred Residence",
      });
      expect(result).toEqual({ emailStatus: "SKIPPED_DEMO", inAppStatus: "SENT" });
    }

    expect(mocks.notificationUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.notificationLogCreate).toHaveBeenCalledTimes(2);
    expect(mocks.notificationLogCreate).toHaveBeenNthCalledWith(1, {
      data: expect.objectContaining({
        type: "PROFILE_ARCHIVED_EMAIL_SKIPPED_DEMO",
        success: false,
      }),
    });
  });

  it("does not throw when email transport fails and records the failed delivery", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.sendEmail.mockRejectedValue(new Error("SMTP unavailable"));

    await expect(notifyProfileArchived({
      ...archiveEvent,
      archiveType: "ADMIN_ARCHIVED",
      reason: "<script>reason</script>",
    })).resolves.toEqual({ emailStatus: "FAILED", inAppStatus: "SENT" });

    expect(mocks.sendEmail.mock.calls[0][5]).toContain("&lt;script&gt;reason&lt;/script&gt;");
    expect(mocks.notificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: "PROFILE_ARCHIVED_EMAIL_FAILED",
        success: false,
      }),
    });
    consoleError.mockRestore();
  });

  it("confirms opt-out archival in email and suppresses all deceased notifications", async () => {
    await notifyProfileArchived({
      ...archiveEvent,
      archiveType: "ADMIN_ARCHIVED",
      reason: "Voluntary Withdrawal / Opt-Out",
    });
    expect(mocks.sendEmail.mock.calls[0][3]).toContain("request to opt out has been processed");
    expect(mocks.notificationUpsert).toHaveBeenCalledTimes(1);

    vi.clearAllMocks();
    const result = await notifyProfileArchived({
      ...archiveEvent,
      archiveType: "ADMIN_ARCHIVED",
      reason: "Deceased",
    });

    expect(result).toEqual({
      emailStatus: "SKIPPED_DECEASED",
      inAppStatus: "SKIPPED_DECEASED",
    });
    expect(mocks.notificationUpsert).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.notificationLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: expect.stringContaining("SKIPPED_DECEASED"),
      }),
    });
  });
});
