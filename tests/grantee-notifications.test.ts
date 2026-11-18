import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindMany: vi.fn(),
  notificationCreate: vi.fn(),
  notificationCreateMany: vi.fn(),
  academicTermScheduleFindMany: vi.fn(),
  detectGranteeTargetTerm: vi.fn(),
  createGmailTransporter: vi.fn(),
  sendTransactionalEmail: vi.fn(),
}));

vi.mock("../lib/prisma", () => ({
  prisma: {
    user: { findMany: mocks.userFindMany },
    notification: {
      create: mocks.notificationCreate,
      createMany: mocks.notificationCreateMany,
    },
    academicTermSchedule: { findMany: mocks.academicTermScheduleFindMany },
  },
}));

vi.mock("../lib/grantee-semester", () => ({
  detectGranteeTargetTerm: mocks.detectGranteeTargetTerm,
  getScheduleSemesterForTargetTerm: (term: { schoolYear: string; semester: string }) =>
    `${term.schoolYear} ${term.semester === "Annual / School Year" ? "First Semester" : term.semester}`,
}));

vi.mock("../lib/broadcast-email", () => ({
  createGmailTransporter: mocks.createGmailTransporter,
  sendTransactionalEmail: mocks.sendTransactionalEmail,
}));

import {
  createSkeapGranteeApprovalNotification,
  notifyGranteesToUploadRequirements,
} from "../lib/grantee-notifications";

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GMAIL_USER;
  delete process.env.GMAIL_APP_PASSWORD;
  delete process.env.NEXT_PUBLIC_APP_URL;
  delete process.env.APP_URL;
  delete process.env.NEXT_PUBLIC_SITE_URL;
  delete process.env.VERCEL_URL;
  mocks.userFindMany.mockResolvedValue([
    { id: "user-1", email: "scholar@example.com", emailNotifications: true },
  ]);
  mocks.notificationCreate.mockResolvedValue({ id: "notification-1" });
  mocks.notificationCreateMany.mockResolvedValue({ count: 1 });
  mocks.academicTermScheduleFindMany.mockResolvedValue([
    {
      semester: "2026-2027 Second Semester",
      opensAt: new Date("2020-01-01T00:00:00.000Z"),
    },
  ]);
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

describe("createSkeapGranteeApprovalNotification", () => {
  it("creates an idempotent approval notification that links to the grantee workspace", async () => {
    await createSkeapGranteeApprovalNotification({
      applicationId: "application-1",
      userId: "user-1",
      academicYear: "2026-2027",
      semester: "Second Semester",
    });

    expect(mocks.notificationCreateMany).toHaveBeenCalledWith({
      data: [{
        userId: "user-1",
        sourceKey: "skeap-grantee-approval:application-1",
        message: "Congratulations! Your SKEAP Application is Approved\n\nYou are now an official Barangay Pico SKEAP Grantee for 2026-2027 (Second Semester). Open your Grantee Workspace to view your schedule and responsibilities.",
      }],
      skipDuplicates: true,
    });
  });
});

describe("notifyGranteesToUploadRequirements", () => {
  it("does not notify grantees before the target schedule opens", async () => {
    mocks.academicTermScheduleFindMany.mockResolvedValueOnce([
      {
        semester: "2026-2027 Second Semester",
        opensAt: new Date(Date.now() + 60_000),
      },
    ]);

    await expect(
      notifyGranteesToUploadRequirements({ trigger: "SUBMISSION_OPEN" }),
    ).resolves.toMatchObject({ notified: 0, skipped: 1 });
    expect(mocks.notificationCreate).not.toHaveBeenCalled();
    expect(mocks.sendTransactionalEmail).not.toHaveBeenCalled();
  });

  it("allows the submission-open notice at the scheduled opening time", async () => {
    const opensAt = new Date("2027-01-04T00:00:00.000Z");
    mocks.academicTermScheduleFindMany.mockResolvedValueOnce([
      { semester: "2026-2027 Second Semester", opensAt },
    ]);

    await expect(
      notifyGranteesToUploadRequirements({
        now: opensAt,
        trigger: "SUBMISSION_OPEN",
      }),
    ).resolves.toMatchObject({ notified: 1, skipped: 0 });
    expect(mocks.notificationCreate).toHaveBeenCalledOnce();
  });

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
        sourceKey: "requirements-upload:2026-2027:Second%20Semester:SUBMISSION_OPEN",
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
      expect.stringContaining("SUBMISSION_OPEN"),
    );
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("uses a public requirements link in development emails without a configured URL", async () => {
    vi.stubEnv("NODE_ENV", "development");
    process.env.GMAIL_USER = "mailer@example.com";
    process.env.GMAIL_APP_PASSWORD = "configured";

    try {
      await notifyGranteesToUploadRequirements({ trigger: "GRANTEE_APPROVED" });

      const emailBody = mocks.sendTransactionalEmail.mock.calls[0][3] as string;
      expect(emailBody).not.toContain("localhost");
      expect(emailBody).toContain(
        "https://skonnect-project-three.vercel.app/grantee-dashboard/documents",
      );
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("uses the public requirements URL when the configured app URL is loopback", async () => {
    process.env.GMAIL_USER = "mailer@example.com";
    process.env.GMAIL_APP_PASSWORD = "configured";
    process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";

    await notifyGranteesToUploadRequirements({ trigger: "GRANTEE_APPROVED" });

    const emailBody = mocks.sendTransactionalEmail.mock.calls[0][3] as string;
    expect(emailBody).not.toContain("localhost");
    expect(emailBody).toContain(
      "https://skonnect-project-three.vercel.app/grantee-dashboard/documents",
    );
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
