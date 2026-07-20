import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

vi.mock("../lib/prisma", () => {
  const mockReminderLogCreate = vi.fn();
  const mockUserFindMany = vi.fn();
  const mockReminderSettingFindUnique = vi.fn();

  // expose mocks globally so tests can access them without static imports
  try {
    (globalThis as any).__TEST_PRISMA_MOCKS = {
      mockReminderLogCreate,
      mockUserFindMany,
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
      reminderSetting: {
        findUnique: mockReminderSettingFindUnique,
      },
    },
  };
});

import { processSkeapReminders } from "../scripts/send-reminders";

const { mockReminderLogCreate, mockUserFindMany, mockReminderSettingFindUnique } = (globalThis as any).__TEST_PRISMA_MOCKS;

beforeEach(() => {
  mockReminderLogCreate.mockReset();
  mockUserFindMany.mockReset();
  mockReminderSettingFindUnique.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("send-reminders scheduler", () => {
  it("creates both email and in-app reminder logs for SKEAP reminders", async () => {
    mockReminderSettingFindUnique.mockResolvedValueOnce({ type: "SKEAP_APPLICATION", offsets: [7], deadline: new Date("2026-07-31T00:00:00.000Z") });
    mockUserFindMany.mockResolvedValueOnce([
      { id: "user-1", email: "test@example.com", fullName: "Test User", grantee: { id: "g1" } },
    ]);

    await processSkeapReminders({ skeapOffsets: [7], skeapDeadline: new Date("2026-07-31T00:00:00.000Z") }, new Date("2026-07-24T00:00:00.000Z"));

    expect(mockReminderLogCreate).toHaveBeenCalledTimes(2);
    expect((mockReminderLogCreate.mock.calls[0] as any)[0].data.channel).toBe("email");
    expect((mockReminderLogCreate.mock.calls[1] as any)[0].data.channel).toBe("in-app");
  });

});
