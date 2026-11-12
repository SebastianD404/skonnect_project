"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, Search } from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { KKProfilingRowActions } from "./KKProfilingRowActions";
import type { KKProfilingRegistration } from "./types";
import { useAdminSearch } from "../AdminSearchContext";
import AdminExportButton from "../AdminExportButton";
import { formatDate } from "@/lib/utils";
import { DEFAULT_ADMIN_TABLE_PAGE_SIZE, normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import { isKKProfilingManualReview } from "@/lib/kk-profiling-review";
import type { KKMemberArchiveReason } from "@/lib/kk-member-archive";
import { useKKProfilingTableSearch } from "./KKProfilingTableSearch";
import {
  KKProfilingMobileTableSkeleton,
  KKProfilingTableSkeletonRows,
} from "./KKProfilingTableSkeleton";

function rowsForStatus(registrations: KKProfilingRegistration[], statusLabel?: string) {
  const normalizedTab = String(statusLabel ?? "").toLowerCase();
  return normalizedTab
    ? registrations.filter((registration) => String(registration.reviewStatus ?? "Pending").toLowerCase() === normalizedTab)
    : registrations;
}

function getSkeapStatusBadge(status?: string | null) {
  switch (status?.toUpperCase()) {
    case "ACTIVE":
      return {
        label: "Active Scholar",
        className: "bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200",
      };
    case "PROBATIONARY":
      return {
        label: "Probationary Scholar",
        className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      };
    case "APPROVED":
      return {
        label: "Approved Application",
        className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
      };
    case "WAITLISTED":
      return {
        label: "Waitlisted",
        className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
      };
    case "PENDING":
      return {
        label: "Application Pending",
        className: "bg-slate-100 text-slate-600",
      };
    case "REMOVED":
      return {
        label: "Former Scholar",
        className: "bg-slate-100 text-slate-600",
      };
    default:
      return {
        label: "KK Profile Only",
        className: "bg-slate-100 text-slate-600",
      };
  }
}

export function KKProfilingRegistrationsTable({
  registrations,
  statusLabel,
  flat = false,
  fitContainer = false,
  archiveAction = false,
  showMemberRoleColumn = false,
  exportHref,
  exportMenu,
  pageNumber,
  pageSize,
}: {
  registrations: KKProfilingRegistration[];
  statusLabel?: string;
  flat?: boolean;
  fitContainer?: boolean;
  archiveAction?: boolean;
  showMemberRoleColumn?: boolean;
  exportHref?: string;
  exportMenu?: ReactNode;
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
  const cellPadding = fitContainer
    ? showMemberRoleColumn ? "whitespace-nowrap px-3 py-3.5" : "whitespace-nowrap px-3.5 py-3.5"
    : "whitespace-nowrap px-6 py-4";
  const actionCellPadding = fitContainer
    ? "whitespace-nowrap px-4 py-3.5"
    : "whitespace-nowrap px-6 py-4";
  const deferredTableQuery = useDeferredValue(activeTableQuery);
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const requestedStatus = (searchParams.get("status") ?? "pending").toLowerCase();
  const requestedPageValue = Number(searchParams.get("page") ?? "1");
  const requestedPage = Number.isFinite(requestedPageValue) ? Math.max(1, Math.floor(requestedPageValue)) : 1;
  const requestedPageSizeValue = Number(
    searchParams.get("pageSize") ?? String(DEFAULT_ADMIN_TABLE_PAGE_SIZE),
  );
  const requestedPageSize = normalizeAdminTablePageSize(requestedPageSizeValue);
  const routePending = pathname === "/admin/kk-profiling" && (
    requestedStatus !== String(statusLabel ?? "Pending").toLowerCase() ||
    requestedPage !== (pageNumber ?? 1) ||
    requestedPageSize !== (pageSize ?? DEFAULT_ADMIN_TABLE_PAGE_SIZE)
  );
  const isLoading = routePending || pageSearch?.isNavigating === true;

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

  const handleArchive = async (id: string, archiveReason: KKMemberArchiveReason) => {
    const response = await fetch(`/api/admin/members/${id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archiveReason }),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload?.error || "Failed to archive profile");
    }

    setRowState((current) => ({
      ...current,
      rows: current.rows.filter((row) => row.id !== id),
    }));
    setError(null);
    router.refresh();
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
          <div className={`relative flex flex-col items-stretch justify-between gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:items-center ${fitContainer ? "z-40" : ""}`}>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
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
            </div>
            {exportMenu ?? (exportHref ? (
              <AdminExportButton
                href={exportHref}
                className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#0F3D5C] px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] sm:self-auto"
                iconClassName="h-3.5 w-3.5"
              />
            ) : null)}
          </div>
        )}
        {!fitContainer ? (
          <div className="p-3 md:hidden">
            {isLoading ? <KKProfilingMobileTableSkeleton /> : filteredRows.map((registration) => {
              const status = registration.reviewStatus || "Pending";
              const normalizedStatus = status.toLowerCase();
              const statusClass =
                normalizedStatus === "approved"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : normalizedStatus === "pending" || normalizedStatus === "resubmitted"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : normalizedStatus === "returned" || normalizedStatus === "rejected"
                      ? "border-rose-200 bg-rose-50 text-rose-700"
                      : "border-slate-200 bg-slate-100 text-slate-700";

              return (
                <article key={registration.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold leading-tight text-slate-900" title={registration.fullName}>
                        {registration.fullName}
                      </h3>
                      <p className="mt-0.5 truncate text-xs text-slate-500" title={registration.email}>
                        {registration.email}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                      {status}
                    </span>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Age Group</dt>
                      <dd className="mt-0.5 truncate font-semibold text-slate-800">{registration.youthAgeGroup}</dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Classification</dt>
                      <dd className="mt-0.5 truncate font-semibold text-slate-800">{registration.youthClassification}</dd>
                    </div>
                  </dl>

                  {registration.requiresManualReview || isKKProfilingManualReview(registration.reviewNotes) ? (
                    <p className="text-xs font-medium text-amber-800">
                      {registration.reviewNotes || "Requires manual review"}
                    </p>
                  ) : null}

                  <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <span className="text-[11px] text-slate-500">
                      Submitted {formatDate(registration.submittedAt)}
                    </span>
                    <KKProfilingRowActions
                      registration={registration}
                      onUpdate={handleUpdate}
                      onStatusUpdate={handleStatusUpdate}
                      cardView
                    />
                  </div>
                </article>
              );
            })}
            {!isLoading && filteredRows.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
                {rows.length === 0
                  ? `No ${statusLabel ? statusLabel.toLowerCase() : "registered"} KK profiles yet.`
                  : "No profiles match your filters."}
              </div>
            ) : null}
          </div>
        ) : null}
        {fitContainer ? (
          <div className="p-3 md:hidden">
            {isLoading ? <KKProfilingMobileTableSkeleton /> : filteredRows.map((registration) => {
              const statusBadge = getSkeapStatusBadge(registration.skeapStatus);

              return (
                <article key={registration.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold text-slate-900" title={registration.fullName}>
                        {registration.fullName}
                      </h3>
                      <p className="truncate text-xs text-slate-500" title={registration.email}>
                        {registration.email}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge.className}`}>
                      {statusBadge.label}
                    </span>
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-y border-slate-100 py-3">
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Age group</dt>
                      <dd className="mt-0.5 text-xs font-medium text-slate-700">{registration.youthAgeGroup}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Classification</dt>
                      <dd className="mt-0.5 text-xs font-medium text-slate-700">{registration.youthClassification}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">SK voter</dt>
                      <dd className="mt-0.5 text-xs font-medium text-slate-700">{registration.registeredSKVoter}</dd>
                    </div>
                    <div>
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Member status</dt>
                      <dd className="mt-0.5 text-xs font-medium text-slate-700">
                        {statusBadge.label}
                      </dd>
                    </div>
                  </dl>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-slate-500">
                      Submitted {formatDate(registration.submittedAt)}
                    </span>
                    <KKProfilingRowActions
                      registration={registration}
                      onUpdate={handleUpdate}
                      onStatusUpdate={handleStatusUpdate}
                      compact
                      onArchive={archiveAction ? handleArchive : undefined}
                    />
                  </div>
                </article>
              );
            })}
            {!isLoading && filteredRows.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
                {rows.length === 0
                  ? `No ${statusLabel ? statusLabel.toLowerCase() : "registered"} KK profiles yet.`
                  : "No profiles match your filters."}
              </div>
            ) : null}
          </div>
        ) : null}
        <div
          className="relative hidden w-full overflow-x-auto whitespace-nowrap scrollbar-thin md:block"
          style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}
        >
          {isLoading ? <span role="status" aria-live="polite" className="sr-only">Loading applications</span> : null}
          <table aria-busy={isLoading} className={fitContainer
            ? "w-full min-w-[850px] table-fixed border-collapse text-left text-sm"
            : "min-w-full border-collapse whitespace-nowrap text-left text-sm"}
          >
          {fitContainer ? (
            showMemberRoleColumn ? (
              <colgroup>
                <col className="w-[24%]" />
                <col className="w-[20%]" />
                <col className="w-[16%]" />
                <col className="w-[12%]" />
                <col className="w-[14%]" />
                <col className="w-[14%]" />
              </colgroup>
            ) : (
              <colgroup>
                <col className="w-[26%]" />
                <col className="w-[16%]" />
                <col className="w-[16%]" />
                <col className="w-[9%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
                <col className="w-[10%]" />
              </colgroup>
            )
          ) : null}
          <thead className={`relative z-30 ${flat ? "bg-gradient-to-r from-slate-900 to-cyan-900" : "bg-slate-50 text-slate-600"}`}>
            <tr className={flat
              ? "border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-cyan-50"
              : "text-[11px] font-bold uppercase tracking-wider text-slate-600"}
            >
              <th className={cellPadding}>Name</th>
              <th className={`${cellPadding} ${showMemberRoleColumn ? "pr-5" : ""}`}>Age group</th>
              <th className={`${cellPadding} ${showMemberRoleColumn ? "pl-5" : ""}`}>Classification</th>
              <th className={`${cellPadding} ${fitContainer ? "text-center" : ""}`}>SK Voter</th>
              {showMemberRoleColumn ? (
                <th className={`${cellPadding} ${fitContainer ? "text-center" : ""}`}>SKEAP Status</th>
              ) : (
                <>
                  <th className={`${cellPadding} ${fitContainer ? "text-center" : ""}`}>Status</th>
                  <th className={`${cellPadding} ${fitContainer ? "whitespace-nowrap" : ""}`}>Submitted</th>
                </>
              )}
              <th scope="col" className={`${actionCellPadding} text-center`}>{archiveAction ? "Actions" : "Action"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-slate-700">
              {isLoading ? (
                <KKProfilingTableSkeletonRows
                  showMemberRoleColumn={showMemberRoleColumn}
                  cellPadding={cellPadding}
                  actionCellPadding={actionCellPadding}
                  centerVoter={fitContainer}
                />
              ) : filteredRows.map((registration) => (
                <tr
                  key={registration.id}
                  className="transition-colors hover:bg-slate-50/50"
                >
                      <td className={cellPadding}>
                        <div className="truncate font-semibold text-slate-900" title={registration.fullName}>{registration.fullName}</div>
                    <div className={`text-xs text-slate-500 ${fitContainer ? "block truncate" : ""}`} title={fitContainer ? registration.email : undefined}>
                      {registration.email}
                    </div>
                  </td>
                      <td className={`${cellPadding} ${showMemberRoleColumn ? "pr-5" : ""}`}>
                    {registration.youthAgeGroup}
                  </td>
                      <td className={`${cellPadding} ${showMemberRoleColumn ? "pl-5" : ""}`}>
                    {registration.youthClassification}
                  </td>
                  <td className={`${cellPadding} ${fitContainer ? "text-center" : ""}`}>{registration.registeredSKVoter}</td>
                  {!showMemberRoleColumn ? (
                    <td className={`${cellPadding} ${fitContainer ? "text-center" : ""}`}>
                      {String(registration.reviewStatus || "Pending").toLowerCase() === "approved" ? (
                        <span className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full border border-emerald-200/60 bg-emerald-50 ${fitContainer ? "px-2.5 py-0.5 text-xs font-medium" : "px-2.5 py-1 text-[10px] font-bold"} text-emerald-700`}>
                          Approved
                        </span>
                      ) : String(registration.reviewStatus || "").toLowerCase() === "rejected" ? (
                        <div className="flex flex-col items-start gap-1">
                          <span className={`inline-flex max-w-full items-center whitespace-nowrap rounded-full border border-rose-200 bg-rose-50 ${fitContainer ? "px-2.5 py-0.5 text-xs font-medium" : "px-2.5 py-1 text-[10px] font-bold"} text-rose-700`}>
                            Rejected
                          </span>
                          {registration.reviewNotes ? (
                            <span className="max-w-56 truncate text-xs text-slate-500" title={registration.reviewNotes}>
                              Reason: {registration.reviewNotes}
                            </span>
                          ) : null}
                        </div>
                      ) : (
                        registration.requiresManualReview || isKKProfilingManualReview(registration.reviewNotes) ? (
                          <span
                            title={registration.reviewNotes ?? "This registration needs manual review."}
                            className="inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-900"
                          >
                            <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                            Manual Review
                          </span>
                        ) : (
                          <span className="capitalize text-slate-700">{registration.reviewStatus || "Pending"}</span>
                        )
                      )}
                    </td>
                  ) : null}
                  {showMemberRoleColumn ? (
                    <td className={`${cellPadding} ${fitContainer ? "text-center" : ""}`}>
                      {(() => {
                        const statusBadge = getSkeapStatusBadge(registration.skeapStatus);
                        return (
                          <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${statusBadge.className}`}>
                            {statusBadge.label}
                          </span>
                        );
                      })()}
                    </td>
                  ) : (
                    <td className={`${cellPadding} text-slate-500 ${fitContainer ? "whitespace-nowrap" : ""}`}>
                      {formatDate(registration.submittedAt)}
                    </td>
                  )}
                  <td className={`${actionCellPadding} text-center`}>
                    <div className="flex items-center justify-center">
                      <KKProfilingRowActions
                        registration={registration}
                        onUpdate={handleUpdate}
                        onStatusUpdate={handleStatusUpdate}
                        compact={fitContainer}
                        onArchive={archiveAction ? handleArchive : undefined}
                      />
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        {!isLoading && (rows.length === 0 || filteredRows.length === 0) ? (
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
