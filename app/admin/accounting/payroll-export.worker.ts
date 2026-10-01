import * as XLSX from "xlsx-js-style";

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
    const blackBorder = {
      top: { style: "thin", color: { rgb: "000000" } },
      bottom: { style: "thin", color: { rgb: "000000" } },
      left: { style: "thin", color: { rgb: "000000" } },
      right: { style: "thin", color: { rgb: "000000" } },
    };
    const blueBannerStyle = {
      fill: { fgColor: { rgb: "00A8E8" } },
      font: { name: "Arial", sz: 14, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: blackBorder,
    };
    const yellowBannerStyle = {
      fill: { fgColor: { rgb: "FFC000" } },
      font: { name: "Arial", sz: 11, bold: true, color: { rgb: "000000" } },
      alignment: { horizontal: "center", vertical: "center" },
      border: blackBorder,
    };
    const orangeHeaderStyle = {
      fill: { fgColor: { rgb: "ED7D31" } },
      font: { name: "Arial", sz: 10, bold: true, color: { rgb: "FFFFFF" } },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: blackBorder,
    };
    const cellStyle = {
      font: { name: "Arial", sz: 10 },
      alignment: { vertical: "center" },
      border: blackBorder,
    };
    const metadataStyle = {
      font: { name: "Arial", sz: 9, bold: true },
      alignment: { vertical: "center" },
      border: blackBorder,
    };
    const textCell = (value: string, style: XLSX.CellObject["s"]): XLSX.CellObject => ({
      v: value,
      t: "s",
      s: style,
    });
    const createRowCells = (count: number, style: XLSX.CellObject["s"]) =>
      Array.from({ length: count }, () => textCell("", style));

    const wsData: Array<Array<string | number | XLSX.CellObject>> = [
      [textCell("PAYROLL", blueBannerStyle), ...createRowCells(6, blueBannerStyle)],
      [
        textCell(`PERIOD COVERED: ${currentSemester || "For the semester"}`, yellowBannerStyle),
        ...createRowCells(6, yellowBannerStyle),
      ],
      [
        textCell("Barangay: PICO LA TRINIDAD SK", metadataStyle),
        ...createRowCells(1, metadataStyle),
        textCell("City/Municipality: LA TRINIDAD", metadataStyle),
        ...createRowCells(1, metadataStyle),
        textCell(`Payroll No: ${payrollNumber}`, metadataStyle),
        ...createRowCells(2, metadataStyle),
      ],
      [
        textCell("Tel. #: 422-0811", metadataStyle),
        ...createRowCells(1, metadataStyle),
        textCell("Province: BENGUET", metadataStyle),
        ...createRowCells(4, metadataStyle),
      ],
      [
        textCell("No.", orangeHeaderStyle),
        textCell("Name", orangeHeaderStyle),
        textCell("Position", orangeHeaderStyle),
        textCell("Compensation", orangeHeaderStyle),
        textCell("", orangeHeaderStyle),
        textCell("Net Amount Due", orangeHeaderStyle),
        textCell("Signature of Recipient", orangeHeaderStyle),
      ],
      [
        textCell("", orangeHeaderStyle),
        textCell("", orangeHeaderStyle),
        textCell("", orangeHeaderStyle),
        textCell("Incentives", orangeHeaderStyle),
        textCell("Total", orangeHeaderStyle),
        textCell("", orangeHeaderStyle),
        textCell("", orangeHeaderStyle),
      ],
    ];

    disbursements.forEach((item, index) => {
      const amountStyle = {
        ...cellStyle,
        alignment: { horizontal: "right", vertical: "center" },
      };
      wsData.push([
        { v: index + 1, t: "n", s: { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } } },
        { v: item.name || "Unnamed Scholar", t: "s", s: cellStyle },
        { v: "Scholar", t: "s", s: { ...cellStyle, alignment: { horizontal: "center", vertical: "center" } } },
        { v: 5000, t: "n", z: "₱#,##0.00", s: amountStyle },
        { v: 5000, t: "n", z: "₱#,##0.00", s: amountStyle },
        { v: 5000, t: "n", z: "₱#,##0.00", s: amountStyle },
        {
          v: item.status === "Claimed" ? "Claimed (Direct)" : "",
          t: "s",
          s: cellStyle,
        },
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(wsData);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 30 },
      { wch: 14 },
      { wch: 15 },
      { wch: 15 },
      { wch: 18 },
      { wch: 28 },
    ];
    worksheet["!rows"] = [
      { hpt: 26 },
      { hpt: 22 },
      { hpt: 20 },
      { hpt: 20 },
      { hpt: 28 },
      { hpt: 22 },
    ];
    worksheet["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
      { s: { r: 2, c: 0 }, e: { r: 2, c: 1 } },
      { s: { r: 2, c: 2 }, e: { r: 2, c: 3 } },
      { s: { r: 2, c: 4 }, e: { r: 2, c: 6 } },
      { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
      { s: { r: 3, c: 2 }, e: { r: 3, c: 3 } },
      { s: { r: 4, c: 0 }, e: { r: 5, c: 0 } },
      { s: { r: 4, c: 1 }, e: { r: 5, c: 1 } },
      { s: { r: 4, c: 2 }, e: { r: 5, c: 2 } },
      { s: { r: 4, c: 3 }, e: { r: 4, c: 4 } },
      { s: { r: 4, c: 5 }, e: { r: 5, c: 5 } },
      { s: { r: 4, c: 6 }, e: { r: 5, c: 6 } },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Official Payroll");
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "array", cellStyles: true });
    const buffer =
      output instanceof ArrayBuffer
        ? output
        : output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;

    workerScope.postMessage({ buffer }, [buffer]);
  } catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : "Unable to generate the payroll workbook.",
    });
  }
};