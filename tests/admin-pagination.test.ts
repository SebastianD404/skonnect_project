import { describe, expect, it } from "vitest";
import {
  ADMIN_TABLE_PAGE_SIZES,
  DEFAULT_ADMIN_TABLE_PAGE_SIZE,
  getAdminPaginationPageItems,
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

  it("builds a compact middle-page window with the first and last pages", () => {
    expect(getAdminPaginationPageItems(20, 40)).toEqual([
      1,
      "ellipsis",
      20,
      "ellipsis",
      40,
    ]);
  });

  it("uses at most five page items and prioritizes nearby pages near either end", () => {
    expect(getAdminPaginationPageItems(2, 40)).toEqual([1, 2, 3, "ellipsis", 40]);
    expect(getAdminPaginationPageItems(39, 40)).toEqual([1, "ellipsis", 38, 39, 40]);
    expect(getAdminPaginationPageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("clamps invalid page values and handles a zero-page dataset", () => {
    expect(getAdminPaginationPageItems(0, 0)).toEqual([1]);
    expect(getAdminPaginationPageItems(50, 4)).toEqual([1, 2, 3, 4]);
  });
});
