import { describe, expect, it } from "vitest";
import {
  buildSemesterTracker,
  getAcademicSemesterOrder,
  getCurrentManilaAcademicSemester,
  getNextAcademicSemester,
  isAcademicSemesterAfter,
} from "../lib/semester-progress";

describe("academic term ordering", () => {
  it("counts individually approved documents before the whole submission is approved", () => {
    expect(
      buildSemesterTracker(
        [
          {
            semester: "2026-2027 Second Semester",
            status: "PENDING",
            coeStatus: "APPROVED",
            gradesStatus: "PENDING",
            coeFileUrl: "coe.pdf",
            gradeFileUrl: "grades.pdf",
          },
        ],
        "2026-2027 Second Semester",
      ),
    ).toEqual({
      current: "2026-2027 Second Semester",
      approved: 1,
      total: 2,
      pct: 50,
    });
  });

  it("counts both documents for submissions awaiting physical verification", () => {
    expect(
      buildSemesterTracker(
        [
          {
            semester: "2026-2027 Second Semester",
            status: "AWAITING_PHYSICAL_CTC",
            coeFileUrl: "coe.pdf",
            gradeFileUrl: "grades.pdf",
          },
        ],
        "2026-2027 Second Semester",
      ).approved,
    ).toBe(2);
  });

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
