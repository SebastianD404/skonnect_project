export type GradeReportRow = {
  subjectCode: string | null;
  subjectName: string;
  units: number;
  grade: number | null;
  flag: "INC" | "DRP" | "W" | "UW" | "NG" | "NFE" | "FAILED" | null;
};

export type DetectedGradingScale = "PERCENTAGE_100" | "SCALE_1_TO_5";

export type GradeReportDiagnostics = {
  detectedScale: DetectedGradingScale | null;
  estimatedGwa: number | null;
  gwaCheckStatus: "MEETS_REQUIREMENT" | "BELOW_REQUIREMENT" | "UNAVAILABLE";
  meetsGwaRequirement: boolean | null;
  gwaMessage: string;
  hasPossibleFailingGrade: boolean;
  flaggedSubjects: string[];
  flaggedGrades: string[];
  possibleFailingGradeMessage: string | null;
};

export type GradeReportParseResult = GradeReportDiagnostics & {
  rows: GradeReportRow[];
  unrecognizedRows: string[];
  ambiguousRows: string[];
  conflictingRows: string[];
  gradingScale: "collegiate" | "percentage" | "mixed" | null;
  requiresStrictManualReview: boolean;
  gwa: number | null;
  totalUnits: number;
};

const FAILING_STATUS = /^(FAILED|FAIL|INC|DRP|DROP|DROPPED|UW)$/i;
const FLAG_PATTERN = /^(INC|DRP|DROP|DROPPED|W|UW|NG|NFE|FAILED|FAIL)$/i;
const NUMERIC_TOKEN = /(?<![A-Z0-9])([0-9lIoO]+(?:[.,][0-9lIoO]+)?)(?![A-Z0-9])/gi;
const STATUS_TOKEN = /\s+(PASSED|FAILED|FAIL|INC|DRP|DROP|DROPPED|W|UW|NG|NFE)\s*$/i;
const EXPLICIT_GWA_LABEL =
  /\b(?:gwa|gpa|general[ \t]+weighted[ \t]+average|weighted[ \t]+average|term[ \t]+average|average)\b/i;
const EXPLICIT_GWA_PATTERN =
  /(?:\bgwa\b|\bgpa\b|\bgeneral[ \t]+weighted[ \t]+average\b|\bweighted[ \t]+average\b|\bterm[ \t]+average\b|\baverage\b)[ \t:=]*(?:\r?\n[ \t:=]*)?[ \t]*([0-9lIoO]+(?:[.,][0-9lIoO]+)?)(?![\d.,]|\s+(?:units?|credits?)\b)/i;
const UNIT_HEADER_PATTERN = /\b(?:UNITS?|CREDITS?|HRS?)\b/i;
const GRADE_HEADER_PATTERN = /\b(?:GRADE|FINAL|RATING|MARK)\b/i;
const MINIMUM_COMPUTED_ROWS = 2;
const GRADE_TABLE_HEADER_PATTERNS = [
  /\bDESCRIPTION\b/i,
  /\bUNITS?\b/i,
  /\bCREDITED\b/i,
  /\bGRADE\s+POINTS?\b/i,
  /\bGRADE\b(?!\s+POINTS?\b)/i,
  /\bREMARKS?\b/i,
];

type PendingGradeRow = {
  line: string;
  subjectCode: string | null;
  subjectName: string;
  units: number | null;
  grade: number | null;
  rawGrade: string | null;
  flag: GradeReportRow["flag"];
  remarks: string | null;
};

function parseNumber(value: string) {
  return Number(value.replace(",", ".").replace(/[oO]/g, "0").replace(/[lI]/g, "1"));
}

function isLeadingZeroNumericToken(value: string) {
  return /^0[0-9lIoO]+(?:[.,][0-9lIoO]+)?$/i.test(value);
}

function getNumericMatches(text: string) {
  return [...text.matchAll(NUMERIC_TOKEN)].filter(
    (match) => !isLeadingZeroNumericToken(match[1]),
  );
}

