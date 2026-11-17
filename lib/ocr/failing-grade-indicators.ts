import {
  parseGradeReportText,
  type GradeReportParseResult,
} from "@/lib/grade-report-parser";

export function hasFailingGradeIndicators(
  text: string,
  parsed?: Pick<GradeReportParseResult, "rows"> &
    Partial<Pick<GradeReportParseResult, "hasPossibleFailingGrade">>
): boolean {
  if (parsed) {
    if (typeof parsed.hasPossibleFailingGrade === "boolean") {
      return parsed.hasPossibleFailingGrade;
    }
    return parsed.rows.some(
      (row) => row.flag === "FAILED" || row.flag === "INC" || row.flag === "DRP",
    );
  }

  return parseGradeReportText(text).hasPossibleFailingGrade;
}
