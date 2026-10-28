"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search } from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { KKProfilingRowActions } from "./KKProfilingRowActions";
import type { KKProfilingRegistration } from "./types";
import { useAdminSearch } from "../AdminSearchContext";
import AdminExportButton from "../AdminExportButton";
import { formatDate } from "@/lib/utils";
import { isKKProfilingManualReview } from "@/lib/kk-profiling-review";
import { useKKProfilingTableSearch } from "./KKProfilingTableSearch";

const deleteRegistration = async (id: string) => {
  const response = await fetch(`/api/admin/kk-profiling/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error?.error || "Failed to delete registration");
  }
};

function rowsForStatus(registrations: KKProfilingRegistration[], statusLabel?: string) {
  const normalizedTab = String(statusLabel ?? "").toLowerCase();
  return normalizedTab
    ? registrations.filter((registration) => String(registration.reviewStatus ?? "Pending").toLowerCase() === normalizedTab)
    : registrations;
}

export function KKProfilingRegistrationsTable({
  registrations,
  statusLabel,
  flat = false,
  exportHref,
  pageNumber,
  pageSize,
}: {
  registrations: KKProfilingRegistration[];
  statusLabel?: string;
  flat?: boolean;
  exportHref?: string;
  pageNumber?: number;
  pageSize?: number;
}) {
  const [rowState, setRowState] = useState(() => ({
    registrations,
    statusLabel,
    rows: rowsForStatus(registrations, statusLabel),
  }));
  let rows = rowState.rows;
  if (rowState.registrations !== registrations || rowState.statusLabel !== statusLabel) {
    rows = rowsForStatus(registrations, statusLabel);
    setRowState({ registrations, statusLabel, rows });
  }
  const [tableQuery, setTableQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { searchQuery } = useAdminSearch();
  const pageSearch = useKKProfilingTableSearch();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTableQuery = pageSearch?.query ?? tableQuery;
  const setActiveTableQuery = pageSearch?.setQuery ?? setTableQuery;
  const deferredTableQuery = useDeferredValue(activeTableQuery);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const requestedStatus = (searchParams.get("status") ?? "pending").toLowerCase();
  const requestedPageValue = Number(searchParams.get("page") ?? "1");
  const requestedPage = Number.isFinite(requestedPageValue) ? Math.max(1, Math.floor(requestedPageValue)) : 1;
  const requestedPageSizeValue = Number(searchParams.get("pageSize") ?? "10");
  const requestedPageSize = Number.isFinite(requestedPageSizeValue) ? requestedPageSizeValue : 10;
  const focusedRegistrationId = searchParams.get("focus");
  const routePending = pathname === "/admin/kk-profiling" && (
    requestedStatus !== String(statusLabel ?? "Pending").toLowerCase() ||
    requestedPage !== (pageNumber ?? 1) ||
    requestedPageSize !== (pageSize ?? 10)
  );
  const isLoading = routePending;

  const filteredRows = useMemo(() => {
    const workspaceQuery = deferredSearchQuery.trim().toLowerCase();
    const localQuery = deferredTableQuery.trim().toLowerCase();
    if (!workspaceQuery && !localQuery) return rows;

    return rows.filter((registration) => {
      const searchableText = [
        registration.fullName,
        registration.email,
        registration.youthAgeGroup,
        registration.youthClassification,
        registration.registeredSKVoter,
        registration.reviewStatus,
        registration.requiresManualReview ? "manual review requested" : "",
      ]
        .join(" ")
        .toLowerCase();
      return (!workspaceQuery || searchableText.includes(workspaceQuery)) &&
        (!localQuery || searchableText.includes(localQuery));
    });
  }, [rows, deferredSearchQuery, deferredTableQuery]);

  const handleDelete = async (id: string) => {
    try {
      await deleteRegistration(id);
      setRowState((current) => ({
        ...current,
        rows: current.rows.filter((row) => row.id !== id),
      }));
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete registration");
    }
  };

  const handleUpdate = (updatedRegistration: KKProfilingRegistration) => {
    const normalizedTab = String(statusLabel ?? "").toLowerCase();
    const normalizedUpdated = String(updatedRegistration.reviewStatus ?? "").toLowerCase();

    // If the updated registration no longer belongs in this tab, remove it and refresh server data
    if (normalizedTab && normalizedUpdated && normalizedTab !== normalizedUpdated) {
      setRowState((current) => ({
        ...current,
        rows: current.rows.filter((row) => row.id !== updatedRegistration.id),
      }));
      return;
    }

    setRowState((current) => ({
      ...current,
      rows: current.rows.map((row) => (row.id === updatedRegistration.id ? updatedRegistration : row)),
    }));
  };

  const handleStatusUpdate = (status: "Approved" | "Returned" | "Rejected", registrationId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status.toLowerCase());
    params.set("page", "1");
    params.set("focus", registrationId);
    router.push(`/admin/kk-profiling?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-4">
      {error ? <FloatingFeedback message={error} type="error" onDismiss={() => setError(null)} /> : null}
      <div className={flat ? "relative" : "relative overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"}>
        {!pageSearch && (
          <div className="flex flex-col items-stretch justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center">
            <label className="relative block w-full sm:w-80">
              <span className="sr-only">Filter the current profiling table</span>
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={activeTableQuery}
                onChange={(event) => setActiveTableQuery(event.target.value)}
                placeholder="Filter by name, email, or classification..."
                title="Filters rows in the current table view"
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 placeholder:text-slate-400"
              />
            </label>
            {exportHref ? (
            <AdminExportButton
              href={exportHref}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 sm:self-auto"
              iconClassName="h-3.5 w-3.5 text-slate-400"
            />
            ) : null}
          </div>
        )}
        <div className="relative w-full overflow-x-auto">
          {isLoading ? (
            <div
              role="status"
              aria-live="polite"
              className="absolute inset-x-0 bottom-0 top-[50px] z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1.5px] transition-all duration-300"
            >
              <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-cyan-600" />
                <span className="text-xs font-semibold text-slate-600">Loading records...</span>
              </div>
            </div>
          ) : null}
          <table className="min-w-full border-collapse whitespace-nowrap text-left text-sm">
          <thead className={`relative z-30 ${flat ? "bg-gradient-to-r from-slate-900 to-cyan-900" : "bg-slate-50 text-slate-600"}`}>
            <tr className={flat
              ? "border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-cyan-50"
              : "text-[11px] font-bold uppercase tracking-wider text-slate-600"}
            >
              <th className="px-6 py-4">Name</th>
              <th className="px-6 py-4">Age group</th>
              <th className="px-6 py-4">Classification</th>
              <th className="px-6 py-4">SK Voter</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Submitted</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-100 bg-white text-slate-700 transition-opacity duration-300 ${isLoading ? "pointer-events-none opacity-40" : "opacity-100"}`}>
              {filteredRows.map((registration) => (
                <tr
                  key={registration.id}
                  className={`transition-colors hover:bg-slate-50/50 ${
                    registration.id === focusedRegistrationId
                      ? "bg-cyan-50 ring-1 ring-inset ring-cyan-200"
                      : ""
                  }`}
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-900">{registration.fullName}</div>
                    <div className="text-xs text-slate-500">{registration.email}</div>
                  </td>
                  <td className="px-6 py-4">{registration.youthAgeGroup}</td>
                  <td className="px-6 py-4">{registration.youthClassification}</td>
                  <td className="px-6 py-4">{registration.registeredSKVoter}</td>
                  <td className="px-6 py-4">
                    {String(registration.reviewStatus || "Pending").toLowerCase() === "approved" ? (
                      <span className="inline-flex items-center rounded-full border border-emerald-200/60 bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                        Approved
                      </span>
                    ) : String(registration.reviewStatus || "").toLowerCase() === "rejected" ? (
                      <div className="flex flex-col items-start gap-1">
                        <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold text-rose-700">
                          Rejected
                        </span>
                        {registration.reviewNotes ? (
                          <span className="max-w-56 truncate text-xs text-slate-500" title={registration.reviewNotes}>
                            Reason: {registration.reviewNotes}
                          </span>
                        ) : null}
                      </div>
                    ) : (
                      <div className="flex flex-col items-start gap-1">
                        <span className="capitalize text-slate-700">{registration.reviewStatus || "Pending"}</span>
                        {registration.requiresManualReview || isKKProfilingManualReview(registration.reviewNotes) ? (
                          <span
                            title={registration.reviewNotes ?? undefined}
                            className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800"
                          >
                            Manual review requested
                          </span>
                        ) : null}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {formatDate(registration.submittedAt)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <KKProfilingRowActions
                      registration={registration}
                      onDelete={handleDelete}
                      onUpdate={handleUpdate}
                      onStatusUpdate={handleStatusUpdate}
                    />
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {rows.length === 0 || filteredRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            {rows.length === 0
              ? `No ${statusLabel ? statusLabel.toLowerCase() : "registered"} KK profiles yet.`
              : "No profiles match your filters."}
          </div>
        ) : null}
        </div>
      </div>
    </div>
  );
}
