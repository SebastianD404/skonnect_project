"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Filter, Loader2 } from "lucide-react";
import { RegistryMembersCsvExportButton } from "./RegistryMembersCsvExportButton";
import { useRegistryMembersSearchStatus } from "./RegistryMembersSearchStatus";

const classificationOptions = [
  { label: "In School Youth", value: "In school Youth" },
  { label: "Out of School Youth", value: "Out of School Youth" },
  { label: "Working Youth", value: "Working Youth" },
  { label: "Person w/ Disability", value: "Person w/ Disability" },
  { label: "Indigenous People", value: "Indigenous People" },
] as const;

type RegistryMembersFilterBarProps = {
  search: string;
  classification: string;
  skVoter: string;
};

export function RegistryMembersFilterBar({
  search: initialSearch,
  classification: initialClassification,
  skVoter: initialSkVoter,
}: RegistryMembersFilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchStatus = useRegistryMembersSearchStatus();
  const [filters, setFilters] = useState({
    search: initialSearch,
    classification: initialClassification,
    skVoter: initialSkVoter,
  });
  const [syncedFilters, setSyncedFilters] = useState({
    search: initialSearch,
    classification: initialClassification,
    skVoter: initialSkVoter,
  });
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  if (
    syncedFilters.search !== initialSearch ||
    syncedFilters.classification !== initialClassification ||
    syncedFilters.skVoter !== initialSkVoter
  ) {
    const nextFilters = {
      search: initialSearch,
      classification: initialClassification,
      skVoter: initialSkVoter,
    };
    setSyncedFilters(nextFilters);
    setFilters(nextFilters);
  }

  useEffect(
    () => () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    },
    [],
  );

  useEffect(() => {
    if (
      filters.search.trim() === initialSearch &&
      filters.classification === initialClassification &&
      filters.skVoter === initialSkVoter
    ) {
      searchStatus?.setIsSearching(false);
    }
  }, [
    filters.classification,
    filters.search,
    filters.skVoter,
    initialClassification,
    initialSearch,
    initialSkVoter,
    searchStatus,
  ]);

  useEffect(() => {
    if (!isPopoverOpen) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Node &&
        !popoverRef.current?.contains(target) &&
        !filterButtonRef.current?.contains(target)
      ) {
        setIsPopoverOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsPopoverOpen(false);
        filterButtonRef.current?.focus();
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isPopoverOpen]);

  const updateUrl = (filters: {
    search: string;
    classification: string;
    skVoter: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries({
      search: filters.search.trim(),
      classification: filters.classification,
      skVoter: filters.skVoter,
    })) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    params.delete("skeapStatus");
    params.set("page", "1");
    if (params.toString() === searchParams.toString()) {
      searchStatus?.setIsSearching(false);
      return;
    }
    searchStatus?.setIsSearching(true);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const updateCategoricalFilter = (
    key: "classification" | "skVoter",
    value: string,
  ) => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);

    const nextFilters = {
      search: filters.search,
      classification: key === "classification" ? value : filters.classification,
      skVoter: key === "skVoter" ? value : filters.skVoter,
    };
    setFilters(nextFilters);
    updateUrl(nextFilters);
  };

  const activeFilterCount = [
    filters.classification,
    filters.skVoter,
  ].filter(Boolean).length;

  const clearFilters = () => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    const nextFilters = { ...filters, classification: "", skVoter: "" };
    setFilters(nextFilters);
    updateUrl(nextFilters);
  };

  return (
    <div className="flex w-full flex-nowrap items-center gap-2 border-b border-slate-100 bg-slate-50/50 p-4 sm:gap-4">
      <label className="relative block min-w-0 flex-1 sm:max-w-sm">
        <span className="sr-only">Search profiles by name, email, or sitio</span>
        <input
          type="search"
          value={filters.search}
          onChange={(event) => {
            const value = event.target.value;
            const nextFilters = { ...filters, search: value };
            setFilters(nextFilters);
            searchStatus?.setIsSearching(true);
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
            searchTimeout.current = setTimeout(() => updateUrl(nextFilters), 300);
          }}
          placeholder="Search by name, email, or sitio..."
          title="Search profiles by name, email, or address"
          aria-label="Search profiles by name, email, or sitio"
          aria-busy={searchStatus?.isSearching ?? false}
          className="h-9 w-full rounded-full border border-slate-200 bg-white px-4 text-xs text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
        />
      </label>
      <div className="relative shrink-0">
        <button
          ref={filterButtonRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={isPopoverOpen}
          aria-controls="registry-members-filter-popover"
          onClick={() => setIsPopoverOpen((open) => !open)}
          className="relative inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20"
        >
          <Filter aria-hidden="true" className="h-4 w-4" />
          <span>Filters</span>
          {activeFilterCount > 0 ? (
            <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-cyan-600 px-1 text-[10px] font-bold leading-none text-white">
              {activeFilterCount}
            </span>
          ) : null}
        </button>
        {isPopoverOpen ? (
          <div
            ref={popoverRef}
            id="registry-members-filter-popover"
            role="dialog"
            aria-label="Profile filters"
            className="absolute left-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
          >
            <div className="space-y-3">
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                <span>Classification</span>
                <select
                  value={filters.classification}
                  onChange={(event) => updateCategoricalFilter("classification", event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                >
                  <option value="">All</option>
                  {classificationOptions.map(({ label, value }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-xs font-semibold text-slate-700">
                <span>SK Voter</span>
                <select
                  value={filters.skVoter}
                  onChange={(event) => updateCategoricalFilter("skVoter", event.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs font-normal text-slate-700 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
                >
                  <option value="">All</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </label>
            </div>
            <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
                className="text-xs font-semibold text-cyan-700 transition hover:text-cyan-900 disabled:cursor-not-allowed disabled:text-slate-400"
              >
                Clear Filters
              </button>
            </div>
          </div>
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        {searchStatus?.isSearching ? (
          <span role="status" aria-live="polite" className="flex items-center justify-end gap-1.5 whitespace-nowrap text-xs font-medium text-cyan-700">
            <Loader2 aria-hidden="true" className="h-3.5 w-3.5 animate-spin" />
            <span>Searching...</span>
          </span>
        ) : null}
      </div>
      <RegistryMembersCsvExportButton />
    </div>
  );
}
