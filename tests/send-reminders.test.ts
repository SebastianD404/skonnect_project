import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

type ReminderMocks = {
  mockReminderLogCreate: ReturnType<typeof vi.fn>;
  mockUserFindMany: ReturnType<typeof vi.fn>;
  mockReminderSettingFindUnique: ReturnType<typeof vi.fn>;
  mockAcademicTermScheduleFindMany: ReturnType<typeof vi.fn>;
};

vi.mock("../lib/prisma", () => {
  const mockReminderLogCreate = vi.fn();
  const mockUserFindMany = vi.fn();
  const mockReminderSettingFindUnique = vi.fn();
  const mockAcademicTermScheduleFindMany = vi.fn();

  // expose mocks globally so tests can access them without static imports
  try {
    (globalThis as typeof globalThis & { __TEST_PRISMA_MOCKS?: ReminderMocks }).__TEST_PRISMA_MOCKS = {
      mockReminderLogCreate,
      mockUserFindMany,
      mockReminderSettingFindUnique,
      mockAcademicTermScheduleFindMany,
    };
  } catch {}

  return {
    prisma: {
      reminderLog: {
        create: mockReminderLogCreate,
      },
      user: {
        findMany: mockUserFindMany,
      },
      reminderSetting: {
        findUnique: mockReminderSettingFindUnique,
      },
      academicTermSchedule: {
        findMany: mockAcademicTermScheduleFindMany,
      },
    },
  };
});

import { processSkeapReminders } from "../scripts/send-reminders";

const {
  mockReminderLogCreate,
  mockUserFindMany,
  mockReminderSettingFindUnique,
  mockAcademicTermScheduleFindMany,
} = (globalThis as typeof globalThis & { __TEST_PRISMA_MOCKS: ReminderMocks }).__TEST_PRISMA_MOCKS;

beforeEach(() => {
  mockReminderLogCreate.mockReset();
  mockUserFindMany.mockReset();
  mockReminderSettingFindUnique.mockReset();
  mockAcademicTermScheduleFindMany.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("send-reminders scheduler", () => {
  it("creates both email and in-app reminder logs for SKEAP reminders", async () => {
    mockAcademicTermScheduleFindMany.mockResolvedValueOnce([
      {
        id: "schedule-1",
        semester: "2026-2027 First Semester",
        opensAt: new Date("2026-06-01T00:00:00.000Z"),
        closesAt: new Date("2026-07-31T00:00:00.000Z"),
      },
    ]);
    mockUserFindMany.mockResolvedValueOnce([
      { id: "user-1", email: "test@example.com", fullName: "Test User", grantee: { id: "g1" } },
    ]);

    await processSkeapReminders({ skeapOffsets: [7] }, new Date("2026-07-24T00:00:00.000Z"));

    expect(mockReminderLogCreate).toHaveBeenCalledTimes(2);
    const emailLog = mockReminderLogCreate.mock.calls[0]?.[0] as {
      data: { channel: string; targetId: string | null; targetType: string };
    };
    const inAppLog = mockReminderLogCreate.mock.calls[1]?.[0] as { data: { channel: string } };
    expect(emailLog.data.channel).toBe("email");
    expect(inAppLog.data.channel).toBe("in-app");
    expect(emailLog.data.targetId).toBe("schedule-1");
    expect(emailLog.data.targetType).toBe("ACADEMIC_TERM_DEADLINE");
  });

});
