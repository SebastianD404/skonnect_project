"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

function NonCompliantTableSkeleton() {
  const columns = [
    "Scholar",
    "School / Year Level",
    "Status",
    "Missing or Rejected Requirements",
    "Last Submission",
  ];

  return (
    <div role="status" aria-label="Loading non-compliant scholars" aria-live="polite">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead className="relative z-10 bg-gradient-to-r from-slate-900 to-cyan-900">
            <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-cyan-50">
              {columns.map((column) => (
                <th key={column} scope="col" className="px-5 py-3">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {Array.from({ length: 5 }, (_, row) => (
              <tr key={row} className="h-[72px] border-b border-slate-100 last:border-b-0" aria-hidden="true">
                <td className="px-5 py-4">
                  <div className="h-4 w-36 max-w-full animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-28 max-w-full animate-pulse rounded bg-slate-200" />
                </td>
                <td className="px-5 py-4">
                  <div className="h-4 w-40 max-w-full animate-pulse rounded bg-slate-200" />
                  <div className="mt-2 h-3 w-16 animate-pulse rounded bg-slate-200" />
                </td>
                <td className="px-5 py-4">
                  <div className="h-6 w-28 animate-pulse rounded-full bg-slate-200" />
                </td>
                <td className="px-5 py-4">
                  <div className="h-4 w-56 max-w-full animate-pulse rounded bg-slate-200" />
                </td>
                <td className="px-5 py-4">
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-200" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-slate-200/80 px-5 py-3.5" aria-hidden="true">
        <div className="h-4 w-44 animate-pulse rounded bg-slate-200" />
        <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
      </div>
      <span className="sr-only">Loading non-compliant scholars</span>
    </div>
  );
}

export default function NonCompliantSearch({
  initialQuery,
  pageSize,
  children,
}: {
  initialQuery: string;
  pageSize: number;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(initialQuery);
  const [syncedInitialQuery, setSyncedInitialQuery] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  if (syncedInitialQuery !== initialQuery) {
    setSyncedInitialQuery(initialQuery);
    setQuery(initialQuery);
  }

  useEffect(
    () => () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    },
    [],
  );

  const updateUrl = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const nextQuery = value.trim();
    if (nextQuery) params.set("q", nextQuery);
    else params.delete("q");
    params.set("page", "1");
    params.set("pageSize", String(pageSize));

    const nextUrl = `${pathname}?${params.toString()}`;
    if (nextUrl === `${pathname}?${searchParams.toString()}`) {
      return;
    }

    startTransition(() => router.replace(nextUrl, { scroll: false }));
  }, [pageSize, pathname, router, searchParams, startTransition]);

  useEffect(() => {
    if (query.trim() === initialQuery) return;
    searchTimeout.current = setTimeout(() => updateUrl(query), 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [initialQuery, query, updateUrl]);

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    updateUrl(query);
  }

  const searching = query.trim() !== initialQuery || isPending;

  return (
    <>
    <form
      role="search"
      onSubmit={submitSearch}
      className="flex flex-col gap-2 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center"
    >
      <label htmlFor="non-compliant-search" className="sr-only">
        Search non-compliant scholars
      </label>
      <input
        id="non-compliant-search"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search name, email, school, or year level..."
        aria-label="Search non-compliant scholars"
        aria-busy={searching}
        className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 sm:max-w-sm"
      />
      <button type="submit" className="sr-only">
        Search
      </button>
      <div className="min-w-0 flex-1">
        {searching ? (
          <span role="status" aria-live="polite" className="flex items-center justify-end gap-1.5 whitespace-nowrap text-xs font-medium text-cyan-700">
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            <span>Searching...</span>
          </span>
        ) : null}
      </div>
    </form>
    <div aria-busy={searching}>
      {searching ? <NonCompliantTableSkeleton /> : children}
    </div>
    </>
  );
}
