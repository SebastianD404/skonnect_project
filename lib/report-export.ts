import { NextResponse } from "next/server";

export type ReportFormat = "xlsx" | "csv";

export function parseReportFormat(value: string | null): ReportFormat | null {
  if (value === null || value === "xlsx") return "xlsx";
  if (value === "csv") return "csv";
  return null;
}

export function parseReportDateRange(params: URLSearchParams) {
  const startValue = params.get("startDate");
  const endValue = params.get("endDate");
  const parseDate = (value: string | null) => {
    if (!value) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime())) return undefined;
    return date.toISOString().slice(0, 10) === value ? date : undefined;
  };
  const startDate = parseDate(startValue);
  const endDate = parseDate(endValue);

  if (startDate === undefined || endDate === undefined) {
    return { startDate: null, endDateExclusive: null, error: "Dates must use the YYYY-MM-DD format." };
  }
  if (startDate && endDate && startDate > endDate) {
    return { startDate: null, endDateExclusive: null, error: "Start Date cannot be after End Date." };
  }

  const endDateExclusive = endDate ? new Date(endDate.getTime() + 24 * 60 * 60 * 1000) : null;
  return { startDate, endDateExclusive, error: null };
}

export function createCsvResponse<T extends object>(
  rows: readonly T[],
  columns: readonly { header: string; key: string }[],
  filename: string,
) {
  const stringify = (value: unknown) => {
    if (value === null || value === undefined) return "";
    if (value instanceof Date) return value.toISOString();

    let text = String(value);
    if (typeof value === "string" && /^[=+\-@]/.test(text)) text = `'${text}`;
    return text;
  };
  const escape = (value: unknown) => `"${stringify(value).replace(/"/g, '""')}"`;
  const headers = columns.map(({ header }) => escape(header)).join(",");
  const data = rows.map((row) => {
    const record = row as Record<string, unknown>;
    return columns.map(({ key }) => escape(record[key])).join(",");
  });
  const csv = `\uFEFF${[headers, ...data].join("\r\n")}`;
  const baseFilename = filename.replace(/\.(?:xlsx|csv)$/i, "");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${baseFilename}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