function getCourseCode(line: string): { subjectCode: string | null; remaining: string } {
  const spacedCode = line.match(/^([A-Z]{1,8})\s+(\d{1,4})\s+(.+)$/i);
  if (
    spacedCode &&
    (spacedCode[1].length <= 4 || spacedCode[1] === spacedCode[1].toUpperCase()) &&
    (/[a-z]/i.test(spacedCode[3]) ||
      getNumericMatches(spacedCode[3]).length >= 2)
  ) {
    return {
      subjectCode: `${spacedCode[1]} ${spacedCode[2]}`,
      remaining: spacedCode[3],
    };
  }

  const compactCode = line.match(/^([A-Z][A-Z0-9.-]*\d[A-Z0-9.-]*)\s+(.+)$/i);
  if (compactCode) {
    return { subjectCode: compactCode[1], remaining: compactCode[2] };
  }

  return { subjectCode: null, remaining: line };
}

function getHeaderColumnOrder(line: string): boolean | null {
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
  if (normalized === "DROP" || normalized === "DROPPED") return "DRP";
  return normalized as GradeReportRow["flag"];
}

function gradeScaleForValue(value: number): "collegiate" | "percentage" | null {
  if (value >= 1 && value <= 5) return "collegiate";
  if (value >= 50 && value <= 100) return "percentage";
  return null;
}

function isUnitLikeValue(value: number, rawValue: string | null) {
  const normalizedRawValue = rawValue?.replace(/[oO]/g, "0") ?? null;
  return value >= 1 && value <= 6 &&
    normalizedRawValue !== null &&
    /^[1-6](?:[.,]0+)?$/.test(normalizedRawValue);
}

function hasPercentageGradeCandidate(text: string) {
  return text.split(/\r?\n/).some((sourceLine) => {
    const line = sourceLine.replace(/\s+/g, " ").trim();
    if (!line || EXPLICIT_GWA_LABEL.test(line)) return false;
    const { remaining } = getCourseCode(line);
    if (!/[a-z]/i.test(remaining)) return false;
    return getNumericMatches(remaining).some((match) => {
      const value = parseNumber(match[1]);
      return value >= 50 && value <= 100;
    });
  });
}

function parseExplicitGwa(text: string) {
  const match = text.replace(/[ \t]{2,}/g, " ").match(EXPLICIT_GWA_PATTERN);
  if (!match?.[1]) return null;
  const value = parseNumber(match[1]);
  return Number.isFinite(value) ? value : null;
}

function getSubjectLabel(row: PendingGradeRow) {
  return row.subjectCode
    ? `${row.subjectCode} ${row.subjectName}`.trim()
    : row.subjectName;
}

function isPossibleFailingGrade(
  value: number,
  scale: DetectedGradingScale | null,
  rawGrade: string | null,
): boolean {
  if (scale === "PERCENTAGE_100") {
    const normalizedRawGrade = rawGrade?.replace(/[oO]/g, "0").replace(/[lI]/g, "1") ?? null;
    return value >= 50 && value <= 74 && Boolean(normalizedRawGrade && /^(?:5\d|6\d|7[0-4])$/.test(normalizedRawGrade));
  }
  if (scale === "SCALE_1_TO_5") {
    const normalizedRawGrade = rawGrade?.replace(/[oO]/g, "0").replace(/[lI]/g, "1") ?? null;
    if (!normalizedRawGrade || value <= 3 || value > 5) return false;

    const decimalGrade = normalizedRawGrade.replace(",", ".");
    if (value < 4) {
      if (!/^\d+\.\d{1,2}$/.test(decimalGrade)) return false;
      return !["3.08", "3.80", "3.88"].includes(value.toFixed(2));
    }

    return (value === 4 || value === 5) && /^[45]\.0{1,2}$/.test(decimalGrade);
  }
  return false;
}

function detectedScaleFromValue(value: number): DetectedGradingScale | null {
  const scale = gradeScaleForValue(value);
  if (scale === "percentage") return "PERCENTAGE_100";
  if (scale === "collegiate") return "SCALE_1_TO_5";
  return null;
}

