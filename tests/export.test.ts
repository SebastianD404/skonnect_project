import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { exportToExcel } from "@/lib/utils/export";

describe("member Excel export", () => {
  it("writes age as text so spreadsheet apps left-align it", () => {
    const file = exportToExcel(
      [
        {
          fullName: "Jordan Member",
          email: "jordan@example.com",
          age: 22,
          youthAgeGroup: "18-24",
        },
      ],
      "members",
      "members"
    );

    const workbook = XLSX.read(file.body);
    const worksheet = workbook.Sheets.members;

    expect(worksheet.D1.v).toBe("Age");
    expect(worksheet.D2.v).toBe("22");
    expect(worksheet.D2.t).toBe("s");
  });
});
