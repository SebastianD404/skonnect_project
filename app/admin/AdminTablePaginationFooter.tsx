"use client";

import { useRouter, useSearchParams } from "next/navigation";

interface AdminTablePaginationFooterProps {
  totalCount: number;
  page: number;
  pageSize: number;
  basePath: string;
}

export default function AdminTablePaginationFooter({
  totalCount,
  page,
  pageSize,
  basePath,
}: AdminTablePaginationFooterProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const navigate = (nextPage: number, nextPageSize = pageSize) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    router.push(`${basePath}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row">
      <div className="flex flex-wrap items-center gap-4">
        <span className="text-xs font-medium text-slate-500">
          {totalCount === 0 ? (
            <span>No records found</span>
          ) : (
            <span className="font-bold text-slate-700">
              {totalCount} result{totalCount === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <label className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
          <span className="text-[11px] font-medium text-slate-400">Show</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) => navigate(1, Number(event.target.value))}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-cyan-600"
          >
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
          </select>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page <= 1 || totalCount === 0}
          onClick={() => navigate(page - 1)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>
        <span className="px-1 text-xs font-medium text-slate-500">
          Page <span className="font-bold text-slate-700">{page}</span> of{" "}
          <span className="font-bold text-slate-700">{totalPages}</span>
        </span>
        <button
          type="button"
          disabled={page >= totalPages || totalCount === 0}
          onClick={() => navigate(page + 1)}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
