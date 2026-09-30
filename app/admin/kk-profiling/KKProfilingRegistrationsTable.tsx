"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Search } from "lucide-react";
import { KKProfilingRowActions } from "./KKProfilingRowActions";
import type { KKProfilingRegistration } from "./types";
import { useAdminSearch } from "../AdminSearchContext";
import { formatDate } from "@/lib/utils";
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

export function KKProfilingRegistrationsTable({
  registrations,
  statusLabel,
  flat = false,
  exportHref,
}: {
  registrations: KKProfilingRegistration[];
  statusLabel?: string;
  flat?: boolean;
  exportHref?: string;
}) {
  const [rows, setRows] = useState(registrations);
  const [tableQuery, setTableQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { searchQuery } = useAdminSearch();
  const pageSearch = useKKProfilingTableSearch();
  const router = useRouter();
  const activeTableQuery = pageSearch?.query ?? tableQuery;
  const setActiveTableQuery = pageSearch?.setQuery ?? setTableQuery;

  const filteredRows = useMemo(() => {
    const workspaceQuery = searchQuery.trim().toLowerCase();
    const localQuery = activeTableQuery.trim().toLowerCase();
    if (!workspaceQuery && !localQuery) return rows;

    return rows.filter((registration) => {
      const searchableText = [
        registration.fullName,
        registration.email,
        registration.youthAgeGroup,
        registration.youthClassification,
        registration.registeredSKVoter,
        registration.reviewStatus,
      ]
        .join(" ")
        .toLowerCase();
      return (!workspaceQuery || searchableText.includes(workspaceQuery)) &&
        (!localQuery || searchableText.includes(localQuery));
    });
  }, [rows, searchQuery, activeTableQuery]);

  useEffect(() => {
    setIsLoading(true);
    const normalizedTab = String(statusLabel ?? "").toLowerCase();
    const initialRows = normalizedTab
      ? registrations.filter((r) => String(r.reviewStatus ?? "Pending").toLowerCase() === normalizedTab)
      : registrations;
    setRows(initialRows);
    const timer = window.setTimeout(() => setIsLoading(false), 200);
    return () => window.clearTimeout(timer);
  }, [registrations, statusLabel]);

  const handleDelete = async (id: string) => {
    try {
      await deleteRegistration(id);
      setRows((current) => current.filter((row) => row.id !== id));
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
      setRows((current) => current.filter((row) => row.id !== updatedRegistration.id));
      try {
        router.refresh();
      } catch {
        // ignore refresh failures
      }
      return;
    }

    setRows((current) =>
      current.map((row) => (row.id === updatedRegistration.id ? updatedRegistration : row))
    );
  };

  const handleStatusUpdate = (status: "Approved" | "Returned") => {
    router.push(`/admin/kk-profiling?status=${status.toLowerCase()}`);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
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
            <a
              href={exportHref}
              className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 sm:self-auto"
            >
              <Download className="h-3.5 w-3.5 text-slate-400" />
              <span>Export Records</span>
            </a>
            ) : null}
          </div>
        )}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-full border-4 border-slate-200 border-t-slate-950 animate-spin" />
          </div>
        )}
        <table className="min-w-full border-collapse whitespace-nowrap text-left text-sm">
          <thead className={flat ? "bg-gradient-to-r from-slate-900 to-cyan-900" : "bg-slate-50 text-slate-600"}>
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
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {filteredRows.map((registration) => (
                <tr key={registration.id} className="transition-colors hover:bg-slate-50/50">
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
                    ) : (
                      <span className="capitalize text-slate-700">{registration.reviewStatus || "Pending"}</span>
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
  );
}