function getFragmentedPercentageGradeRows(text: string): PendingGradeRow[] {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/\s+/g, " ").trim());
  const rows: PendingGradeRow[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line || EXPLICIT_GWA_LABEL.test(line) || UNIT_HEADER_PATTERN.test(line) || GRADE_HEADER_PATTERN.test(line)) {
      continue;
    }

    const codeOnlyMatch = line.match(/^([A-Z][A-Z0-9.-]*\d[A-Z0-9.-]*)$/i);
    const parsedCourse = codeOnlyMatch ? null : getCourseCode(line);
    const subjectCode = codeOnlyMatch?.[1] ?? parsedCourse?.subjectCode;
    const initialSubjectName = codeOnlyMatch ? "" : parsedCourse?.remaining ?? "";
    if (!subjectCode) continue;

    let units: number | null = null;
    let rawUnits: string | null = null;
    let failingGrade: number | null = null;
    let rawFailingGrade: string | null = null;
    let subjectNameEnd = initialSubjectName.length;
    let foundOnFollowingLine = false;

    for (const match of getNumericMatches(initialSubjectName)) {
      const value = parseNumber(match[1]);
      if (isUnitLikeValue(value, match[1])) {
        units = value;
        rawUnits = match[1];
        subjectNameEnd = match.index;
      } else if (isPossibleFailingGrade(value, "PERCENTAGE_100", match[1])) {
        failingGrade = value;
        rawFailingGrade = match[1];
        subjectNameEnd = Math.min(subjectNameEnd, match.index);
      }
    }

    const initialSubjectLabel = initialSubjectName.slice(0, subjectNameEnd).trim();
    const subjectParts = initialSubjectLabel ? [initialSubjectLabel] : [];

    for (let nextIndex = index + 1; nextIndex < Math.min(lines.length, index + 6); nextIndex += 1) {
      const nextLine = lines[nextIndex];
      if (!nextLine || EXPLICIT_GWA_LABEL.test(nextLine)) break;
      if (
        getCourseCode(nextLine).subjectCode !== null ||
        UNIT_HEADER_PATTERN.test(nextLine) ||
        GRADE_HEADER_PATTERN.test(nextLine)
      ) {
        break;
      }

      const loneValue = nextLine.match(/^([0-9lIoO]+(?:[.,][0-9lIoO]+)?)$/i);
      if (loneValue) {
        if (isLeadingZeroNumericToken(loneValue[1])) continue;
        const value = parseNumber(loneValue[1]);
        if (isUnitLikeValue(value, loneValue[1])) {
          units = value;
          rawUnits = loneValue[1];
          foundOnFollowingLine = true;
        } else if (isPossibleFailingGrade(value, "PERCENTAGE_100", loneValue[1])) {
          failingGrade = value;
          rawFailingGrade = loneValue[1];
          foundOnFollowingLine = true;
        }
        if (units !== null && failingGrade !== null) break;
        continue;
      }

      if (/[a-z]/i.test(nextLine)) {
        subjectParts.push(nextLine);
        continue;
      }
      break;
    }

    if (
      !foundOnFollowingLine ||
      units === null ||
      failingGrade === null ||
      rawFailingGrade === null
    ) {
      continue;
    }
    rows.push({
      line: [line, ...subjectParts.slice(initialSubjectLabel ? 1 : 0), rawUnits, rawFailingGrade].join(" "),
      subjectCode,
      subjectName: subjectParts.join(" ").trim() || subjectCode,
      units,
      grade: failingGrade,
      rawGrade: rawFailingGrade,
      flag: null,
      remarks: null,
    });
  }

  return rows;
}

