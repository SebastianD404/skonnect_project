import { describe, expect, it } from "vitest";
import {
  getAcademicSemesterOrder,
  getCurrentManilaAcademicSemester,
  getNextAcademicSemester,
  isAcademicSemesterAfter,
} from "../lib/semester-progress";

describe("academic term ordering", () => {
  it("orders semesters sequentially across academic years", () => {
    expect(
      getAcademicSemesterOrder("2026-2027 Second Semester")!,
    ).toBeLessThan(getAcademicSemesterOrder("2027-2028 First Semester")!);
    expect(
      isAcademicSemesterAfter(
        "2027-2028 First Semester",
        "2026-2027 Second Semester",
      ),
    ).toBe(true);
    expect(
      isAcademicSemesterAfter(
        "2026-2027 First Semester",
        "2026-2027 Second Semester",
      ),
    ).toBe(false);
    expect(
      isAcademicSemesterAfter(
        "2026-2027 Second Semester",
        "2026-2027 Second Semester",
      ),
    ).toBe(false);
  });

  it("chooses the next semester and advances the academic year after second semester", () => {
    expect(getNextAcademicSemester("2026-2027 First Semester")).toBe(
      "2026-2027 Second Semester",
    );
    expect(getNextAcademicSemester("2026-2027 Second Semester")).toBe(
      "2027-2028 First Semester",
    );
  });

  it("resolves the current academic term in Philippine time", () => {
    expect(getCurrentManilaAcademicSemester(new Date("2027-01-01T00:00:00.000Z"))).toBe(
      "2026-2027 Second Semester",
    );
    expect(getCurrentManilaAcademicSemester(new Date("2027-06-01T00:00:00.000Z"))).toBe(
      "2027-2028 First Semester",
    );
  });
});
