import { describe, expect, it } from "vitest";
import { isSkeapTestAccount } from "@/lib/skeap-test-access";

describe("SKEAP test account access", () => {
  it("allows only test@example.com, ignoring case and surrounding whitespace", () => {
    expect(isSkeapTestAccount("test@example.com")).toBe(true);
    expect(isSkeapTestAccount(" TEST@EXAMPLE.COM ")).toBe(true);
    expect(isSkeapTestAccount("other@example.com")).toBe(false);
    expect(isSkeapTestAccount(null)).toBe(false);
    expect(isSkeapTestAccount(undefined)).toBe(false);
  });
});
