import { describe, expect, it } from "vitest";
import {
  getPhtDayBounds,
  getPhtTime,
  isPhtTimeAtOrAfterBackupTarget,
  TARGET_HOUR_PHT,
  TARGET_MINUTE_PHT,
} from "@/lib/data-backup-schedule";

describe("PHT automated backup schedule", () => {
  it("uses midnight-to-midnight Asia/Manila bounds in UTC", () => {
    const { start, end } = getPhtDayBounds(new Date("2026-11-17T13:00:00.000Z"));

    expect(start.toISOString()).toBe("2026-11-16T16:00:00.000Z");
    expect(end.toISOString()).toBe("2026-11-17T16:00:00.000Z");
  });

  it("handles PHT date rollover at the end of the year", () => {
    const { start, end } = getPhtDayBounds(new Date("2026-12-31T16:30:00.000Z"));

    expect(start.toISOString()).toBe("2026-12-31T16:00:00.000Z");
    expect(end.toISOString()).toBe("2027-01-01T16:00:00.000Z");
  });

  it("uses the 8:15 PM PHT target and crosses it at the exact minute", () => {
    expect(TARGET_HOUR_PHT).toBe(20);
    expect(TARGET_MINUTE_PHT).toBe(15);
    expect(getPhtTime(new Date("2026-11-18T12:14:00.000Z"))).toEqual({
      hour: 20,
      minute: 14,
    });
    expect(isPhtTimeAtOrAfterBackupTarget(20, 14)).toBe(false);
    expect(isPhtTimeAtOrAfterBackupTarget(20, 15)).toBe(true);
    expect(isPhtTimeAtOrAfterBackupTarget(21, 0)).toBe(true);
  });
});
