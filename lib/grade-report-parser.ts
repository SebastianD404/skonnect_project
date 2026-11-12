export type GradeReportRow = {
  subjectCode: string | null;
  subjectName: string;
  units: number;
  grade: number | null;
  flag: "INC" | "DRP" | "W" | "NG" | "NFE" | "FAILED" | null;
};

export type GradeReportParseResult = {
  rows: GradeReportRow[];
  unrecognizedRows: string[];
  ambiguousRows: string[];
  conflictingRows: string[];
  gradingScale: "collegiate" | "percentage" | "mixed" | null;
  requiresStrictManualReview: boolean;
  gwa: number | null;
  totalUnits: number;
};

const FLAG_PATTERN = /^(INC|DRP|DROP|W|NG|NFE|FAILED|FAIL)$/i;
const CELL_VALUE = String.raw`(?:[0-9lIoO]+(?:[.,][0-9lIoO]+)?|INC|DRP|DROP|W|NG|NFE|FAILED|FAIL)`;
const ROW_PATTERN = new RegExp(
  String.raw`^(?:([A-Z0-9][A-Z0-9.-]{1,})\s+)?(.+?)\s+(${CELL_VALUE})\s+(${CELL_VALUE})(?:\s+(PASSED|FAILED|FAIL|INC|DRP|DROP|W|NG|NFE))?$`,
  "i",
);
const PHILIPPINE_GWA_VALUE =
  /(?:[12][.,]\d{1,3}|3[.,]0{1,3}|100(?:[.,]0{1,2})?|(?:7[5-9]|8\d|9\d)(?:[.,]\d{1,2})?)(?![\d.,]|\s+(?:units?|credits?)\b)/i;
const EXPLICIT_GWA_PATTERN = new RegExp(
  String.raw`(?:\bgwa\b|\bgpa\b|\bgeneral[ \t]+weighted[ \t]+average\b|\bweighted[ \t]+average\b|\bterm[ \t]+average\b|\baverage\b)[ \t:=]*(?:\r?\n[ \t:=]*)?[ \t]*(${PHILIPPINE_GWA_VALUE.source})`,
  "i",
);
const UNIT_HEADER_PATTERN = /\b(?:UNITS?|CREDITS?|HRS?)\b/i;
const GRADE_HEADER_PATTERN = /\b(?:GRADE|FINAL|RATING|MARK)\b/i;
const STANDARD_UNIT_WEIGHTS = new Set([1, 2, 3, 4, 5]);

type PendingGradeRow = {
  line: string;
  subjectCode: string | null;
  subjectName: string;
  units: number;
  grade: number | null;
  flag: GradeReportRow["flag"];
  remarks: string | null;
};

function parseNumber(value: string) {
  return Number(value.replace(",", ".").replace(/[oO]/g, "0").replace(/[lI]/g, "1"));
}

function parseExplicitGwa(text: string) {
  const normalizedText = text.replace(/[ \t]{2,}/g, " ");
  const match = normalizedText.match(EXPLICIT_GWA_PATTERN);
  if (!match?.[1]) return null;

  const value = parseNumber(match[1]);
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(2));
}

function getHeaderColumnOrder(line: string) {
  if (/\d/.test(line)) return null;

  const unitsHeader = UNIT_HEADER_PATTERN.exec(line);
  const gradeHeader = GRADE_HEADER_PATTERN.exec(line);
  if (unitsHeader?.index === undefined || gradeHeader?.index === undefined) return null;

  return unitsHeader.index < gradeHeader.index;
}

function parseFlag(value: string): GradeReportRow["flag"] {
  if (!FLAG_PATTERN.test(value)) return null;
  const normalized = value.toUpperCase();
  if (normalized === "FAIL" || normalized === "FAILED") return "FAILED";
  if (normalized === "DROP") return "DRP";
  return normalized as GradeReportRow["flag"];
}

function gradeScaleForValue(value: number): "collegiate" | "percentage" | null {
  if (value >= 1 && value <= 5) return "collegiate";
  if (value >= 70 && value <= 100) return "percentage";
  return null;
}

function isFailingGrade(value: number, scale: "collegiate" | "percentage") {
  return scale === "collegiate" ? value > 3 && value <= 5 : value < 75 && value >= 0;
}

