import { describe, expect, it } from "vitest";
import { isSkeapTestAccount } from "@/lib/skeap-test-access";

describe("SKEAP test account access", () => {
  it("allows the configured SKEAP test accounts, ignoring case and surrounding whitespace", () => {
    expect(isSkeapTestAccount("test@example.com")).toBe(true);
    expect(isSkeapTestAccount(" TEST@EXAMPLE.COM ")).toBe(true);
    expect(isSkeapTestAccount("test2@example.com")).toBe(true);
    expect(isSkeapTestAccount(" TEST2@EXAMPLE.COM ")).toBe(true);
    expect(isSkeapTestAccount("other@example.com")).toBe(false);
    expect(isSkeapTestAccount(null)).toBe(false);
    expect(isSkeapTestAccount(undefined)).toBe(false);
  });
});
