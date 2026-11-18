import { describe, expect, it } from "vitest";
import {
  accountingTermForDate,
  accountingTermsMatch,
  compareAccountingTerms,
  getAccountingTermOptions,
  normalizeAccountingSemester,
  normalizeAccountingTermParts,
} from "@/lib/accounting-term";

describe("accounting term normalization and selection", () => {
  it("normalizes ordinal and full semester names independent of case and whitespace", () => {
    expect(normalizeAccountingSemester(" 1ST   semester ")).toBe("First Semester");
    expect(normalizeAccountingTermParts("2026-2027", " second semester ")).toBe(
      "2026-2027 Second Semester",
    );
    expect(accountingTermsMatch("2026-2027 1st Semester", "2026-2027 FIRST SEMESTER")).toBe(true);
    expect(accountingTermsMatch("Second Semester 2026-2027", "2026-2027 2nd Semester")).toBe(true);
  });

  it("orders terms by academic year and semester", () => {
    expect(compareAccountingTerms("2026-2027 First Semester", "2026-2027 2nd Semester")).toBeLessThan(0);
    expect(compareAccountingTerms("2026-2027 Second Semester", "2025-2026 Second Semester")).toBeGreaterThan(0);
  });

  it("orders the current, next, scheduled, and completed terms by schedule dates", () => {
    const schedules = [
      {
        semester: "2025-2026 Second Semester",
        opensAt: new Date("2026-01-01T00:00:00.000Z"),
        closesAt: new Date("2026-02-01T00:00:00.000Z"),
      },
      {
        semester: "2026-2027 1st Semester",
        opensAt: new Date("2026-09-01T00:00:00.000Z"),
        closesAt: new Date("2026-11-30T23:59:59.000Z"),
      },
      {
        semester: "2026-2027 Second Semester",
        opensAt: new Date("2026-12-01T00:00:00.000Z"),
        closesAt: new Date("2027-03-31T23:59:59.000Z"),
      },
      {
        semester: "2027-2028 First Semester",
        opensAt: new Date("2027-04-01T00:00:00.000Z"),
        closesAt: new Date("2027-07-31T23:59:59.000Z"),
      },
    ];

    expect(getAccountingTermOptions(schedules, new Date("2026-11-18T12:00:00.000Z"))).toEqual([
      { name: "2026-2027 First Semester", label: "2026-2027 First Semester (Current)", isCurrent: true },
      { name: "2026-2027 Second Semester", label: "2026-2027 Second Semester (Next)", isCurrent: false },
      { name: "2027-2028 First Semester", label: "2027-2028 First Semester (Scheduled)", isCurrent: false },
      { name: "2025-2026 Second Semester", label: "2025-2026 Second Semester", isCurrent: false },
    ]);
  });

  it("uses the latest past schedule as Current and the earliest future schedule as Next", () => {
    const schedules = [
      {
        semester: "2025-2026 Second Semester",
        opensAt: new Date("2026-01-01T00:00:00.000Z"),
        closesAt: new Date("2026-02-01T00:00:00.000Z"),
      },
      {
        semester: "2026-2027 1st Semester",
        opensAt: new Date("2026-08-01T00:00:00.000Z"),
        closesAt: new Date("2026-09-01T00:00:00.000Z"),
      },
      {
        semester: "2026-2027 2nd Semester",
        opensAt: new Date("2026-10-01T00:00:00.000Z"),
        closesAt: new Date("2026-11-01T00:00:00.000Z"),
      },
      {
        semester: "2027-2028 First Semester",
        opensAt: new Date("2026-12-01T00:00:00.000Z"),
        closesAt: new Date("2027-03-01T00:00:00.000Z"),
      },
    ];

    const options = getAccountingTermOptions(schedules, new Date("2026-11-18T12:00:00.000Z"));
    expect(options[0]).toEqual({
      name: "2026-2027 Second Semester",
      label: "2026-2027 Second Semester (Current)",
      isCurrent: true,
    });
    expect(options[1]).toEqual({
      name: "2027-2028 First Semester",
      label: "2027-2028 First Semester (Next)",
      isCurrent: false,
    });
    expect(options[2].label).toBe("2026-2027 First Semester");
    expect(options[3].label).toBe("2025-2026 Second Semester");
  });

  it("uses the earliest scheduled term when no current or past schedule exists", () => {
    const options = getAccountingTermOptions([
      {
        semester: "2027-2028 Second Semester",
        opensAt: new Date("2027-06-01T00:00:00.000Z"),
        closesAt: new Date("2027-09-01T00:00:00.000Z"),
      },
      {
        semester: "2027-2028 First Semester",
        opensAt: new Date("2027-01-01T00:00:00.000Z"),
        closesAt: new Date("2027-04-01T00:00:00.000Z"),
      },
    ], new Date("2026-11-18T12:00:00.000Z"));

    expect(options[0].label).toBe("2027-2028 First Semester (Next)");
    expect(options[1].label).toBe("2027-2028 Second Semester (Scheduled)");
  });

  it("returns no options when no schedules are configured", () => {
    expect(getAccountingTermOptions([], new Date("2026-11-18T12:00:00.000Z"))).toEqual([]);
  });

  it("uses the schedule label for a date inside its window", () => {
    const term = accountingTermForDate(
      [{
        semester: "2026-2027 2nd Semester",
        opensAt: new Date("2026-11-01T00:00:00.000Z"),
        closesAt: new Date("2027-02-01T00:00:00.000Z"),
      }],
      new Date("2026-12-10T00:00:00.000Z"),
    );
    expect(term).toBe("2026-2027 Second Semester");
  });
});
