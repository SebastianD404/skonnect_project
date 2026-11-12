import { describe, expect, it } from "vitest";
import {
  ADMIN_TABLE_PAGE_SIZES,
  DEFAULT_ADMIN_TABLE_PAGE_SIZE,
  normalizeAdminTablePageSize,
} from "@/lib/admin-pagination";

describe("admin table pagination", () => {
  it("uses 25 rows by default for missing or unsupported page sizes", () => {
    expect(normalizeAdminTablePageSize(Number.NaN)).toBe(DEFAULT_ADMIN_TABLE_PAGE_SIZE);
    expect(normalizeAdminTablePageSize(20)).toBe(DEFAULT_ADMIN_TABLE_PAGE_SIZE);
  });

  it("accepts the shared page size options", () => {
    expect(ADMIN_TABLE_PAGE_SIZES).toEqual([10, 25, 50, 100]);
    for (const pageSize of ADMIN_TABLE_PAGE_SIZES) {
      expect(normalizeAdminTablePageSize(pageSize)).toBe(pageSize);
    }
  });
});
