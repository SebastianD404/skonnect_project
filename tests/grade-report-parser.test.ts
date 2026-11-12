import { describe, expect, it } from "vitest";
import { parseGradeReportText } from "../lib/grade-report-parser";

const fixtures = {
  clean: `SUBJ101 Introduction to Computing 3 1.25
MATH102 College Algebra 3 1.75
ENG103 Communication Skills 2 1.50`,
  noisy: `SUBJ1O1 Introduction to Computing 3 1,25
MATH1O2 College Algebra 3 l.75
ENG1O3 Communication Skills 2 1.5O`,
  incomplete: `SUBJ101 Introduction to Computing 3 1.25
MATH102 College Algebra 3 INC
PE103 Physical Education 2 DRP
SCI104 General Science 3 NG
PE105 Physical Education 2 W
HIST106 Philippine History 3 5.00`,
};

describe("parseGradeReportText", () => {
  it("parses clean subject rows and computes a units-weighted GWA", () => {
    const result = parseGradeReportText(fixtures.clean);

    expect(result.rows).toHaveLength(3);
    expect(result.rows[0]).toMatchObject({
      subjectCode: "SUBJ101",
      subjectName: "Introduction to Computing",
      units: 3,
      grade: 1.25,
      flag: null,
    });
    expect(result.gwa).toBe(1.5);
    expect(result.totalUnits).toBe(8);
    expect(result.unrecognizedRows).toEqual([]);
  });

  it("normalizes common OCR character and decimal noise", () => {
    const result = parseGradeReportText(fixtures.noisy);

    expect(result.rows.map((row) => row.grade)).toEqual([1.25, 1.75, 1.5]);
    expect(result.rows[0].subjectCode).toBe("SUBJ1O1");
    expect(result.gwa).toBe(1.5);
  });

  it("uses the unit column before the final grade when both contain decimals", () => {
    const result = parseGradeReportText(
      "SUBJ101 Introduction to Computing 3.0 1.25\nMATH102 College Algebra 3.0 1.75"
    );

    expect(result.rows.map(({ units, grade }) => ({ units, grade }))).toEqual([
      { units: 3, grade: 1.25 },
      { units: 3, grade: 1.75 },
    ]);
    expect(result.gwa).toBe(1.5);
    expect(result.unrecognizedRows).toEqual([]);
  });

  it("treats collegiate grades above 3.0 through 5.0 as failing", () => {
    const result = parseGradeReportText("SUBJ101 Introduction to Computing 3.0 3.24");

    expect(result.rows).toEqual([
      {
        subjectCode: "SUBJ101",
        subjectName: "Introduction to Computing",
        units: 3,
        grade: null,
        flag: "FAILED",
      },
    ]);
    expect(result.gwa).toBeNull();
    expect(result.requiresStrictManualReview).toBe(true);
  });

  it("uses header order when the grade column comes before the credits column", () => {
    const result = parseGradeReportText(
      "Course Description  Final Grade  Credits\nSUBJ101 Introduction to Computing 4.0 3"
    );

    expect(result.rows).toMatchObject([
      { units: 3, grade: null, flag: "FAILED" },
    ]);
    expect(result.gradingScale).toBe("collegiate");
  });

  it("flags identical standard unit and grade values as ambiguous", () => {
    const result = parseGradeReportText(
      "Course Description  Units  Final Grade\nSUBJ101 Introduction to Computing 3 3"
    );

    expect(result.rows).toEqual([]);
    expect(result.ambiguousRows).toEqual([
      "SUBJ101 Introduction to Computing 3 3",
    ]);
    expect(result.requiresStrictManualReview).toBe(true);
    expect(result.gwa).toBeNull();
  });

  it("uses percentage thresholds and flags grades below 75 for review", () => {
    const result = parseGradeReportText(
      "Course Description  Units  Final Grade\nSUBJ101 Introduction to Computing 3 74\nMATH102 College Algebra 3 85"
    );

    expect(result.gradingScale).toBe("percentage");
    expect(result.rows.map(({ grade, flag }) => ({ grade, flag }))).toEqual([
      { grade: null, flag: "FAILED" },
      { grade: 85, flag: null },
    ]);
    expect(result.requiresStrictManualReview).toBe(true);
  });

  it("flags conflicting numeric grades and remarks for manual review", () => {
    const result = parseGradeReportText(
      "SUBJ101 Introduction to Computing 3 2.0 FAILED"
    );

    expect(result.conflictingRows).toEqual([
      "SUBJ101 Introduction to Computing 3 2.0 FAILED",
    ]);
    expect(result.requiresStrictManualReview).toBe(true);
    expect(result.gwa).toBeNull();
  });

  it("prioritizes FAILED and NFE remarks over numeric grades", () => {
    const result = parseGradeReportText(
      "SUBJ101 Introduction to Computing 3.0 1.25 FAILED\nMATH102 College Algebra 3.0 1.75 NFE\nENG103 Communication Skills 2.0 1.50 DRP"
    );

    expect(result.rows.map(({ grade, flag }) => ({ grade, flag }))).toEqual([
      { grade: null, flag: "FAILED" },
      { grade: null, flag: "NFE" },
      { grade: null, flag: "DRP" },
    ]);
  });

  it("supports percentage grades but does not combine them with Philippine-scale grades", () => {
    const result = parseGradeReportText(
      "SUBJ101 Introduction to Computing 3.0 91.5\nMATH102 College Algebra 3.0 1.75"
    );

    expect(result.gwa).toBeNull();
    expect(result.gradingScale).toBe("mixed");
    expect(result.requiresStrictManualReview).toBe(true);
  });

  it("keeps non-numeric and failing rows flagged and excludes them from the average", () => {
    const result = parseGradeReportText(fixtures.incomplete);

    expect(result.rows.map((row) => row.flag)).toEqual([null, "INC", "DRP", "NG", "W", "FAILED"]);
    expect(result.rows[5]).toMatchObject({ grade: null, flag: "FAILED" });
    expect(result.gwa).toBe(1.25);
    expect(result.totalUnits).toBe(3);
    expect(result.unrecognizedRows).toEqual([]);
  });

  it("uses an explicit GWA when subject rows are not readable", () => {
    const result = parseGradeReportText("GENERAL WEIGHTED AVERAGE: 1.75");

    expect(result.gwa).toBe(1.75);
    expect(result.totalUnits).toBe(0);
  });

  it.each([
    ["GWA\n1.25", 1.25],
    ["GPA = 2,50", 2.5],
    ["Weighted Average:\n 1.875", 1.88],
    ["Term Average 85.5", 85.5],
    ["Average: 75", 75],
    ["GWA: 100", 100],
  ])("extracts a labeled average despite OCR spacing: %s", (text, expected) => {
    expect(parseGradeReportText(text).gwa).toBe(expected);
  });

  it.each(["GWA: 74.99", "GPA: 3.25", "Average: 4.00", "GWA: 3 units"])(
    "rejects out-of-range or unrelated numeric values: %s",
    (text) => {
      expect(parseGradeReportText(text).gwa).toBeNull();
    }
  );

  it("prefers a computed weighted average over an explicit GWA", () => {
    const result = parseGradeReportText(`${fixtures.clean}\nGWA: 2.00`);

    expect(result.gwa).toBe(1.5);
  });
});
