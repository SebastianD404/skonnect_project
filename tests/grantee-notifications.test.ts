import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  detectGranteeTargetTerm: vi.fn(),
  createGmailTransporter: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    notification: { create: mocks.notificationCreate },
  },
}));

vi.mock("../lib/grantee-semester", () => ({
  detectGranteeTargetTerm: mocks.detectGranteeTargetTerm,
}));

vi.mock("../lib/broadcast-email", () => ({
  createGmailTransporter: mocks.createGmailTransporter,
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

import { notifyGranteesToUploadRequirements } from "../lib/grantee-notifications";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
  mocks.userFindMany.mockResolvedValue([
    { id: "user-1", email: "scholar@example.com", emailNotifications: true },
  ]);
  mocks.notificationCreate.mockResolvedValue({ id: "notification-1" });
  mocks.detectGranteeTargetTerm.mockResolvedValue({
    schoolYear: "2026-2027",
    semester: "Second Semester",
    termLabel: "2026-2027 Second Semester",
    isResubmission: false,
    hasPendingSubmission: false,
    hasApprovedSubmission: false,
  });
  mocks.createGmailTransporter.mockReturnValue({});
  mocks.sendTransactionalEmail.mockResolvedValue({ messageId: "mail-1" });
});

describe("notifyGranteesToUploadRequirements", () => {
  it("creates an in-app notification with the detected term and a stable trigger key", async () => {
    const result = await notifyGranteesToUploadRequirements({
      targetUserIds: ["user-1"],
      deadline: new Date("2027-03-31T15:59:00.000Z"),
      trigger: "ADMIN_SETTINGS",
    });

    expect(result).toMatchObject({ notified: 1, emailSent: 0, skipped: 0 });
    expect(mocks.notificationCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        sourceKey: "requirements-upload:2026-2027:Second%20Semester:ADMIN_SETTINGS",
        message: expect.stringContaining(
          "Action Required: Upload 2026-2027 Second Semester Requirements",
        ),
      }),
    });
    expect(mocks.notificationCreate.mock.calls[0][0].data.message).toContain(
      "before March 31, 2027",
    );
  });

  it("does not create notices for a term already under review", async () => {
    mocks.detectGranteeTargetTerm.mockResolvedValueOnce({
      schoolYear: "2026-2027",
      semester: "Second Semester",
      termLabel: "2026-2027 Second Semester",
      hasPendingSubmission: true,
      hasApprovedSubmission: false,
    });

    await expect(
      notifyGranteesToUploadRequirements({ trigger: "DEADLINE_REMINDER" }),
    ).resolves.toMatchObject({ notified: 0, skipped: 1 });
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
  });

  it("sends a configured email with a direct requirements link", async () => {
    process.env.GMAIL_USER = "mailer@example.com";
    process.env.GMAIL_APP_PASSWORD = "configured";
    process.env.NEXT_PUBLIC_APP_URL = "https://skonnect.example";

    await notifyGranteesToUploadRequirements({ trigger: "GRANTEE_APPROVED" });

    expect(mocks.sendTransactionalEmail).toHaveBeenCalledWith(
      {},
      "scholar@example.com",
      "Action Required: Upload 2026-2027 Second Semester Requirements",
      expect.stringContaining("https://skonnect.example/grantee-dashboard/documents"),
      expect.stringContaining("GRANTEE_APPROVED"),
    );
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("treats a duplicate database key as an idempotent skip", async () => {
    mocks.notificationCreate.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Duplicate key", {
        code: "P2002",
        clientVersion: "test",
      }),
    );

    await expect(
      notifyGranteesToUploadRequirements({ trigger: "ADMIN_SETTINGS" }),
    ).resolves.toMatchObject({ notified: 0, skipped: 1 });
  });
});
