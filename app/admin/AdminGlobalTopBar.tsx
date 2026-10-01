"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, LoaderCircle, Search } from "lucide-react";
import { useAdminSearch } from "./AdminSearchContext";

interface AdminGlobalTopBarProps {
  openInquiryCount: number;
  pendingSubmissionCount: number;
}

interface AdminSearchResult {
  id: string;
  type: string;
  label: string;
  detail: string;
  href: string;
}

export default function AdminGlobalTopBar({
  openInquiryCount,
  pendingSubmissionCount,
}: AdminGlobalTopBarProps) {
  const { searchQuery, setSearchQuery } = useAdminSearch();
  const [areNotificationsOpen, setAreNotificationsOpen] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<AdminSearchResult[]>([]);
  const [searchState, setSearchState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const notificationCount = openInquiryCount + pendingSubmissionCount;

  useEffect(() => {
    if (!areNotificationsOpen) return;

    const closeOnOutsidePointerDown = (event: PointerEvent) => {
      if (!notificationRef.current?.contains(event.target as Node)) {
        setAreNotificationsOpen(false);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsidePointerDown);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointerDown);
  }, [areNotificationsOpen]);

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
      <header className="sticky top-0 z-50 flex w-full items-center justify-between border-b border-slate-200/70 bg-slate-50/80 px-5 py-4 backdrop-blur-md md:px-8">
        <div
          className="relative max-w-2xl flex-1"
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

        <div className="ml-4 flex shrink-0 items-center gap-3">
          <div ref={notificationRef} className="relative">
            <button
              type="button"
              aria-label="Notifications"
              aria-expanded={areNotificationsOpen}
              onClick={() => setAreNotificationsOpen((open) => !open)}
              className="group relative flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-white/95 text-slate-600 shadow-sm transition hover:border-[#0F3D5C]/40 hover:bg-[#0F3D5C]/5 hover:text-[#0F3D5C]"
            >
              <Bell className={`h-4 w-4 transition-colors ${areNotificationsOpen ? "fill-current text-[#0F3D5C]" : "text-slate-600 group-hover:text-[#0F3D5C]"}`} />
              {notificationCount > 0 && (
                <span aria-hidden="true" className="absolute right-2.5 top-2 h-1.5 w-1.5 rounded-full border border-white bg-red-500" />
              )}
            </button>

            {areNotificationsOpen && (
              <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="border-b border-slate-100 px-4 py-3">
                  <h2 className="text-sm font-semibold text-slate-900">Notifications</h2>
                </div>
                <div className="space-y-1 p-2">
                  {openInquiryCount > 0 && (
                    <Link
                      href="/admin/inquiries"
                      onClick={() => setAreNotificationsOpen(false)}
                      className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <span className="block text-sm font-medium text-slate-900">{openInquiryCount} open inquiries</span>
                      <span className="mt-1 block text-xs text-slate-500">Awaiting your response</span>
                    </Link>
                  )}
                  {pendingSubmissionCount > 0 && (
                    <Link
                      href="/admin/submissions"
                      onClick={() => setAreNotificationsOpen(false)}
                      className="block rounded-xl px-3 py-2.5 transition-colors hover:bg-slate-50"
                    >
                      <span className="block text-sm font-medium text-slate-900">{pendingSubmissionCount} pending submissions</span>
                      <span className="mt-1 block text-xs text-slate-500">Under review</span>
                    </Link>
                  )}
                  {notificationCount === 0 && (
                    <p className="px-3 py-6 text-center text-sm text-slate-500">You&apos;re all caught up.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </header>
  );
}
