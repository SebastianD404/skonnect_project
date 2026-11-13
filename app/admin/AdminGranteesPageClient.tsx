"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAdminSearch } from "./AdminSearchContext";
import AdminExportButton from "./AdminExportButton";
import { GranteeStatusTable, type GranteeTableRow } from "./grantees/GranteeStatusTable";

interface AdminGranteesPageClientProps {
  grantees: GranteeTableRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  query: string;
}

export default function AdminGranteesPageClient({
  grantees,
  page,
  pageSize,
  totalCount,
  query,
}: AdminGranteesPageClientProps) {
  const { searchQuery, setSearchQuery } = useAdminSearch();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, startTransition] = useTransition();
  const initializedRouteQuery = useRef(false);
  const lastRouteQuery = useRef(query);

  useEffect(() => {
    if (!initializedRouteQuery.current || lastRouteQuery.current !== query) {
      initializedRouteQuery.current = true;
      lastRouteQuery.current = query;
      if (searchQuery.trim() !== query) {
        setSearchQuery(query);
        return;
      }
    }

    const nextQuery = searchQuery.trim();
    if ((searchParams.get("q") ?? "") === nextQuery) return;

    const timeout = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (nextQuery) params.set("q", nextQuery);
      else params.delete("q");
      params.set("page", "1");
      const queryString = params.toString();
      startTransition(() => {
        router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [pathname, query, router, searchParams, searchQuery, setSearchQuery, startTransition]);
  const exportParams = new URLSearchParams();
  if (searchQuery.trim()) exportParams.set("q", searchQuery.trim());
  const exportHref = `/api/admin/grantees/export${exportParams.size ? `?${exportParams.toString()}` : ""}`;
  const isSearchLoading = searchQuery.trim() !== query;
  const [scholarshipCandidate, setScholarshipCandidate] = useState<GranteeTableRow | null>(null);
  const [isEndingScholarship, setIsEndingScholarship] = useState(false);
  const [scholarshipError, setScholarshipError] = useState<string | null>(null);

  const handleEndScholarshipRequest = (grantee: GranteeTableRow) => {
    setScholarshipCandidate(grantee);
    setScholarshipError(null);
  };

  const closeScholarshipModal = () => {
    setScholarshipCandidate(null);
    setScholarshipError(null);
  };

  const confirmEndScholarship = async () => {
    if (!scholarshipCandidate) return;
    setIsEndingScholarship(true);
    setScholarshipError(null);

    try {
      const response = await fetch(`/api/admin/grantees/${scholarshipCandidate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "REMOVED" }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to end scholarship status");
      }

      window.location.reload();
    } catch (error) {
      setScholarshipError(error instanceof Error ? error.message : "Failed to end scholarship status");
    } finally {
      setIsEndingScholarship(false);
    }
  };

  return (
    <>
      <div className="flex w-full flex-col gap-6 pb-12">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Grantee Status</span>
            <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Track scholar progress</h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
              See the latest status, academic average, and enrollment details for every approved grantee.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminExportButton
              href={exportHref}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#0F3D5C] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0D2E47]"
              iconClassName="h-3.5 w-3.5"
            />
          </div>
        </header>

        <GranteeStatusTable
          grantees={grantees}
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          query={searchQuery}
          onQueryChange={setSearchQuery}
          isLoading={isLoading || isSearchLoading}
          startNavigation={(callback) => startTransition(callback)}
          onEndScholarship={handleEndScholarshipRequest}
        />
      </div>
      {scholarshipCandidate ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-950">End Scholarship Status</h2>
                <p className="mt-2 text-sm text-slate-600">
                  This will remove {scholarshipCandidate.fullName} from active SKEAP reports, but their Katipunan ng Kabataan demographic profile will remain active.
                </p>
              </div>
              <button
                type="button"
                onClick={closeScholarshipModal}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close end scholarship confirmation"
              >
                <span className="text-xl">×</span>
              </button>
            </div>

            {scholarshipError ? (
              <div className="mt-4 rounded-3xl bg-rose-50 p-4 text-sm text-rose-700">
                {scholarshipError}
              </div>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeScholarshipModal}
                disabled={isEndingScholarship}
                className="inline-flex justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmEndScholarship}
                disabled={isEndingScholarship}
                className="inline-flex justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
              >
                {isEndingScholarship ? "Updating..." : "End Scholarship"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
