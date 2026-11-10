import { describe, expect, it } from "vitest";
import { formatDisplayName } from "@/lib/display-name";

describe("display name formatting", () => {
  it("uses KK name parts in family-first order and uppercase display", () => {
    expect(formatDisplayName({
      lastName: "Damugo",
      firstName: "Sebastian",
      middleName: "Langawan",
    }, "Saved Full Name")).toBe("DAMUGO, SEBASTIAN, LANGAWAN");
  });

  it("uppercases and normalizes a fallback full name", () => {
    expect(formatDisplayName(null, "  alDriN   Maxuin acosta ")).toBe("ALDRIN MAXUIN ACOSTA");
  });
});
