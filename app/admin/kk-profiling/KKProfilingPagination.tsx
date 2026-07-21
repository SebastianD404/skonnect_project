"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { startTransition, useTransition } from "react";

interface KKProfilingPaginationProps {
  pageNumber: number;
  totalPages: number;
  // Optional base path for the pagination links, e.g. '/admin/kk-profiling' or '/admin/members'
  basePath?: string;
}

export function KKProfilingPagination({ pageNumber, totalPages, basePath = "/admin/kk-profiling" }: KKProfilingPaginationProps) {
  const router = useRouter();
  const [isPending, startTransitionState] = useTransition();

  const pathname = usePathname();
  const searchParams = useSearchParams();

  const goToPage = (targetPage: number) => {
    if (targetPage < 1 || targetPage > totalPages || targetPage === pageNumber) {
      return;
    }

    startTransitionState(() => {
      // Preserve existing query params (e.g., status) and only set `page`
      const params = new URLSearchParams(String(searchParams ?? ""));
      params.set("page", String(targetPage));
      const url = `${basePath}${params.toString() ? `?${params.toString()}` : ""}`;
      // If basePath equals current pathname, keep it; otherwise use provided basePath
      router.push(url, { scroll: false });
    });
  };

  return (
    <div
      className={`mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between transition-all duration-200 ${
        isPending ? "opacity-70" : "opacity-100"
      }`}
      aria-busy={isPending}
    >
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <p>Showing page {pageNumber} of {totalPages}.</p>
        {isPending ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-slate-600" />
            Loading...
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => goToPage(pageNumber - 1)}
          disabled={pageNumber === 1 || isPending}
          className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
            pageNumber === 1 || isPending
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          {isPending && pageNumber > 1 ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
              Loading
            </span>
          ) : (
            "Previous"
          )}
        </button>
        <button
          type="button"
          onClick={() => goToPage(pageNumber + 1)}
          disabled={pageNumber === totalPages || isPending}
          className={`inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
            pageNumber === totalPages || isPending
              ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          }`}
        >
          {isPending && pageNumber < totalPages ? (
            <span className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-500 border-t-transparent" />
              Loading
            </span>
          ) : (
            "Next"
          )}
        </button>
      </div>
    </div>
  );
}
