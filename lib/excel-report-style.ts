import type { Cell, Worksheet } from "exceljs";

const NAVY = "FF0F3D5C";
const BORDER = "FFCBD5E1";
const STRIPE = "FFDCE6F1";
const TOTAL_FILL = "FFF1F5F9";

type ReportTableStyleOptions = {
  headerRow: number;
  lastDataRow?: number;
  filterLastRow?: number;
};

function setBorder(cell: Cell) {
  cell.border = {
    top: { style: "thin", color: { argb: BORDER } },
    left: { style: "thin", color: { argb: BORDER } },
    bottom: { style: "thin", color: { argb: BORDER } },
    right: { style: "thin", color: { argb: BORDER } },
  };
}

export function addReportHeading(worksheet: Worksheet, title: string) {
  const columnCount = Math.max(worksheet.columnCount, worksheet.columns.length);
  if (columnCount === 0) return;

  const endColumn = worksheet.getColumn(columnCount).letter;
  worksheet.spliceRows(
    1,
    0,
    [title],
    [`Generated ${new Date().toLocaleDateString("en-PH")}`],
    [""],
    [""],
  );
  worksheet.mergeCells(`A1:${endColumn}1`);
  worksheet.mergeCells(`A2:${endColumn}2`);
  worksheet.mergeCells(`A3:${endColumn}3`);

  const titleCell = worksheet.getCell("A1");
  titleCell.font = { bold: true, size: 15, color: { argb: NAVY } };
  titleCell.alignment = { vertical: "middle" };
  worksheet.getRow(1).height = 28;

  const generatedCell = worksheet.getCell("A2");
  generatedCell.font = { size: 10, color: { argb: "FF64748B" } };
  generatedCell.alignment = { vertical: "middle" };
  worksheet.getRow(2).height = 20;
  worksheet.getRow(3).height = 8;
  worksheet.getRow(4).height = 8;
}

export function styleReportTable(
  worksheet: Worksheet,
  { headerRow, lastDataRow = worksheet.rowCount, filterLastRow = lastDataRow }: ReportTableStyleOptions,
) {
  const columnCount = Math.max(worksheet.columnCount, worksheet.columns.length);
  if (columnCount === 0) return;

  const header = worksheet.getRow(headerRow);
  header.height = 30;
  for (let column = 1; column <= columnCount; column += 1) {
    const cell = header.getCell(column);
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    setBorder(cell);
  }

  for (let rowNumber = headerRow + 1; rowNumber <= lastDataRow; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const firstValue = String(row.getCell(1).value ?? "").trim().toLowerCase();
    const isTotalRow = firstValue === "grand total" || firstValue === "total";
    row.height = row.height ?? 22;

    for (let column = 1; column <= columnCount; column += 1) {
      const cell = row.getCell(column);
      setBorder(cell);
      cell.alignment = {
        horizontal: typeof cell.value === "number" || cell.value instanceof Date ? "center" : "left",
        vertical: "middle",
        wrapText: true,
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: isTotalRow ? TOTAL_FILL : rowNumber % 2 === 0 ? STRIPE : "FFFFFFFF" },
      };
      if (isTotalRow) cell.font = { bold: true, color: { argb: "FF0F172A" } };
    }
  }

  worksheet.views = [{ state: "frozen", ySplit: headerRow }];
  worksheet.autoFilter = {
    from: { row: headerRow, column: 1 },
    to: { row: Math.max(headerRow, filterLastRow), column: columnCount },
  };
}
