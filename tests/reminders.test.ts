import { describe, expect, it } from "vitest";
import {
  buildSkeapReminderMessage,
  formatUtcDate,
  getReminderDates,
  parseReminderOffsets,
  shouldSendReminder,
} from "../lib/reminders";

describe("reminder scheduling", () => {
  it("parses reminder offsets from a comma-separated list", () => {
    expect(parseReminderOffsets("7, 3, 1")).toEqual([7, 3, 1]);
    expect(parseReminderOffsets("  ")).toEqual([]);
  });

  it("computes reminder dates relative to a base date", () => {
    const baseDate = new Date("2026-07-31T12:00:00.000Z");
    const reminderDates = getReminderDates(baseDate, [7, 1]);

    expect(reminderDates.map((date) => date.toISOString().slice(0, 10))).toEqual(["2026-07-24", "2026-07-30"]);
  });

  it("flags a reminder as due when the scheduled date matches today", () => {
    const now = new Date("2026-07-24T09:00:00.000Z");
    const targetDate = new Date("2026-07-24T00:00:00.000Z");

    expect(shouldSendReminder(targetDate, now)).toBe(true);
  });

  it("formats UTC dates consistently", () => {
    const date = new Date("2026-07-24T23:59:59.999Z");
    expect(formatUtcDate(date)).toBe("2026-07-24");
  });

  it("builds a SKEAP reminder message", () => {
    const deadline = new Date("2026-07-31T00:00:00.000Z");
    const message = buildSkeapReminderMessage(7, deadline);
    expect(message.subject).toContain("7 days");
    expect(message.body).toContain("2026-07-31");
  });

});
