import type { GradeReportRow } from "@/lib/grade-report-parser";

const GRADE_FLAGS = new Set(["INC", "DRP", "W", "NG", "FAILED"]);

export type CorrectedGradeReportRow = GradeReportRow;

export function validateCorrectedGradeReportRows(value: unknown): CorrectedGradeReportRow[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new Error("Provide between 1 and 100 grade report rows.");
  }

  const rows = value.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Grade report row ${index + 1} is invalid.`);
    }
    const row = item as Record<string, unknown>;
    const subjectName = typeof row.subjectName === "string" ? row.subjectName.trim() : "";
    const subjectCode =
      typeof row.subjectCode === "string" && row.subjectCode.trim()
        ? row.subjectCode.trim()
        : null;
    const units = Number(row.units);
    const grade = row.grade === null || row.grade === "" ? null : Number(row.grade);
    const flag =
      typeof row.flag === "string" && GRADE_FLAGS.has(row.flag.toUpperCase())
        ? (row.flag.toUpperCase() as GradeReportRow["flag"])
        : null;

    if (!subjectName || subjectName.length > 200 || !Number.isFinite(units) || units <= 0 || units > 100) {
      throw new Error(`Grade report row ${index + 1} needs a subject name and valid units.`);
    }
    if (
      row.flag !== null &&
      row.flag !== undefined &&
      row.flag !== "" &&
      !flag
    ) {
      throw new Error(`Grade report row ${index + 1} has an unsupported grade flag.`);
    }
    if (grade !== null && (!Number.isFinite(grade) || grade < 1 || grade >= 5 || flag !== null)) {
      throw new Error(`Grade report row ${index + 1} must have a numeric grade from 1.0 to below 5.0 or a supported flag.`);
    }
    if (grade === null && flag === null) {
      throw new Error(`Grade report row ${index + 1} needs a grade or supported flag.`);
    }
    return { subjectCode, subjectName, units, grade, flag };
  });

  if (!rows.some((row) => row.grade !== null)) {
    throw new Error("At least one numeric grade is required to compute GWA.");
  }
  return rows;
}

export function computeGradeReportGwa(rows: CorrectedGradeReportRow[]) {
  const gradedRows = rows.filter(
    (row): row is CorrectedGradeReportRow & { grade: number } => row.grade !== null
  );
  const totalUnits = gradedRows.reduce((total, row) => total + row.units, 0);
  const weightedTotal = gradedRows.reduce((total, row) => total + row.grade * row.units, 0);

  return {
    gwa: Number((weightedTotal / totalUnits).toFixed(2)),
    totalUnits,
  };
}
