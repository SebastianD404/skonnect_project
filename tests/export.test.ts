import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { exportToExcel } from "@/lib/utils/export";

describe("member Excel export", () => {
  it("writes age as text so spreadsheet apps left-align it", async () => {
    const file = await exportToExcel(
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

    const workbook = XLSX.read(file.body, { type: "array" });
    const worksheet = workbook.Sheets.members;

    expect(worksheet.D5.v).toBe("Age");
    expect(worksheet.D6.v).toBe("22");
    expect(worksheet.D6.t).toBe("s");
  });
});
