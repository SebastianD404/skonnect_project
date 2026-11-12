import type { GradeReportParseResult } from "@/lib/grade-report-parser";

const FAILING_STATUS = /\b(?:FAILED|FAIL|NFE|INC|DRP|DROP)\b/i;
const NUMERIC_TOKEN = /(?<![A-Z0-9])\d+(?:[.,]\d+)?(?![A-Z0-9])/gi;

export function hasFailingGradeIndicators(
  text: string,
  parsed?: Pick<GradeReportParseResult, "rows">
): boolean {
  if (parsed) {
    return FAILING_STATUS.test(text) || parsed.rows.some((row) => row.flag === "FAILED");
  }

  const candidates = text.split(/\r?\n/).flatMap((line) => {
    const values = [...line.matchAll(NUMERIC_TOKEN)].map((match) =>
      Number(match[0].replace(",", "."))
    );
    if (values.length === 0) return [];

    const gradeLabel = line.match(/\b(?:final\s+)?grade\s*[:=]?\s*(\d+(?:[.,]\d+)?)/i);
    const candidate = gradeLabel
      ? Number(gradeLabel[1].replace(",", "."))
      : values[values.length - 1];
    return Number.isFinite(candidate) ? [candidate] : [];
  });

  if (text.split(/\r?\n/).some((line) => FAILING_STATUS.test(line))) return true;

  const hasPercentageScale = candidates.some((value) => value >= 70 && value <= 100);
  const hasCollegiateScale = candidates.some((value) => value >= 1 && value <= 5);
  if (hasPercentageScale && hasCollegiateScale) return true;

  return candidates.some((value) => {
    if (hasPercentageScale) return value >= 0 && value < 75;
    return value > 3 && value <= 5;
  });
}
