import ExcelJS from "exceljs";
import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { ensureProfile } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit/logger";
import {
  buildReportDataset,
  isReportKey,
  ReportDatasetError,
} from "@/lib/report-dataset";
import { styleReportTable, addReportHeading } from "@/lib/excel-report-style";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function getFilename(title: string, reportType: string, filters: Record<string, string>) {
  if (reportType === "skeap_financial" || reportType === "cash_disbursement_receipts" || reportType === "unclaimed_allowances") {
    const semester = filters.semester ?? "semester";
    const semesterSlug = semester.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "");
    const prefix = reportType === "cash_disbursement_receipts"
      ? "SKEAP-Disbursed-Payouts"
      : reportType === "unclaimed_allowances"
        ? "SKEAP-Unclaimed-Allowances"
        : "SKEAP-PAYROLL";
    return `${prefix}-${semesterSlug || "semester"}.xlsx`;
  }
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${slug}-${new Date().getFullYear()}.xlsx`;
}

function getFilters(searchParams: URLSearchParams) {
  const filters: Record<string, string> = {};
  searchParams.forEach((value, key) => {
    if (key !== "type" && key !== "format") filters[key] = value;
  });
  return filters;
}

async function buildPayrollWorkbook(dataset: Awaited<ReturnType<typeof buildReportDataset>>) {
  const workbook = new ExcelJS.Workbook();
  const templatePath = path.join(process.cwd(), "public", "SKEAP-PAYROLL-2026.xlsx");
  await workbook.xlsx.readFile(templatePath);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error("The payroll template has no worksheet.");

  let totalRowIndexBeforeInsert = 0;
  worksheet.eachRow((row) => {
    if (String(row.getCell(2).value ?? "").trim().toUpperCase() === "TOTAL" && totalRowIndexBeforeInsert === 0) {
      totalRowIndexBeforeInsert = row.number;
    }
  });
  if (totalRowIndexBeforeInsert === 0) throw new Error("The payroll template is missing its TOTAL row.");

  let headerRowIndex = 0;
  for (let rowIndex = 1; rowIndex < totalRowIndexBeforeInsert; rowIndex += 1) {
    const row = worksheet.getRow(rowIndex);
    if (
      String(row.getCell(1).value ?? "").trim().toUpperCase() === "NO." &&
      String(row.getCell(2).value ?? "").trim().toUpperCase() === "NAME"
    ) {
      headerRowIndex = rowIndex;
    }
  }
  if (headerRowIndex === 0) throw new Error("The payroll template is missing its scholar table header.");

  const startRow = headerRowIndex + 1;
  const availableRows = totalRowIndexBeforeInsert - startRow;
  if (availableRows < 1) throw new Error("The payroll template is missing its scholar data rows.");
  const additionalRows = Math.max(0, dataset.rows.length - availableRows);
  if (additionalRows) worksheet.duplicateRow(totalRowIndexBeforeInsert - 1, additionalRows, true);

  dataset.rows.forEach((reportRow, index) => {
    const rowIndex = startRow + index;
    worksheet.getCell(rowIndex, 1).value = reportRow.no;
    worksheet.getCell(rowIndex, 2).value = reportRow.name;
    worksheet.getCell(rowIndex, 3).value = reportRow.position;
    worksheet.getCell(rowIndex, 4).value = reportRow.incentiveA;
    worksheet.getCell(rowIndex, 7).value = reportRow.total;
    worksheet.getCell(rowIndex, 8).value = reportRow.netAmountDue;
  });

  const totalRowIndex = totalRowIndexBeforeInsert + additionalRows;
  worksheet.getCell(totalRowIndex, 7).value = dataset.grandTotalRow?.total ?? dataset.rows.length * 5000;
  worksheet.getCell(totalRowIndex, 8).value = dataset.grandTotalRow?.netAmountDue ?? dataset.rows.length * 5000;
  return workbook;
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = request.nextUrl;
  const reportKey = searchParams.get("type") ?? "";
  if (!isReportKey(reportKey)) {
    return NextResponse.json({ error: "Choose a valid report type." }, { status: 400 });
  }
  const filters = getFilters(searchParams);

  try {
    const dataset = await buildReportDataset(reportKey, filters);
    let workbook: ExcelJS.Workbook;
    if (
      reportKey === "skeap_financial" ||
      reportKey === "cash_disbursement_receipts" ||
      reportKey === "unclaimed_allowances"
    ) {
      workbook = await buildPayrollWorkbook(dataset);
    } else {
      workbook = new ExcelJS.Workbook();
      workbook.creator = "SKonnect";
      workbook.created = new Date();
      const worksheet = workbook.addWorksheet(dataset.title.slice(0, 31));
      worksheet.columns = dataset.columns.map((column) => ({
        header: column.header,
        key: column.key,
        width: column.width,
      }));
      for (const column of dataset.columns) {
        if (column.numFmt) worksheet.getColumn(column.key).numFmt = column.numFmt;
      }
      worksheet.addRows(dataset.rows);
      if (dataset.grandTotalRow) {
        worksheet.addRow(dataset.grandTotalRow);
      }
      addReportHeading(worksheet, dataset.title);
      if (dataset.note) {
        worksheet.getCell("A3").value = dataset.note;
        worksheet.getCell("A3").font = { italic: true, size: 9, color: { argb: "FF64748B" } };
        worksheet.getCell("A3").alignment = { wrapText: true, vertical: "middle" };
        worksheet.getRow(3).height = 28;
      }
      const filterLastRow = dataset.rows.length + 5;
      styleReportTable(worksheet, {
        headerRow: 5,
        lastDataRow: worksheet.rowCount,
        filterLastRow,
      });
    }

    logAuditEvent({
      actorId: admin.id,
      actorEmail: admin.email,
      action: "RECORDS_EXPORTED",
      resource: reportKey,
      metadata: { reportKey, recordCount: dataset.totalCount, filters },
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${getFilename(dataset.title, reportKey, filters)}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ReportDatasetError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    console.error("Failed to generate admin report workbook:", error);
    return NextResponse.json({ error: "Unable to generate this report." }, { status: 500 });
  }
}
