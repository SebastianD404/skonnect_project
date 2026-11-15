export const ADMIN_TABLE_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_ADMIN_TABLE_PAGE_SIZE = 25;

export type AdminPaginationPageItem = number | "ellipsis";

export function normalizeAdminTablePageSize(value: number) {
  return ADMIN_TABLE_PAGE_SIZES.find((pageSize) => pageSize === value) ?? DEFAULT_ADMIN_TABLE_PAGE_SIZE;
}

export function getAdminPaginationPageItems(
  currentPage: number,
  totalPages: number,
): AdminPaginationPageItem[] {
  const lastPage = Number.isFinite(totalPages) ? Math.max(1, Math.floor(totalPages)) : 1;
  const page = Number.isFinite(currentPage)
    ? Math.min(lastPage, Math.max(1, Math.floor(currentPage)))
    : 1;

  if (lastPage <= 5) {
    return Array.from({ length: lastPage }, (_, index) => index + 1);
  }
  if (page <= 3) {
    return [1, 2, 3, "ellipsis", lastPage];
  }
  if (page >= lastPage - 2) {
    return [1, "ellipsis", lastPage - 2, lastPage - 1, lastPage];
  }
  return [1, "ellipsis", page, "ellipsis", lastPage];
}