export function parseGradeReportText(text: string): GradeReportParseResult {
  const rows: GradeReportRow[] = [];
  const unrecognizedRows: string[] = [];
  const ambiguousRows: string[] = [];
  const conflictingRows: string[] = [];
  const fragmentedRows = getFragmentedPercentageGradeRows(text);
  const pendingRows: PendingGradeRow[] = [...fragmentedRows];
  const percentageGradeCandidateInText =
    hasPercentageGradeCandidate(text) || fragmentedRows.length > 0;
  let unitsBeforeGrade: boolean | null = null;
  let hasUnitsColumn = false;
  let hasGradeColumn = false;

  for (const sourceLine of text.split(/\r?\n/)) {
    const line = sourceLine.replace(/\s+/g, " ").trim();
    if (!line) continue;

    if (
      !/\d/.test(line) &&
      (UNIT_HEADER_PATTERN.test(line) || GRADE_HEADER_PATTERN.test(line))
    ) {
      hasUnitsColumn ||= UNIT_HEADER_PATTERN.test(line);
      hasGradeColumn ||= GRADE_HEADER_PATTERN.test(line);
      const detectedColumnOrder = getHeaderColumnOrder(line);
      if (detectedColumnOrder !== null) unitsBeforeGrade = detectedColumnOrder;
      continue;
    }

    if (EXPLICIT_GWA_LABEL.test(line)) continue;

    const { subjectCode, remaining } = getCourseCode(line);
    const statusMatch = remaining.match(STATUS_TOKEN);
    const remarks = statusMatch?.[1]?.toUpperCase() ?? null;
    const content = statusMatch
      ? remaining.slice(0, statusMatch.index).trim()
      : remaining;
    const numericMatches = getNumericMatches(content);
    if (!numericMatches.length && !remarks) continue;

    const selectedMatches = numericMatches.slice(-2);
    const firstSelected = selectedMatches[0];
    const lastSelected = selectedMatches[selectedMatches.length - 1];
    let subjectName = (firstSelected
      ? content.slice(0, firstSelected.index)
      : content).replace(/[\s:|,-]+$/, "").trim();
    if (!subjectName) subjectName = subjectCode ?? "";
    if (!subjectName || !/[a-z]/i.test(subjectName)) continue;

    let units: number | null = null;
    let grade: number | null = null;
    let rawGrade: string | null = null;

    if (selectedMatches.length >= 2 && firstSelected && lastSelected) {
      const firstValue = parseNumber(firstSelected[1]);
      const lastValue = parseNumber(lastSelected[1]);
      let unitsFirst = unitsBeforeGrade ?? true;
      if (
        unitsBeforeGrade === null &&
        firstValue >= 50 &&
        firstValue <= 100 &&
        lastValue >= 1 &&
        lastValue <= 6
      ) {
        unitsFirst = false;
      }

      const unitValue = unitsFirst ? firstValue : lastValue;
      const gradeValue = unitsFirst ? lastValue : firstValue;
      const gradeText = unitsFirst ? lastSelected[1] : firstSelected[1];
      if (unitValue >= 1 && unitValue <= 6) {
        units = unitValue;
        grade = gradeValue;
        rawGrade = gradeText;
      } else {
        grade = lastValue;
        rawGrade = lastSelected[1];
      }

      if (
        unitsBeforeGrade === null &&
        firstValue === lastValue &&
        units !== null &&
        grade !== null &&
        !(
          firstValue === 3 &&
          lastValue === 3 &&
          /^3[.,]0+$/i.test(firstSelected[1]) &&
          /^3[.,]0+$/i.test(lastSelected[1])
        )
      ) {
        ambiguousRows.push(line);
        unrecognizedRows.push(line);
        continue;
      }
    } else if (lastSelected && remarks) {
      const unitValue = parseNumber(lastSelected[1]);
      if (unitValue >= 1 && unitValue <= 6) units = unitValue;
    } else if (lastSelected) {
      const singleValue = parseNumber(lastSelected[1]);
      if (
        percentageGradeCandidateInText &&
        isUnitLikeValue(singleValue, lastSelected[1])
      ) {
        continue;
      }
      if (
        singleValue >= 1 &&
        singleValue <= 5 &&
        (!hasGradeColumn || hasUnitsColumn) &&
        !/\b(?:final\s+)?(?:grade|rating|mark)\s*[:=]/i.test(content)
      ) {
        ambiguousRows.push(line);
        unrecognizedRows.push(line);
        continue;
      }
      grade = singleValue;
      rawGrade = lastSelected[1];
    }

    const statusFlag = remarks ? parseFlag(remarks) : null;
    const explicitGradeLabel =
      /\b(?:final\s+)?(?:grade|rating|mark)\s*[:=]/i.test(content);
    const hasSubjectRowEvidence =
      Boolean(subjectCode) || units !== null || hasGradeColumn || explicitGradeLabel || statusFlag !== null;
    if (
      !hasSubjectRowEvidence &&
      !(grade !== null && grade >= 0 && grade <= 100)
    ) {
      continue;
    }

    const gradeScale = grade === null ? null : detectedScaleFromValue(grade);
    const hasConflictingRemark = grade !== null && (
      (remarks === "PASSED" && isPossibleFailingGrade(grade, gradeScale, rawGrade)) ||
      ((remarks === "FAILED" || remarks === "FAIL") &&
        gradeScale !== null &&
        !isPossibleFailingGrade(grade, gradeScale, rawGrade))
    );
    if (hasConflictingRemark) {
      conflictingRows.push(line);
    }

    pendingRows.push({
      line,
      subjectCode,
      subjectName,
      units,
      grade,
      rawGrade,
      flag: statusFlag,
      remarks,
    });
  }

  const collegiateDecimalGradeCount = pendingRows.filter(
    (row) =>
      row.grade !== null &&
      row.grade >= 1 &&
      row.grade <= 5 &&
      Boolean(row.rawGrade && /[.,]\d+/.test(row.rawGrade)),
  ).length;
  const hasCollegiateDecimalScale = collegiateDecimalGradeCount >= 2;
  const hasPercentageGradesInRows = !hasCollegiateDecimalScale && pendingRows.some(
    (row) => row.grade !== null && row.grade >= 50 && row.grade <= 100,
  );
  const hasPercentageGradeSignal =
    percentageGradeCandidateInText || hasPercentageGradesInRows;
  const gradeSignals = pendingRows.flatMap((row) => {
    if (
      row.grade === null ||
      (hasCollegiateDecimalScale && row.grade >= 50 && row.grade <= 100) ||
      (hasPercentageGradeSignal && isUnitLikeValue(row.grade, row.rawGrade))
    ) {
      return [];
    }
    const scale = gradeScaleForValue(row.grade);
    return scale ? [scale] : [];
  });
  const hasCollegiateGrades = gradeSignals.includes("collegiate");
  const hasPercentageGrades = gradeSignals.includes("percentage");
  const hasMixedGradeScales = hasCollegiateGrades && hasPercentageGrades;
  const explicitGwa = parseExplicitGwa(text);
  const scaleFromRows: DetectedGradingScale | null = hasMixedGradeScales
    ? null
    : hasPercentageGrades
      ? "PERCENTAGE_100"
      : hasCollegiateGrades
        ? "SCALE_1_TO_5"
        : null;
  const explicitScale = explicitGwa === null ? null : detectedScaleFromValue(explicitGwa);
  const detectedScale = hasCollegiateDecimalScale
    ? "SCALE_1_TO_5"
    : scaleFromRows ?? explicitScale;
  const gradingScale = hasMixedGradeScales
    ? "mixed"
    : detectedScale === "PERCENTAGE_100"
      ? "percentage"
      : detectedScale === "SCALE_1_TO_5"
        ? "collegiate"
        : null;

  const flaggedGrades: string[] = [];
  const numericRows: Array<{ grade: number; units: number | null }> = [];
  let hasPossibleFailingGrade = false;

  for (const row of pendingRows) {
    const subjectLabel = getSubjectLabel(row);
    const statusFlag = row.flag ?? (row.remarks ? parseFlag(row.remarks) : null);
    const numericGradeScale = row.grade === null ? null : detectedScaleFromValue(row.grade);
    const rowScale = detectedScale ?? (hasMixedGradeScales ? null : numericGradeScale);
    const ignoredPercentageUnit =
      detectedScale === "PERCENTAGE_100" &&
      row.grade !== null &&
      isUnitLikeValue(row.grade, row.rawGrade);
    const hasValidNumericGrade =
      row.grade !== null &&
      (rowScale === "PERCENTAGE_100"
        ? row.grade >= 50 && row.grade <= 100
        : rowScale === "SCALE_1_TO_5"
          ? row.grade >= 1 && row.grade <= 5
          : numericGradeScale !== null);
    const failingNumericGrade =
      hasValidNumericGrade &&
      row.grade !== null &&
      isPossibleFailingGrade(row.grade, rowScale, row.rawGrade);
    const possibleFailStatus = statusFlag !== null && FAILING_STATUS.test(statusFlag);

    if (statusFlag || failingNumericGrade) {
      const flag = statusFlag ?? "FAILED";
      rows.push({
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        units: row.units ?? 0,
        grade: null,
        flag,
      });
    } else if (hasValidNumericGrade && row.grade !== null) {
      rows.push({
        subjectCode: row.subjectCode,
        subjectName: row.subjectName,
        units: row.units ?? 0,
        grade: row.grade,
        flag: null,
      });
    } else if (!statusFlag && !ignoredPercentageUnit) {
      unrecognizedRows.push(row.line);
    }

    if (hasValidNumericGrade && row.grade !== null) {
      numericRows.push({ grade: row.grade, units: row.units });
    }

    if (failingNumericGrade || possibleFailStatus) {
      hasPossibleFailingGrade = true;
      const rawGradeOrStatus = failingNumericGrade
        ? row.rawGrade ?? String(row.grade)
        : row.remarks ?? statusFlag;
      flaggedGrades.push(`${subjectLabel}: ${rawGradeOrStatus}`);
    }
  }

  const hasParseWarnings =
    unrecognizedRows.length > 0 ||
    ambiguousRows.length > 0 ||
    conflictingRows.length > 0 ||
    hasMixedGradeScales;
  const canComputeFromRows =
    numericRows.length >= MINIMUM_COMPUTED_ROWS &&
    !hasParseWarnings &&
    detectedScale !== null;
  const allRowsHaveUnits =
    numericRows.length > 0 && numericRows.every((row) => row.units !== null && row.units > 0);
  const totalUnits = numericRows.reduce((sum, row) => sum + (row.units ?? 0), 0);
  const weightedGwa = canComputeFromRows && allRowsHaveUnits && totalUnits > 0
    ? numericRows.reduce((sum, row) => sum + row.grade * (row.units ?? 0), 0) / totalUnits
    : null;
  const simpleGwa = canComputeFromRows && !allRowsHaveUnits
    ? numericRows.reduce((sum, row) => sum + row.grade, 0) / numericRows.length
    : null;
  const gwaCandidate =
    explicitGwa !== null &&
    (detectedScale === "PERCENTAGE_100"
      ? explicitGwa >= 0 && explicitGwa <= 100
      : detectedScale === "SCALE_1_TO_5"
        ? explicitGwa >= 1 && explicitGwa <= 5
        : false)
      ? explicitGwa
      : weightedGwa ?? simpleGwa;
  const estimatedGwa = gwaCandidate === null ? null : Number(gwaCandidate.toFixed(2));
  const meetsGwaRequirement =
    estimatedGwa === null || detectedScale === null
      ? null
      : detectedScale === "PERCENTAGE_100"
        ? estimatedGwa >= 80
        : estimatedGwa <= 2.5;
  const gwaCheckStatus = meetsGwaRequirement === null
    ? "UNAVAILABLE"
    : meetsGwaRequirement
      ? "MEETS_REQUIREMENT"
      : "BELOW_REQUIREMENT";
  const gwaMessage = estimatedGwa === null
    ? "GWA could not be auto-calculated — SK Admin will verify."
    : meetsGwaRequirement
      ? "Estimated GWA meets the 80% maintenance requirement."
      : "Estimated GWA does not meet the 80% maintenance requirement.";

  return {
    rows,
    unrecognizedRows: Array.from(new Set(unrecognizedRows)),
    ambiguousRows,
    conflictingRows,
    gradingScale,
    detectedScale,
    estimatedGwa,
    gwaCheckStatus,
    meetsGwaRequirement,
    gwaMessage,
    hasPossibleFailingGrade,
    flaggedSubjects: Array.from(new Set(flaggedGrades)),
    flaggedGrades: Array.from(new Set(flaggedGrades)),
    possibleFailingGradeMessage: hasPossibleFailingGrade
      ? "Possible failing grade detected. An SK Admin will verify your official grade report."
      : null,
    requiresStrictManualReview:
      hasParseWarnings ||
      hasPossibleFailingGrade ||
      meetsGwaRequirement === false ||
      rows.some((row) => row.flag !== null) ||
      estimatedGwa === null,
    gwa: estimatedGwa,
    totalUnits,
  };
}

export function hasGradeReportStructuralSignals(text: string): boolean {
  const headerCount = GRADE_TABLE_HEADER_PATTERNS.filter((pattern) => pattern.test(text)).length;
  if (headerCount >= 2 || /\b[A-Z]{2,6}\s*\d{3}\b/i.test(text)) return true;

  if (!/\bPREREQUISITES\s*:/i.test(text)) return false;
  const parsed = parseGradeReportText(text);
  return parsed.rows.filter((row) => row.grade !== null && row.flag === null).length >= 2;
}
