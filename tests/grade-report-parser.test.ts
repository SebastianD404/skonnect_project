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

  it("keeps non-numeric and failing rows flagged and excludes them from the average", () => {
    const result = parseGradeReportText(fixtures.incomplete);

    expect(result.rows.map((row) => row.flag)).toEqual([null, "INC", "DRP", "NG", "W", "FAILED"]);
    expect(result.rows[5]).toMatchObject({ grade: null, flag: "FAILED" });
    expect(result.gwa).toBe(1.25);
    expect(result.totalUnits).toBe(3);
    expect(result.unrecognizedRows).toEqual([]);
  });
});
