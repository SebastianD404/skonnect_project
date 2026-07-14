import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const mockReminderLogCreate = vi.fn();
  const mockUserFindMany = vi.fn();
  const mockRegistrationFindMany = vi.fn();
  const mockReminderSettingFindUnique = vi.fn();

  // expose mocks globally so tests can access them without static imports
  try {
    (globalThis as any).__TEST_PRISMA_MOCKS = {
      mockReminderLogCreate,
      mockUserFindMany,
      mockRegistrationFindMany,
      mockReminderSettingFindUnique,
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
      registration: {
        findMany: mockRegistrationFindMany,
      },
      reminderSetting: {
        findUnique: mockReminderSettingFindUnique,
      },
    },
  };
});

import { processEventReminders, processSkeapReminders } from "../scripts/send-reminders";

const { mockReminderLogCreate, mockUserFindMany, mockRegistrationFindMany, mockReminderSettingFindUnique } = (globalThis as any).__TEST_PRISMA_MOCKS;

beforeEach(() => {
  mockReminderLogCreate.mockReset();
  mockUserFindMany.mockReset();
  mockRegistrationFindMany.mockReset();
  mockReminderSettingFindUnique.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("send-reminders scheduler", () => {
  it("creates both email and in-app reminder logs for SKEAP reminders", async () => {
    mockReminderSettingFindUnique.mockResolvedValueOnce({ type: "SKEAP_APPLICATION", offsets: [7], deadline: new Date("2026-07-31T00:00:00.000Z") });
    mockReminderSettingFindUnique.mockResolvedValueOnce({ type: "EVENT_REGISTRATION", offsets: [], deadline: null });
    mockUserFindMany.mockResolvedValueOnce([
      { id: "user-1", email: "test@example.com", fullName: "Test User", grantee: { id: "g1" } },
    ]);

    await processSkeapReminders({ skeapOffsets: [7], skeapDeadline: new Date("2026-07-31T00:00:00.000Z"), eventOffsets: [] }, new Date("2026-07-24T00:00:00.000Z"));

    expect(mockReminderLogCreate).toHaveBeenCalledTimes(2);
    expect((mockReminderLogCreate.mock.calls[0] as any)[0].data.channel).toBe("email");
    expect((mockReminderLogCreate.mock.calls[1] as any)[0].data.channel).toBe("in-app");
  });

  it("creates both email and in-app reminder logs for event reminders", async () => {
    mockRegistrationFindMany.mockResolvedValueOnce([
      {
        event: { id: "event-1", title: "Youth Summit", eventDate: new Date("2026-08-10T00:00:00.000Z"), status: "UPCOMING" },
        user: { id: "user-2", email: "test2@example.com" },
      },
    ]);

    await processEventReminders({ skeapOffsets: [], skeapDeadline: null, eventOffsets: [7] }, new Date("2026-08-03T00:00:00.000Z"));

    expect(mockReminderLogCreate).toHaveBeenCalledTimes(2);
    expect((mockReminderLogCreate.mock.calls[0] as any)[0].data.channel).toBe("email");
    expect((mockReminderLogCreate.mock.calls[1] as any)[0].data.channel).toBe("in-app");
  });
});
