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
const PHILIPPINE_GWA_VALUE =
  /(?:[12][.,]\d{1,3}|3[.,]0{1,3}|(?:7[5-9]|8\d|9\d)(?:[.,]\d{1,2})?)(?![\d.,]|\s+(?:units?|credits?)\b)/i;
const EXPLICIT_GWA_PATTERN = new RegExp(
  String.raw`(?:\bgwa\b|\bgpa\b|\bgeneral[ \t]+weighted[ \t]+average\b|\bweighted[ \t]+average\b|\bterm[ \t]+average\b|\baverage\b)[ \t:=]*(?:\r?\n[ \t:=]*)?[ \t]*(${PHILIPPINE_GWA_VALUE.source})`,
  "i"
);

function parseNumber(value: string) {
  return Number(value.replace(",", ".").replace(/[oO]/g, "0").replace(/[lI]/g, "1"));
}

function normalizeGrade(value: string) {
  return value.replace(/[oO]/g, "0").replace(/[lI]/g, "1").replace(",", ".");
}

function parseExplicitGwa(text: string) {
  const normalizedText = text.replace(/[ \t]{2,}/g, " ");
  const match = normalizedText.match(EXPLICIT_GWA_PATTERN);
  if (!match?.[1]) return null;

  const value = parseNumber(match[1]);
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
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
  const weightedGwa = totalUnits > 0 ? Number((weightedTotal / totalUnits).toFixed(2)) : null;
  const explicitGwa = parseExplicitGwa(text);

  return {
    rows,
    unrecognizedRows,
    gwa: weightedGwa ?? explicitGwa,
    totalUnits,
  };
}
