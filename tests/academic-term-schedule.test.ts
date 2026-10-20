import { describe, expect, it } from "vitest";
import {
  formatManilaDateTime,
  parseManilaDateTime,
  resolveAcademicTermWindow,
} from "../lib/academic-term-schedule";

const schedules = [
  {
    id: "first",
    semester: "2026-2027 First Semester",
    opensAt: new Date("2026-06-01T00:00:00.000Z"),
    closesAt: new Date("2026-10-31T15:59:00.000Z"),
  },
  {
    id: "second",
    semester: "2026-2027 Second Semester",
    opensAt: new Date("2026-11-01T00:00:00.000Z"),
    closesAt: new Date("2027-03-31T15:59:00.000Z"),
  },
];

describe("academic term submission schedule", () => {
  it("resolves open, upcoming, and closed submission windows", () => {
    expect(resolveAcademicTermWindow(schedules, new Date("2026-08-01T00:00:00.000Z"))).toMatchObject({
      status: "OPEN",
      semester: "2026-2027 First Semester",
    });
    expect(resolveAcademicTermWindow(schedules, new Date("2026-10-31T16:00:00.000Z"))).toMatchObject({
      status: "UPCOMING",
      semester: "2026-2027 Second Semester",
    });
    expect(resolveAcademicTermWindow([schedules[0]], new Date("2026-11-01T00:00:00.000Z"))).toMatchObject({
      status: "CLOSED",
      semester: "2026-2027 First Semester",
    });
  });

  it("reports an unconfigured schedule when no term has been set", () => {
    expect(resolveAcademicTermWindow([], new Date("2026-08-01T00:00:00.000Z"))).toEqual({
      status: "UNCONFIGURED",
      semester: null,
      opensAt: null,
      closesAt: null,
    });
  });

  it("parses admin-entered times in Asia/Manila and formats them consistently", () => {
    const parsed = parseManilaDateTime("2026-11-01T08:30");
    expect(parsed?.toISOString()).toBe("2026-11-01T00:30:00.000Z");
    expect(parsed && formatManilaDateTime(parsed)).toBe("2026-11-01T08:30");
    expect(parseManilaDateTime("2026-02-30T10:00")).toBeNull();
  });
});
