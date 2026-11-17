import { describe, expect, it } from "vitest";
import { getPhtDayBounds } from "@/lib/data-backup-schedule";

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
});
