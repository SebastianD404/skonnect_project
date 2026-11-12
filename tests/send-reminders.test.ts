import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type ReminderMocks = {
  mockReminderLogCreate: ReturnType<typeof vi.fn>;
  mockReminderLogFindFirst: ReturnType<typeof vi.fn>;
  mockNotificationUpsert: ReturnType<typeof vi.fn>;
  mockUserFindMany: ReturnType<typeof vi.fn>;
  mockReminderSettingFindUnique: ReturnType<typeof vi.fn>;
  mockAcademicTermScheduleFindMany: ReturnType<typeof vi.fn>;
  mockCreateGmailTransporter: ReturnType<typeof vi.fn>;
  mockSendTransactionalEmail: ReturnType<typeof vi.fn>;
};

vi.mock("../lib/prisma", () => {
  const mocks: ReminderMocks = {
    mockReminderLogCreate: vi.fn(),
    mockReminderLogFindFirst: vi.fn(),
    mockNotificationUpsert: vi.fn(),
    mockUserFindMany: vi.fn(),
    mockReminderSettingFindUnique: vi.fn(),
    mockAcademicTermScheduleFindMany: vi.fn(),
    mockCreateGmailTransporter: vi.fn(),
    mockSendTransactionalEmail: vi.fn(),
  };
  (globalThis as typeof globalThis & { __TEST_PRISMA_MOCKS?: ReminderMocks }).__TEST_PRISMA_MOCKS = mocks;

  return {
    prisma: {
      reminderLog: {
        create: mocks.mockReminderLogCreate,
        findFirst: mocks.mockReminderLogFindFirst,
      },
      notification: { upsert: mocks.mockNotificationUpsert },
      user: { findMany: mocks.mockUserFindMany },
      reminderSetting: { findUnique: mocks.mockReminderSettingFindUnique },
      messageTemplate: { findUnique: vi.fn().mockResolvedValue(null) },
      academicTermSchedule: { findMany: mocks.mockAcademicTermScheduleFindMany },
    },
  };
});

vi.mock("../lib/broadcast-email", () => {
  const mocks = (globalThis as typeof globalThis & { __TEST_PRISMA_MOCKS: ReminderMocks }).__TEST_PRISMA_MOCKS;
  return {
    createGmailTransporter: mocks.mockCreateGmailTransporter,
    sendTransactionalEmail: mocks.mockSendTransactionalEmail,
  };
});

import { loadReminderSettings, processSkeapReminders } from "../lib/deadline-reminder-runner";

const mocks = (globalThis as typeof globalThis & { __TEST_PRISMA_MOCKS: ReminderMocks }).__TEST_PRISMA_MOCKS;
const {
  mockReminderLogCreate,
  mockReminderLogFindFirst,
  mockNotificationUpsert,
  mockUserFindMany,
  mockReminderSettingFindUnique,
  mockAcademicTermScheduleFindMany,
  mockCreateGmailTransporter,
  mockSendTransactionalEmail,
} = mocks;

beforeEach(() => {
  vi.clearAllMocks();
  mockReminderLogFindFirst.mockResolvedValue(null);
  mockReminderLogCreate.mockImplementation(({ data }: { data: { channel: string } }) =>
    Promise.resolve({ id: `log-${data.channel}` })
  );
  mockCreateGmailTransporter.mockReturnValue({});
  mockSendTransactionalEmail.mockResolvedValue({ messageId: "mail-1" });
});

afterEach(() => {
  vi.clearAllMocks();
});

const activeSchedule = {
  id: "schedule-1",
  semester: "2026-2027 First Semester",
  opensAt: new Date("2026-06-01T00:00:00.000Z"),
  closesAt: new Date("2026-07-31T00:00:00.000Z"),
};
const activeGrantee = {
  id: "user-1",
  email: "test@example.com",
  emailNotifications: true,
  grantee: { id: "g1" },
};

describe("send-reminders scheduler", () => {
  it("uses the admin UI defaults when no reminder settings exist", async () => {
    mockReminderSettingFindUnique.mockResolvedValueOnce(null);

    await expect(loadReminderSettings()).resolves.toMatchObject({ skeapOffsets: [7, 3, 1] });
  });

  it("delivers email and idempotent in-app reminders for an active SKEAP grantee", async () => {
    mockAcademicTermScheduleFindMany.mockResolvedValueOnce([activeSchedule]);
    mockUserFindMany.mockResolvedValueOnce([activeGrantee]);

    const result = await processSkeapReminders({ skeapOffsets: [7] }, new Date("2026-07-24T00:00:00.000Z"));

    expect(result).toMatchObject({ dueOffsets: [7], emailSent: 1, emailFailed: 0, inAppCreated: 1 });
    expect(mockSendTransactionalEmail).toHaveBeenCalledWith(
      expect.any(Object),
      activeGrantee.email,
      expect.stringContaining("7 days"),
      expect.stringContaining("2026-07-31"),
      expect.any(String),
    );
    expect(mockReminderLogCreate).toHaveBeenCalledTimes(2);
    expect(mockNotificationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId_sourceKey: { userId: activeGrantee.id, sourceKey: "reminder:log-in-app" } },
      create: expect.objectContaining({ userId: activeGrantee.id }),
    }));
  });

  it("retries the latest missed reminder before the deadline without sending stale offset copy", async () => {
    mockAcademicTermScheduleFindMany.mockResolvedValueOnce([activeSchedule]);
    mockUserFindMany.mockResolvedValueOnce([activeGrantee]);

    const result = await processSkeapReminders({ skeapOffsets: [7, 3, 1] }, new Date("2026-07-27T00:00:00.000Z"));

    expect(result.dueOffsets).toEqual([7]);
    expect(mockSendTransactionalEmail).toHaveBeenCalledWith(
      expect.any(Object),
      activeGrantee.email,
      expect.stringContaining("4 days"),
      expect.any(String),
      expect.any(String),
    );
  });

  it("does not send a reminder after the deadline", async () => {
    mockAcademicTermScheduleFindMany.mockResolvedValueOnce([activeSchedule]);

    const result = await processSkeapReminders({ skeapOffsets: [7] }, new Date("2026-08-01T00:00:00.000Z"));

    expect(result.dueOffsets).toEqual([]);
    expect(mockUserFindMany).not.toHaveBeenCalled();
  });
});
