"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LoaderCircle, Search } from "lucide-react";
import { useAdminSearch } from "./AdminSearchContext";

interface AdminSearchResult {
  id: string;
  type: string;
  label: string;
  detail: string;
  href: string;
}

export default function AdminGlobalTopBar() {
  const { searchQuery, setSearchQuery } = useAdminSearch();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<AdminSearchResult[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle");

  useEffect(() => {
    const query = searchQuery.trim();
    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      if (query.length < 2) {
        setSearchResults([]);
        setSearchState("idle");
        return;
      }

      setSearchState("loading");
      try {
        const response = await fetch(`/api/admin/search?q=${encodeURIComponent(query)}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Search unavailable");
        const payload = await response.json() as { results: AdminSearchResult[] };
        setSearchResults(payload.results);
        setSearchState("ready");
      } catch {
        if (!controller.signal.aborted) setSearchState("error");
      }
    }, 200);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [searchQuery]);

  return (
      <header className="sticky top-0 z-50 flex w-full items-center justify-start border-b border-slate-200/70 bg-slate-50/80 px-5 py-4 backdrop-blur-md md:px-8">
        <div
          className="relative w-full max-w-3xl"
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
              setIsSearchOpen(false);
            }
          }}
        >
          <label className="group relative block">
            <span className="sr-only">Search grantees and inquiries</span>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 transition-colors group-focus-within:text-cyan-600" />
            <input
              type="search"
              placeholder="Search workspace..."
              title="Search grantees, inquiries, KK profiles, members, and submissions"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={isSearchOpen}
              aria-controls="admin-workspace-search-results"
              value={searchQuery}
              onFocus={() => setIsSearchOpen(true)}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setIsSearchOpen(true);
              }}
              className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10"
            />
          </label>
          {isSearchOpen && (
            <div
              id="admin-workspace-search-results"
              role="listbox"
              aria-label="Workspace search results"
              className="absolute left-0 right-0 top-full z-[60] mt-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
              {searchQuery.trim().length < 2 ? (
                <p className="px-4 py-3 text-xs text-slate-500">
                  Search grantees, inquiries, KK profiles, members, or submissions.
                </p>
              ) : searchState === "loading" ? (
                <div className="flex items-center gap-2 px-4 py-4 text-xs text-slate-500" role="status">
                  <LoaderCircle className="h-4 w-4 animate-spin text-cyan-600" />
                  Searching workspace...
                </div>
              ) : searchState === "error" ? (
                <p className="px-4 py-4 text-xs text-rose-600" role="status">
                  Search is temporarily unavailable. Try again.
                </p>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-4 text-xs text-slate-500" role="status">
                  No workspace records found for “{searchQuery.trim()}”.
                </p>
              ) : (
                <div className="max-h-[min(60vh,420px)] overflow-y-auto p-1.5">
                  {searchResults.map((result) => (
                    <Link
                      key={result.id}
                      href={result.href}
                      role="option"
                      aria-selected="false"
                      onClick={() => setIsSearchOpen(false)}
                      className="flex items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-50 text-cyan-700">
                        <Search className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-3">
                          <span className="truncate text-sm font-semibold text-slate-900">{result.label}</span>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">{result.type}</span>
                        </span>
                        <span className="mt-0.5 block truncate text-xs text-slate-500">{result.detail}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </header>
  );
}
