import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { addReportHeading, styleReportTable } from "../lib/excel-report-style";
import { exportToExcel } from "../lib/utils/export";

describe("Excel report styling", () => {
  it("adds a branded heading and applies the shared table style", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Test Report");
    worksheet.columns = [
      { header: "Sitio Name", key: "sitio", width: 24 },
      { header: "Total Youth", key: "total", width: 16 },
    ];
    worksheet.addRows([
      { sitio: "Balangabang", total: 125 },
      { sitio: "Bayabas", total: 127 },
    ]);

    addReportHeading(worksheet, "Demographic Distribution");
    styleReportTable(worksheet, { headerRow: 5 });

    expect(worksheet.getCell("A1").value).toBe("Demographic Distribution");
    expect(worksheet.getCell("A5").value).toBe("Sitio Name");
    expect(worksheet.getCell("A5").fill).toMatchObject({
      fgColor: { argb: "FF0F3D5C" },
    });
    expect(worksheet.getCell("A6").fill).toMatchObject({
      fgColor: { argb: "FFDCE6F1" },
    });
    expect(worksheet.getCell("B6").alignment.horizontal).toBe("center");
    expect(worksheet.views[0]).toMatchObject({ state: "frozen", ySplit: 5 });
    expect(worksheet.autoFilter).toMatchObject({
      from: { row: 5, column: 1 },
      to: { row: 7, column: 2 },
    });
    await expect(workbook.xlsx.writeBuffer()).resolves.toBeTruthy();
  });

  it("uses the same style for the active scholar workbook export", async () => {
    const file = await exportToExcel(
      [{ fullName: "Youth Example", email: "youth@example.com", status: "Active" }],
      "active-scholars",
      "grantees",
    );
    const workbook = XLSX.read(file.body, { type: "array" });
    const worksheet = workbook.Sheets.grantees;

    expect(worksheet.A1.v).toBe("Active Scholars Masterlist");
    expect(worksheet.A5.v).toBe("Name");
  });
});
