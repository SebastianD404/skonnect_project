import { toPng } from "html-to-image";
import * as XLSX from "xlsx-js-style";

type ExportCell = string | number;

export async function exportAnalyticsCardAsPng(
  element: HTMLElement | null,
  fileName: string,
) {
  if (!element) {
    throw new Error("The analytics card is not ready to export.");
  }

  const image = await toPng(element, {
    backgroundColor: "#ffffff",
    cacheBust: true,
    pixelRatio: 3,
    filter: (node) =>
      !(node instanceof Element && node.getAttribute("data-export-ignore") === "true"),
  });
  const anchor = document.createElement("a");
  anchor.href = image;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function exportAnalyticsTable({
  fileName,
  sheetName,
  title,
  headers,
  rows,
}: {
  fileName: string;
  sheetName: string;
  title: string;
  headers: string[];
  rows: ExportCell[][];
}) {
  if (headers.length === 0 || rows.some((row) => row.length !== headers.length)) {
    throw new Error("The analytics table data is invalid.");
  }

  const worksheet = XLSX.utils.aoa_to_sheet([
    [title],
    [`Generated on: ${new Date().toLocaleString("en-PH")}`],
    [],
    headers,
    ...rows,
  ]);
  worksheet["!cols"] = headers.map((header) => ({ wch: Math.max(18, header.length + 4) }));
  worksheet["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: headers.length - 1 } },
  ];

  const titleCell = worksheet["A1"];
  const timestampCell = worksheet["A2"];
  if (!titleCell || !timestampCell) {
    throw new Error("Unable to create the analytics report layout.");
  }

  titleCell.s = { font: { bold: true, sz: 14 } };
  timestampCell.s = { font: { sz: 11, italic: true } };

  const gridBorder = {
    top: { style: "thin" as const, color: { rgb: "D3D3D3" } },
    left: { style: "thin" as const, color: { rgb: "D3D3D3" } },
    bottom: { style: "thin" as const, color: { rgb: "D3D3D3" } },
    right: { style: "thin" as const, color: { rgb: "D3D3D3" } },
  };
  const headerStyle = {
    fill: { patternType: "solid" as const, fgColor: { rgb: "1F2937" } },
    font: { bold: true, color: { rgb: "FFFFFF" } },
    alignment: { horizontal: "center" as const, vertical: "center" as const },
    border: gridBorder,
  };

  headers.forEach((_, column) => {
    const headerCell = worksheet[XLSX.utils.encode_cell({ r: 3, c: column })];
    if (!headerCell) {
      throw new Error(`Unable to create analytics table header ${column + 1}.`);
    }
    headerCell.s = headerStyle;
  });

  const lastDataRow = 4 + rows.length;
  for (let rowNumber = 4; rowNumber <= lastDataRow; rowNumber += 1) {
    headers.forEach((_, column) => {
      const cell = worksheet[XLSX.utils.encode_cell({ r: rowNumber - 1, c: column })];
      if (!cell) {
        throw new Error(`Unable to create analytics table row ${rowNumber}.`);
      }
      cell.s = {
        ...cell.s,
        ...(rowNumber > 4 && column > 0
          ? { alignment: { horizontal: "center" as const, vertical: "center" as const } }
          : {}),
        border: gridBorder,
      };
    });
  }

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, fileName, { cellStyles: true });
}
