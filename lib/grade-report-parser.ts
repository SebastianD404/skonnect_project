export type GradeReportRow = {
  subjectCode: string | null;
  subjectName: string;
  units: number;
  grade: number | null;
  flag: "INC" | "DRP" | "W" | "NG" | "FAILED" | null;
};

export type GradeReportParseResult = {
  rows: GradeReportRow[];
  unrecognizedRows: string[];
  gwa: number | null;
  totalUnits: number;
};

const FLAG_PATTERN = /^(INC|DRP|W|NG)$/i;
const ROW_PATTERN =
  /^(?:([A-Z0-9][A-Z0-9.-]{1,})\s+)?(.+?)\s+(\d+(?:[.,]\d+)?)\s+([0-9lIoO]+(?:[.,][0-9lIoO]+)?|INC|DRP|W|NG)$/i;

function parseNumber(value: string) {
  return Number(value.replace(",", ".").replace(/[oO]/g, "0").replace(/[lI]/g, "1"));
}

function normalizeGrade(value: string) {
  return value.replace(/[oO]/g, "0").replace(/[lI]/g, "1").replace(",", ".");
}

export function parseGradeReportText(text: string): GradeReportParseResult {
  const rows: GradeReportRow[] = [];
  const unrecognizedRows: string[] = [];

  for (const sourceLine of text.split(/\r?\n/)) {
    const line = sourceLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const match = line.match(ROW_PATTERN);
    if (match) {
      const subjectCode = match[1]?.trim() ?? null;
      const subjectName = match[2].trim();
      const units = parseNumber(match[3]);
      const rawGrade = match[4];
      const flagMatch = rawGrade.match(FLAG_PATTERN);
      const parsedGrade = flagMatch ? null : parseNumber(normalizeGrade(rawGrade));
      const failedGrade = parsedGrade === 5;
      const grade = flagMatch || failedGrade ? null : parsedGrade;
      const flag = flagMatch
        ? (flagMatch[1].toUpperCase() as GradeReportRow["flag"])
        : failedGrade
          ? "FAILED"
          : null;

      if (
        !subjectName ||
        !Number.isFinite(units) ||
        units <= 0 ||
        (!flagMatch && !failedGrade && (grade === null || !Number.isFinite(grade) || grade < 1 || grade >= 5))
      ) {
        unrecognizedRows.push(line);
        continue;
      }

      rows.push({
        subjectCode,
        subjectName,
        units,
        grade,
        flag,
      });
      continue;
    }

    if (/\d\s+\S+\s*$/.test(line) && /[a-z]{2}/i.test(line)) {
      unrecognizedRows.push(line);
    }
  }

  const gradedRows = rows.filter((row): row is GradeReportRow & { grade: number } => row.grade !== null);
  const totalUnits = gradedRows.reduce((sum, row) => sum + row.units, 0);
  const weightedTotal = gradedRows.reduce((sum, row) => sum + row.grade * row.units, 0);

  return {
    rows,
    unrecognizedRows,
    gwa: totalUnits > 0 ? Number((weightedTotal / totalUnits).toFixed(2)) : null,
    totalUnits,
  };
}
