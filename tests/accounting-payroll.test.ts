import { describe, expect, it } from "vitest";
import { formatPayrollGranteeName } from "@/lib/accounting-payroll";

describe("payroll grantee names", () => {
  it("formats directly from KK Profiling's last, first, and middle name fields", () => {
    expect(formatPayrollGranteeName({
      lastName: "Damugo",
      firstName: "Sebastian",
      middleName: "Langawan",
    }, "Other Name")).toBe(
      "DAMUGO, SEBASTIAN L."
    );
  });

  it("omits the middle initial when KK Profiling has no middle name", () => {
    expect(formatPayrollGranteeName({
      lastName: "Acosta",
      firstName: "Aldrin",
      middleName: null,
    }, "Other Name")).toBe(
      "ACOSTA, ALDRIN"
    );
  });

  it("uses the user name when the KK Profiling name is unavailable or incomplete", () => {
    expect(formatPayrollGranteeName(null, "Aldrin Maxuin Acosta")).toBe("ALDRIN MAXUIN ACOSTA");
  });
});
