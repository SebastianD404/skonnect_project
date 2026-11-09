"use client";

import { useRouter, useSearchParams } from "next/navigation";

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
    <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
      <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-4">
        <span className="shrink-0 text-xs font-medium text-slate-500">
          {totalCount === 0 ? (
            <span>No records found</span>
          ) : (
            <span className="font-bold text-slate-700">
              {totalCount} result{totalCount === 1 ? "" : "s"}
            </span>
          )}
        </span>
        <label className="flex shrink-0 items-center gap-2 sm:border-l sm:border-slate-200 sm:pl-4">
          <span className="text-[11px] font-medium text-slate-500 sm:text-slate-400">Rows</span>
          <select
            aria-label="Rows per page"
            value={pageSize}
            onChange={(event) => navigate(1, Number(event.target.value))}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-cyan-600"
          >
            <option value={10}>10 rows</option>
            <option value={20}>20 rows</option>
            <option value={50}>50 rows</option>
          </select>
        </label>
      </div>

      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:w-auto">
        <button
          type="button"
          disabled={page <= 1 || totalCount === 0}
          onClick={() => navigate(page - 1)}
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8"
        >
          Previous
        </button>
        <span className="whitespace-nowrap px-1 text-center text-xs font-medium text-slate-500">
          Page <span className="font-bold text-slate-700">{page}</span> of{" "}
          <span className="font-bold text-slate-700">{totalPages}</span>
        </span>
        <button
          type="button"
          disabled={page >= totalPages || totalCount === 0}
          onClick={() => navigate(page + 1)}
          className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8"
        >
          Next
        </button>
      </div>
    </div>
  );
}