export function parseGradeReportText(text: string): GradeReportParseResult {
  const rows: GradeReportRow[] = [];
  const unrecognizedRows: string[] = [];
  const ambiguousRows: string[] = [];
  const conflictingRows: string[] = [];
  const pendingRows: PendingGradeRow[] = [];
  let unitsBeforeGrade: boolean | null = null;

  for (const sourceLine of text.split(/\r?\n/)) {
    const line = sourceLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    const detectedColumnOrder = getHeaderColumnOrder(line);
    if (detectedColumnOrder !== null) {
      unitsBeforeGrade = detectedColumnOrder;
      continue;
    }

    const match = line.match(ROW_PATTERN);
    if (match) {
      const subjectCode = match[1]?.trim() ?? null;
      const subjectName = match[2].trim();
      const firstValue = match[3];
      const secondValue = match[4];
      const unitsValue = unitsBeforeGrade === false ? secondValue : firstValue;
      const rawGrade = unitsBeforeGrade === false ? firstValue : secondValue;
      const units = parseNumber(unitsValue);
      const flag = parseFlag(rawGrade);
      const grade = flag ? null : parseNumber(rawGrade);
      const remarks = match[5]?.toUpperCase() ?? null;

      if (!subjectName || !Number.isFinite(units) || units <= 0 || units > 100) {
        unrecognizedRows.push(line);
        continue;
      }

      if (
        grade !== null &&
        STANDARD_UNIT_WEIGHTS.has(units) &&
        grade === units
      ) {
        ambiguousRows.push(line);
        unrecognizedRows.push(line);
        continue;
      }

      pendingRows.push({ line, subjectCode, subjectName, units, grade, flag, remarks });
      continue;
    }

    if (/\d\s+\S+\s*$/.test(line) && /[a-z]{2}/i.test(line)) {
      unrecognizedRows.push(line);
    }
  }

  const gradeSignals = pendingRows.flatMap((row) =>
    row.grade !== null && row.flag === null && !row.remarks?.match(/^(INC|DRP|DROP|W|NG|NFE)$/)
      ? [gradeScaleForValue(row.grade)]
      : [],
  );
  const hasCollegiateGrades = gradeSignals.includes("collegiate");
  const hasPercentageGrades = gradeSignals.includes("percentage");
  const hasMixedGradeScales = hasCollegiateGrades && hasPercentageGrades;
  const gradingScale = hasMixedGradeScales
    ? "mixed"
    : hasPercentageGrades
      ? "percentage"
      : hasCollegiateGrades
        ? "collegiate"
        : null;

  for (const row of pendingRows) {
    const remarkFlag = row.remarks ? parseFlag(row.remarks) : null;
    const rowScale = row.grade === null ? null : gradeScaleForValue(row.grade);
    const scale = gradingScale === "mixed" ? null : gradingScale ?? rowScale;

    if (row.grade === null && !row.flag) {
      unrecognizedRows.push(row.line);
      continue;
    }

    if (row.grade !== null && (row.remarks === "PASSED" || remarkFlag === "FAILED" || remarkFlag)) {
      const gradeIsFailing = scale ? isFailingGrade(row.grade, scale) : null;
      const hasContradictoryRemark =
        (row.remarks === "PASSED" && gradeIsFailing === true) ||
        (remarkFlag === "FAILED" && gradeIsFailing === false) ||
        (remarkFlag !== null && remarkFlag !== "FAILED");
      if (hasContradictoryRemark) {
        conflictingRows.push(row.line);
        rows.push({
          subjectCode: row.subjectCode,
          subjectName: row.subjectName,
          units: row.units,
          grade: null,
          flag: remarkFlag ?? (gradeIsFailing ? "FAILED" : null),
        });
        continue;
      }
    }

    if (row.flag || remarkFlag) {
      rows.push({
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        units: row.units,
        grade: null,
        flag: remarkFlag ?? row.flag,
      });
      continue;
    }

    if (row.grade === null || !Number.isFinite(row.grade)) {
      unrecognizedRows.push(row.line);
      continue;
    }

    const recognizedScale = gradingScale === "mixed" ? null : gradingScale ?? rowScale;
    const isInScale = recognizedScale === "collegiate"
      ? row.grade >= 1 && row.grade <= 5
      : recognizedScale === "percentage"
        ? row.grade >= 0 && row.grade <= 100
        : false;
    if (!isInScale || recognizedScale === null) {
      unrecognizedRows.push(row.line);
      continue;
    }

    const failing = isFailingGrade(row.grade, recognizedScale);
    if (row.remarks === "PASSED" && failing) {
      conflictingRows.push(row.line);
      unrecognizedRows.push(row.line);
      continue;
    }

    rows.push({
      subjectCode: row.subjectCode,
      subjectName: row.subjectName,
      units: row.units,
      grade: failing ? null : row.grade,
      flag: failing ? "FAILED" : null,
    });
  }

  const hasParseWarnings =
    unrecognizedRows.length > 0 ||
    ambiguousRows.length > 0 ||
    conflictingRows.length > 0 ||
    hasMixedGradeScales;
  const gradedRows = rows.filter(
    (row): row is GradeReportRow & { grade: number } => row.grade !== null,
  );
  const totalUnits = gradedRows.reduce((sum, row) => sum + row.units, 0);
  const weightedTotal = gradedRows.reduce((sum, row) => sum + row.grade * row.units, 0);
  const explicitGwa = parseExplicitGwa(text);
  const weightedGwa = totalUnits > 0 && !hasParseWarnings
    ? Number((weightedTotal / totalUnits).toFixed(2))
    : null;

  return {
    rows,
    unrecognizedRows,
    ambiguousRows,
    conflictingRows,
    gradingScale,
    requiresStrictManualReview:
      hasParseWarnings || rows.some((row) => row.flag === "FAILED"),
    gwa: hasParseWarnings ? null : weightedGwa ?? explicitGwa,
    totalUnits,
  };
}
