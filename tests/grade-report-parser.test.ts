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

  it("ignores academic-year and student-number lines when computing GWA", () => {
    const result = parseGradeReportText(
      `${fixtures.clean}\nACADEMIC YEAR 2026-2027\nSTUDENT NO. 123456`,
    );

    expect(result.gwa).toBe(1.5);
    expect(result.unrecognizedRows).toEqual([]);
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

  it("treats collegiate grades above 3.01 and decimal 5.00 as failing", () => {
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

  it("does not flag an integer 5 as a failing grade on the 1-to-5 scale", () => {
    const result = parseGradeReportText(
      "Course Units Final Grade\nSUBJ101 Introduction to Computing 3 5\nMATH102 College Algebra 3 2",
    );

    expect(result.detectedScale).toBe("SCALE_1_TO_5");
    expect(result.hasPossibleFailingGrade).toBe(false);
    expect(result.rows).toMatchObject([
      { units: 3, grade: 5, flag: null },
      { units: 3, grade: 2, flag: null },
    ]);
  });

  it("flags decimal 5.00 but not grades at or below 3.01", () => {
    const result = parseGradeReportText(
      "Course Units Final Grade\nSUBJ101 Introduction to Computing 3 5.00\nMATH102 College Algebra 3 3.01",
    );

    expect(result.hasPossibleFailingGrade).toBe(true);
    expect(result.flaggedSubjects).toEqual(["SUBJ101 Introduction to Computing: 5.00"]);
    expect(result.rows).toMatchObject([
      { units: 3, grade: null, flag: "FAILED" },
      { units: 3, grade: 3.01, flag: null },
    ]);
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

  it("uses explicit final-grade columns when units and grades have the same value", () => {
    const result = parseGradeReportText(
      "Course Description  Units  Final Grade\nSUBJ101 Introduction to Computing 3 3"
    );

    expect(result.rows).toMatchObject([{ units: 3, grade: 3, flag: null }]);
    expect(result.ambiguousRows).toEqual([]);
    expect(result.detectedScale).toBe("SCALE_1_TO_5");
  });

  it("flags identical unit and grade values as ambiguous without column headers", () => {
    const result = parseGradeReportText("SUBJ101 Introduction to Computing 3 3");

    expect(result.rows).toEqual([]);
    expect(result.ambiguousRows).toEqual(["SUBJ101 Introduction to Computing 3 3"]);
    expect(result.gwa).toBeNull();
  });

  it("does not mistake a lone 3.00 units value for a 3.00 grade", () => {
    const result = parseGradeReportText("SUBJ101 Introduction to Computing 3.00");

    expect(result.rows).toEqual([]);
    expect(result.ambiguousRows).toEqual(["SUBJ101 Introduction to Computing 3.00"]);
    expect(result.detectedScale).toBeNull();
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
    expect(result.detectedScale).toBe("PERCENTAGE_100");
    expect(result.estimatedGwa).toBe(79.5);
    expect(result.meetsGwaRequirement).toBe(false);
    expect(result.flaggedGrades).toEqual(["SUBJ101 Introduction to Computing: 74"]);
    expect(result.possibleFailingGradeMessage).toBe(
      "Possible failing grade detected. An SK Admin will verify your official grade report.",
    );
    expect(result.requiresStrictManualReview).toBe(true);
  });

  it.each([
    ["WMAD305 Web Development 3.00 1.75", "WMAD305", 3, 1.75],
    ["GE 101 Communication Skills 3.00 3.24", "GE 101", 3, 3.24],
    ["IT-202 Network Systems 3.00 5.00", "IT-202", 3, 5],
    ["NSTP 1 Civic Welfare 2 88.5", "NSTP 1", 2, 88.5],
  ])("strips course codes before extracting units and grades: %s", (line, code, units, grade) => {
    const result = parseGradeReportText(`Course Units Final Grade\n${line}`);

    expect(result.rows[0]).toMatchObject({
      subjectCode: code,
      units,
      grade: grade > 3 && grade <= 5 ? null : grade,
      flag: grade > 3 && grade <= 5 ? "FAILED" : null,
    });
  });

  it("flags 3.24 and INC or DROPPED statuses on the 1-to-5 scale", () => {
    const result = parseGradeReportText(
      "Course Units Final Grade\nGE 101 Communication 3.00 3.24\nIT-202 Networking 3.00 1.75 INC\nNSTP 1 Civic Welfare 2.00 1.50 DROPPED",
    );

    expect(result.detectedScale).toBe("SCALE_1_TO_5");
    expect(result.hasPossibleFailingGrade).toBe(true);
    expect(result.flaggedGrades).toEqual([
      "GE 101 Communication: 3.24",
      "IT-202 Networking: INC",
      "NSTP 1 Civic Welfare: DROPPED",
    ]);
  });

  it("uses a simple average when units are not paired", () => {
    const result = parseGradeReportText(
      "SUBJ101 Introduction to Computing 85\nMATH102 College Algebra 95",
    );

    expect(result.detectedScale).toBe("PERCENTAGE_100");
    expect(result.estimatedGwa).toBe(90);
    expect(result.totalUnits).toBe(0);
  });

  it("ignores single-digit credit units on percentage reports", () => {
    const result = parseGradeReportText(
      "Course Units Final Grade\nSystems Administration and Maintenance 5\nSUBJ101 Introduction to Computing 3 74\nMATH102 College Algebra 3 85",
    );

    expect(result.detectedScale).toBe("PERCENTAGE_100");
    expect(result.flaggedSubjects).toEqual(["SUBJ101 Introduction to Computing: 74"]);
    expect(result.rows).toMatchObject([
      { subjectName: "Introduction to Computing", units: 3, grade: null, flag: "FAILED" },
      { subjectName: "College Algebra", units: 3, grade: 85, flag: null },
    ]);
    expect(result.unrecognizedRows).not.toContain(
      "Systems Administration and Maintenance 5",
    );
  });

  it("does not flag the visible percentage grades in a table with noisy OCR", () => {
    const result = parseGradeReportText(
      [
        "3rd Year, First Semester",
        "DESCRIPTION UNTS CREDITED GRADE",
        "i. I. 3.0 9%",
        "Foreign Language (Korean/Mandarin/Nihongo)",
        "wwAD 301",
        "Principles of Accounting 2.0 °4",
        "WhI£D30",
        "Mobile Systeme and Technologies ie 0",
        "Prerequisices: 7210-1",
        "Advance Web Systems Technologies _— 03",
        "Prerequisices: IT 209",
        "WhAD304",
        "Network Management &Application Areas 2 85",
        "Prerequisices: IT 202, 1T206-1, IT 208",
        "WMADET",
        "Web and Mobile Application Development Elective 1 2.0 85",
      ].join("\n"),
    );

    expect(result.hasPossibleFailingGrade).toBe(false);
    expect(result.flaggedSubjects).toEqual([]);
  });

  it("does not flag the visible 99, 94, 91, 93, 89, and 85 percentage grades", () => {
    const result = parseGradeReportText(
      [
        "3rd Year, First Semester",
        "DESCRIPTION UNITS CREDITED GRADE",
        "FL Foreign Language (Korean/Mandarin/Nihongo) 3.0 99",
        "WMAD 301 Principles of Accounting 3.0 94",
        "WMAD302 Mobile Systems and Technologies 3.0 91",
        "WMAD303-1 Advance Web Systems Technologies 3.0 93",
        "WMAD304 Network Management & Application Areas 3.0 89",
        "WMADE1 Web and Mobile Application Development Elective 1 3.0 85",
      ].join("\n"),
    );

    expect(result.detectedScale).toBe("PERCENTAGE_100");
    expect(result.hasPossibleFailingGrade).toBe(false);
    expect(result.flaggedSubjects).toEqual([]);
  });

  it("still flags a clear percentage failing grade when other OCR rows are ambiguous", () => {
    const result = parseGradeReportText(
      [
        "Course Units Final Grade",
        "SUBJ101 Introduction to Computing 3 74",
        "MATH102 College Algebra 3 85",
        "Advance Web Systems Technologies _— 03",
      ].join("\n"),
    );

    expect(result.hasPossibleFailingGrade).toBe(true);
    expect(result.flaggedSubjects).toEqual([
      "SUBJ101 Introduction to Computing: 74",
    ]);
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
    expect(result.gwa).toBe(3.13);
    expect(result.totalUnits).toBe(6);
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

  it.each([
    ["GWA: 74.99", 74.99, "PERCENTAGE_100", false],
    ["GPA: 3.25", 3.25, "SCALE_1_TO_5", false],
    ["Average: 4.00", 4, "SCALE_1_TO_5", false],
    ["GWA: 3 units", null, null, null],
  ])("reads explicit GWA values before subject rows: %s", (text, gwa, scale, meets) => {
    const result = parseGradeReportText(text);
    expect(result.estimatedGwa).toBe(gwa);
    expect(result.detectedScale).toBe(scale);
    expect(result.meetsGwaRequirement).toBe(meets);
  });

  it("prefers an explicit GWA over the computed weighted average", () => {
    const result = parseGradeReportText(`${fixtures.clean}\nGWA: 2.00`);

    expect(result.gwa).toBe(2);
  });

  it.each([
    ["GWA: 80", "PERCENTAGE_100", true],
    ["GWA: 79.99", "PERCENTAGE_100", false],
    ["GWA: 2.50", "SCALE_1_TO_5", true],
    ["GWA: 2.51", "SCALE_1_TO_5", false],
  ])("evaluates the maintenance boundary for %s", (text, scale, meets) => {
    const result = parseGradeReportText(text);
    expect(result.detectedScale).toBe(scale);
    expect(result.meetsGwaRequirement).toBe(meets);
    expect(result.requiresStrictManualReview).toBe(meets === false);
  });
});
