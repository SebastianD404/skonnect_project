"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ADMIN_TABLE_PAGE_SIZES } from "@/lib/admin-pagination";
import AdminPaginationControls from "./AdminPaginationControls";

interface AdminTablePaginationFooterProps {
  totalCount: number;
  page: number;
  pageSize: number;
  basePath: string;
  startNavigation?: (callback: () => void) => void;
}

export default function AdminTablePaginationFooter({
  totalCount,
  page,
  pageSize,
  basePath,
  startNavigation,
}: AdminTablePaginationFooterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstResult = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, totalCount);

  const navigate = (nextPage: number, nextPageSize = pageSize) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    params.delete("focus");
    const href = `${basePath}?${params.toString()}`;
    const navigate = () => router.push(href, { scroll: false });
    if (startNavigation) startNavigation(navigate);
    else navigate();
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-4">
        <p className="inline-flex h-8 items-center gap-1.5 text-xs text-slate-500 tabular-nums">
          {totalCount === 0
            ? <span>No records found</span>
            : <>
                <span>Showing</span>
                <span className="font-semibold text-slate-900">{firstResult}–{lastResult}</span>
                <span>of</span>
                <span className="font-semibold text-slate-900">{totalCount.toLocaleString()}</span>
              </>}
        </p>
        <label className="inline-flex h-8 items-center gap-2 border-l border-slate-200 pl-4">
          <span className="text-xs font-medium text-slate-500">Rows per page</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) => navigate(1, Number(event.target.value))}
            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-400"
          >
            {ADMIN_TABLE_PAGE_SIZES.map((size) => (
              <option key={size} value={size}>{size} rows</option>
            ))}
          </select>
        </label>
      </div>

      <AdminPaginationControls
        page={page}
        totalPages={totalPages}
        onPageChange={(nextPage) => navigate(nextPage)}
        disabled={totalCount === 0}
      />
    </div>
  );
}
