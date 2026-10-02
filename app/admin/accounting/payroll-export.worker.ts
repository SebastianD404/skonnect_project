import * as XLSX from "xlsx-js-style";
import PizZip from "pizzip";

type PayrollDisbursement = {
  name: string;
  status: "Pending Payout" | "Claimed";
};

type PayrollRequest = {
  currentSemester: string;
  payrollNumber: string;
  disbursements: PayrollDisbursement[];
};

type WorkerResponse = { buffer: ArrayBuffer } | { error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<PayrollRequest>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event) => {
  try {
    const { currentSemester, payrollNumber, disbursements } = event.data;
    const getBlackBorder = (): NonNullable<XLSX.CellStyle["border"]> => ({
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    });
    const getBlueBannerStyle = (): XLSX.CellStyle => ({
      fill: { fgColor: { rgb: "00A8E8" } },
      font: { name: "Arial", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: getBlackBorder(),
    });
    const getYellowBannerStyle = (): XLSX.CellStyle => ({
      fill: { fgColor: { rgb: "FFC000" } },
      font: { name: "Arial", sz: 11, bold: true, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: getBlackBorder(),
    });
    const getOrangeHeaderStyle = (): XLSX.CellStyle => ({
      fill: { fgColor: { rgb: "ED7D31" } },
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: getBlackBorder(),
    });
    const getDataCellStyle = (
      alignment: XLSX.CellStyle["alignment"] = { vertical: "center" },
    ): XLSX.CellStyle => ({
      font: { name: "Arial", sz: 10 },
      alignment: { ...alignment },
      border: getBlackBorder(),
    });
    const getMetadataStyle = (): XLSX.CellStyle => ({
      font: { name: "Arial", sz: 9, bold: true },
      alignment: { vertical: "center" },
      border: getBlackBorder(),
    });
    const textCell = (value: string, styleFactory: () => XLSX.CellStyle): XLSX.CellObject => ({
      v: value,
      t: "s",
      s: styleFactory(),
    });
    const createRowCells = (count: number, styleFactory: () => XLSX.CellStyle) =>
      Array.from({ length: count }, () => textCell("", styleFactory));
    const spacerCell = (): XLSX.CellObject => ({ v: "", t: "s" });

    const wsData: Array<Array<string | number | XLSX.CellObject>> = [
      [],
      [spacerCell(), textCell("PAYROLL", getBlueBannerStyle), ...createRowCells(6, getBlueBannerStyle)],
      [
        spacerCell(),
        textCell(`PERIOD COVERED: ${currentSemester || "For the semester"}`, getYellowBannerStyle),
        ...createRowCells(6, getYellowBannerStyle),
      ],
      [
        spacerCell(),
        textCell("Barangay: PICO LA TRINIDAD SK", getMetadataStyle),
        ...createRowCells(1, getMetadataStyle),
        textCell("City/Municipality: LA TRINIDAD", getMetadataStyle),
        ...createRowCells(1, getMetadataStyle),
        textCell(`Payroll No: ${payrollNumber}`, getMetadataStyle),
        ...createRowCells(2, getMetadataStyle),
      ],
      [
        spacerCell(),
        textCell("Tel. #: 422-0811", getMetadataStyle),
        ...createRowCells(1, getMetadataStyle),
        textCell("Province: BENGUET", getMetadataStyle),
        ...createRowCells(4, getMetadataStyle),
      ],
      [
        spacerCell(),
        textCell("No.", getOrangeHeaderStyle),
        textCell("Name", getOrangeHeaderStyle),
        textCell("Position", getOrangeHeaderStyle),
        textCell("Compensation", getOrangeHeaderStyle),
        textCell("", getOrangeHeaderStyle),
        textCell("Net Amount Due", getOrangeHeaderStyle),
        textCell("Signature of Recipient", getOrangeHeaderStyle),
      ],
      [
        spacerCell(),
        textCell("", getOrangeHeaderStyle),
        textCell("", getOrangeHeaderStyle),
        textCell("", getOrangeHeaderStyle),
        textCell("Incentives", getOrangeHeaderStyle),
        textCell("Total", getOrangeHeaderStyle),
        textCell("", getOrangeHeaderStyle),
        textCell("", getOrangeHeaderStyle),
      ],
    ];

    disbursements.forEach((item, index) => {
      wsData.push([
        spacerCell(),
        { v: index + 1, t: "n", s: getDataCellStyle({ horizontal: "center", vertical: "center" }) },
        { v: item.name || "Unnamed Scholar", t: "s", s: getDataCellStyle() },
        { v: "Scholar", t: "s", s: getDataCellStyle({ horizontal: "center", vertical: "center" }) },
        { v: 5000, t: "n", z: "₱#,##0.00", s: getDataCellStyle({ horizontal: "right", vertical: "center" }) },
        { v: 5000, t: "n", z: "₱#,##0.00", s: getDataCellStyle({ horizontal: "right", vertical: "center" }) },
        { v: 5000, t: "n", z: "₱#,##0.00", s: getDataCellStyle({ horizontal: "right", vertical: "center" }) },
        {
          v: item.status === "Claimed" ? "Claimed (Direct)" : "",
          t: "s",
          s: getDataCellStyle(),
        },
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    worksheet["!ref"] = `A1:H${wsData.length}`;
    worksheet["!cols"] = [
      { wch: 3 },
      { wch: 6 },
      { wch: 30 },
      { wch: 14 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 28 },
    ];
    worksheet["!rows"] = [
      { hpt: 12 },
      { hpt: 26 },
      { hpt: 22 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 28 },
      { hpt: 22 },
    ];
    worksheet["!merges"] = [
      { s: { r: 1, c: 1 }, e: { r: 1, c: 7 } },
      { s: { r: 2, c: 1 }, e: { r: 2, c: 7 } },
      { s: { r: 3, c: 1 }, e: { r: 3, c: 2 } },
      { s: { r: 3, c: 3 }, e: { r: 3, c: 4 } },
      { s: { r: 3, c: 5 }, e: { r: 3, c: 7 } },
      { s: { r: 4, c: 1 }, e: { r: 4, c: 2 } },
      { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } },
      { s: { r: 5, c: 1 }, e: { r: 6, c: 1 } },
      { s: { r: 5, c: 2 }, e: { r: 6, c: 2 } },
      { s: { r: 5, c: 3 }, e: { r: 6, c: 3 } },
      { s: { r: 5, c: 4 }, e: { r: 5, c: 5 } },
      { s: { r: 5, c: 6 }, e: { r: 6, c: 6 } },
      { s: { r: 5, c: 7 }, e: { r: 6, c: 7 } },
    ];
    worksheet["!margins"] = { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 };
    worksheet["!views"] = [{ showGridLines: false }];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Official Payroll");
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
    const zip = new PizZip(new Uint8Array(output));
    const worksheetFile = zip.file("xl/worksheets/sheet1.xml");
    if (!worksheetFile) throw new Error("Unable to configure payroll worksheet view.");
    const worksheetXml = worksheetFile.asText();
    const sheetViewPattern = /(<sheetView\b[^>]*?)(\/?>)/;
    if (!sheetViewPattern.test(worksheetXml)) {
      throw new Error("Unable to configure payroll worksheet view.");
    }
    zip.file(
      "xl/worksheets/sheet1.xml",
      worksheetXml.replace(sheetViewPattern, (_match, attributes: string, closing: string) => {
        const viewAttributes = attributes.replace(/\s+showGridLines="[^"]*"/, "");
        return `${viewAttributes} showGridLines="0"${closing}`;
      }),
    );
    const outputWithHiddenGridlines = zip.generate({ type: "uint8array", compression: "DEFLATE" });
    const buffer = outputWithHiddenGridlines.buffer.slice(
      outputWithHiddenGridlines.byteOffset,
      outputWithHiddenGridlines.byteOffset + outputWithHiddenGridlines.byteLength,
    ) as ArrayBuffer;

    workerScope.postMessage({ buffer }, [buffer]);
  } catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : "Unable to generate the payroll workbook.",
    });
  }
};