"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { getAdminPaginationPageItems } from "@/lib/admin-pagination";

interface AdminPaginationControlsProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
}

const navigationButtonClassName =
  "inline-flex h-7 min-w-7 items-center justify-center rounded-lg px-2 text-xs font-medium tabular-nums text-slate-600 transition-all duration-150 hover:bg-white hover:text-slate-900 hover:shadow-xs hover:ring-1 hover:ring-slate-200/80 active:scale-95 disabled:pointer-events-none disabled:opacity-35";

export default function AdminPaginationControls({
  page,
  totalPages,
  onPageChange,
  disabled = false,
}: AdminPaginationControlsProps) {
  const lastPage = Number.isFinite(totalPages) ? Math.max(1, Math.floor(totalPages)) : 1;
  const currentPage = Number.isFinite(page)
    ? Math.min(lastPage, Math.max(1, Math.floor(page)))
    : 1;
  const pageItems = getAdminPaginationPageItems(currentPage, lastPage);

  return (
    <nav
      aria-label="Pagination"
      className="inline-flex items-center gap-1 rounded-xl border border-slate-200/90 bg-slate-100/70 p-1"
    >
      <button
        type="button"
        aria-label="Previous page"
        disabled={disabled || currentPage <= 1}
        onClick={() => onPageChange(currentPage - 1)}
        className={navigationButtonClassName}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
      </button>

      <div className="hidden items-center gap-1 sm:flex">
        {pageItems.map((item, index) =>
          item === "ellipsis" ? (
            <span
              key={`ellipsis-${index}`}
              aria-hidden="true"
              className="select-none px-1 text-xs font-medium text-slate-400"
            >
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              aria-label={`Go to page ${item}`}
              aria-current={currentPage === item ? "page" : undefined}
              disabled={disabled}
              onClick={() => onPageChange(item)}
              className={
                currentPage === item
                  ? "inline-flex h-7 min-w-7 items-center justify-center rounded-lg bg-slate-900 px-2 text-xs font-semibold tabular-nums text-white shadow-xs transition-transform duration-150 active:scale-95"
                  : navigationButtonClassName
              }
            >
              {item}
            </button>
          ),
        )}
      </div>

      <span className="flex items-center px-2.5 text-xs font-medium tabular-nums text-slate-600 sm:hidden">
        Page {currentPage} of {lastPage}
      </span>

      <button
        type="button"
        aria-label="Next page"
        disabled={disabled || currentPage >= lastPage}
        onClick={() => onPageChange(currentPage + 1)}
        className={navigationButtonClassName}
      >
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </button>
    </nav>
  );
}
