import * as XLSX from "xlsx";

type ExportUser = {
  fullName: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt: string;
};

type WorkerResponse = { buffer: ArrayBuffer } | { error: string };

const workerScope = self as unknown as {
  onmessage: ((event: MessageEvent<ExportUser[]>) => void) | null;
  postMessage: (message: WorkerResponse, transfer?: Transferable[]) => void;
};

workerScope.onmessage = (event) => {
  try {
    const exportData = event.data.map((user) => ({
      "Full Name": user.fullName || "Unnamed User",
      "Email Address": user.email,
      "System Role": user.role,
      "Account Status": user.isActive ? "Active" : "Inactive",
      "Date Joined": new Date(user.createdAt).toLocaleDateString(),
    }));
    const headers = ["Full Name", "Email Address", "System Role", "Account Status", "Date Joined"];
    const worksheet = XLSX.utils.json_to_sheet(exportData);

    if (exportData.length === 0) {
      XLSX.utils.sheet_add_aoa(worksheet, [headers], { origin: "A1" });
    }

    worksheet["!cols"] = headers.map((header) => {
      const maxLength = Math.max(
        header.length,
        ...exportData.map((row) => String(row[header as keyof typeof row] || "").length)
      );
      return { wch: maxLength + 8 };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "System Users");
    const output = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const buffer =
      output instanceof ArrayBuffer
        ? output
        : output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;

    workerScope.postMessage({ buffer }, [buffer]);
  } catch (error) {
    workerScope.postMessage({
      error: error instanceof Error ? error.message : "Unable to generate the Excel workbook.",
    });
  }
};