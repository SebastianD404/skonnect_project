import { describe, expect, it } from "vitest";
import { getAuditStartDate, isAuditTimeRange } from "@/lib/audit/time-range";

describe("audit log time ranges", () => {
  const now = new Date("2026-10-07T12:00:00.000Z");

  it.each([
    ["24h", 24],
    ["7d", 7 * 24],
    ["30d", 30 * 24],
    ["90d", 90 * 24],
  ] as const)("calculates the %s lower bound", (range, hours) => {
    expect(getAuditStartDate(range, now)?.getTime()).toBe(now.getTime() - hours * 60 * 60 * 1000);
  });

  it("does not apply a lower bound to all time", () => {
    expect(getAuditStartDate("all", now)).toBeUndefined();
  });

  it("accepts only supported range values", () => {
    expect(isAuditTimeRange("24h")).toBe(true);
    expect(isAuditTimeRange("all")).toBe(true);
    expect(isAuditTimeRange("365d")).toBe(false);
  });
});
