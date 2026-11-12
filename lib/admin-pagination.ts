export const ADMIN_TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_ADMIN_TABLE_PAGE_SIZE = 25;

export function normalizeAdminTablePageSize(value: number) {
  return ADMIN_TABLE_PAGE_SIZES.find((pageSize) => pageSize === value) ?? DEFAULT_ADMIN_TABLE_PAGE_SIZE;
}
