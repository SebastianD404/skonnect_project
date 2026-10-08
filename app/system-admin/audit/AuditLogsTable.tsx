"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Download, Filter, ScrollText, Search, X } from "lucide-react";
import {
  getAuditActionSummary,
  getAuditRoleChangeContext,
  getAuditTargetContext,
  getAuditHumanSummary,
  getAuditChanges,
  parseUserAgentLabel,
  shortAuditId,
} from "@/lib/audit/metadata";
import { formatPhilippineTime } from "@/lib/audit/time";

type AuditItem = {
  id: string;
  action: string;
  actorId: string;
  targetTable: string;
  targetId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
  meta?: unknown;
  createdAt: string;
  actorFullName: string;
  actorEmail: string;
};

type Props = {
  audits: AuditItem[];
};

const TIME_RANGES = [
  { label: "Last 24 Hours", value: "24h" },
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 90 Days", value: "90d" },
  { label: "All Time", value: "all" },
] as const;
const AUDIT_REFRESH_INTERVAL_MS = 15_000;

function isAuditItem(value: unknown): value is AuditItem {
  if (typeof value !== "object" || value === null) return false;
  const audit = value as Record<string, unknown>;
  return (
    typeof audit.id === "string" &&
    typeof audit.action === "string" &&
    typeof audit.actorId === "string" &&
    typeof audit.targetTable === "string" &&
    typeof audit.targetId === "string" &&
    typeof audit.createdAt === "string" &&
    typeof audit.actorFullName === "string" &&
    typeof audit.actorEmail === "string"
  );
}

const actionTone: Record<string, string> = {
  ROLE_UPDATED: "bg-[#0F3D5C]/10 text-[#0F3D5C]",
  UPDATE_USER_ROLE: "bg-[#0F3D5C]/10 text-[#0F3D5C]",
  USER_DEACTIVATED: "bg-rose-100 text-rose-700",
  GRANT_APPROVED: "bg-emerald-100 text-emerald-700",
  POLICY_UPDATED: "bg-amber-100 text-amber-700",
  APPROVE_SKEAP_APPLICATION: "bg-emerald-100 text-emerald-700",
  APPLICATION_APPROVED: "bg-emerald-100 text-emerald-700",
  APPLICATION_PROMOTED: "bg-emerald-100 text-emerald-700",
  REJECT_SKEAP_APPLICATION: "bg-rose-100 text-rose-700",
  APPLICATION_REJECTED: "bg-rose-100 text-rose-700",
  MUTATE_GRANTEE_STATUS: "bg-sky-100 text-sky-700",
  GRANTEE_STATUS_CHANGED: "bg-sky-100 text-sky-700",
  OVERRIDE_DEADLINE: "bg-amber-100 text-amber-700",
  APPROVE_ACADEMIC_SUBMISSION: "bg-emerald-100 text-emerald-700",
  DOCUMENT_REVIEWED: "bg-emerald-100 text-emerald-700",
  DOCUMENT_OVERRIDDEN: "bg-amber-100 text-amber-700",
  ADMIN_OCR_OVERRIDE: "bg-amber-100 text-amber-700",
  FLAG_SUBMISSION_FOR_CORRECTION: "bg-amber-100 text-amber-700",
  EXPORT_KK_PROFILING_DATA: "bg-violet-100 text-violet-700",
  RECORDS_EXPORTED: "bg-violet-100 text-violet-700",
  INQUIRY_RESOLVED: "bg-emerald-100 text-emerald-700",
  INQUIRY_REOPENED: "bg-amber-100 text-amber-700",
  MANUAL_PROFILE_UPDATE: "bg-indigo-100 text-indigo-700",
  CREATE_ANNOUNCEMENT: "bg-cyan-100 text-cyan-700",
  DELETE_ANNOUNCEMENT: "bg-rose-100 text-rose-700",
  CREATE_EVENT: "bg-emerald-100 text-emerald-700",
  CANCEL_EVENT: "bg-rose-100 text-rose-700",
};

export default function AuditLogsTable({ audits }: Props) {
  const [query, setQuery] = useState("");
  const [auditItems, setAuditItems] = useState(audits);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRange, setSelectedRange] = useState<(typeof TIME_RANGES)[number]["value"]>("30d");
  const [isRangeMenuOpen, setIsRangeMenuOpen] = useState(false);
  const [isLoadingRange, setIsLoadingRange] = useState(false);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [selectedAudit, setSelectedAudit] = useState<AuditItem | null>(null);
  const rangeMenuRef = useRef<HTMLDivElement>(null);
  const activeRangeLabel = TIME_RANGES.find((range) => range.value === selectedRange)?.label ?? "Last 30 Days";
  const exportHref = query
    ? `/api/system-admin/audit/export?range=${selectedRange}&query=${encodeURIComponent(query)}`
    : `/api/system-admin/audit/export?range=${selectedRange}`;

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (rangeMenuRef.current && !rangeMenuRef.current.contains(event.target as Node)) {
        setIsRangeMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const refreshAuditLogs = useCallback(async (
    range: (typeof TIME_RANGES)[number]["value"],
    { signal, showLoading = false }: { signal?: AbortSignal; showLoading?: boolean } = {}
  ) => {
    if (showLoading) setIsLoadingRange(true);
    try {
      const response = await fetch(`/api/system-admin/audit?range=${range}`, {
        cache: "no-store",
        signal,
      });
      const payload: unknown = await response.json();
      if (!response.ok) {
        const message =
          typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "Unable to load audit logs.";
        throw new Error(message);
      }
      if (typeof payload !== "object" || payload === null || !("audits" in payload) || !Array.isArray(payload.audits)) {
        throw new Error("The audit log response was invalid.");
      }
      if (!payload.audits.every(isAuditItem)) {
        throw new Error("The audit log response was invalid.");
      }

      setAuditItems(payload.audits);
      setRangeError(null);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === "AbortError")) {
        setRangeError(error instanceof Error ? error.message : "Unable to load audit logs.");
      }
    } finally {
      if (showLoading) setIsLoadingRange(false);
    }
  }, []);

  function changeTimeRange(range: (typeof TIME_RANGES)[number]["value"]) {
    if (range === selectedRange) {
      setIsRangeMenuOpen(false);
      return;
    }
    setRangeError(null);
    setIsLoadingRange(true);
    setSelectedRange(range);
    setCurrentPage(1);
    setIsRangeMenuOpen(false);
    setSelectedAudit(null);
  }

  useEffect(() => {
    const controller = new AbortController();
    let isActive = true;
    let isRefreshInProgress = false;
    let isInitialRefresh = true;

    const refreshIfVisible = async () => {
      if (!isActive || isRefreshInProgress || document.visibilityState !== "visible") return;
      isRefreshInProgress = true;
      const showLoading = isInitialRefresh;
      isInitialRefresh = false;
      try {
        await refreshAuditLogs(selectedRange, { signal: controller.signal, showLoading });
      } finally {
        isRefreshInProgress = false;
      }
    };

    void refreshIfVisible();
    const intervalId = window.setInterval(() => void refreshIfVisible(), AUDIT_REFRESH_INTERVAL_MS);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);

    return () => {
      isActive = false;
      controller.abort();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [refreshAuditLogs, selectedRange]);

  const filtered = useMemo(() => {
    const value = query.toLowerCase().trim();
    if (!value) {
      return auditItems;
    }

    return auditItems.filter((audit) => {
      const metadata = getAuditRoleChangeContext(audit);
      return [
        audit.action,
        audit.actorFullName,
        audit.actorEmail,
        audit.targetTable,
        audit.targetId,
        metadata.targetUserName,
        metadata.targetUserEmail,
        metadata.oldRole,
        metadata.newRole,
      ]
        .join(" ")
        .toLowerCase()
        .includes(value);
    });
  }, [auditItems, query]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const displayedPage = Math.min(currentPage, totalPages);
  const startIndex = (displayedPage - 1) * pageSize;
  const currentLogs = filtered.slice(startIndex, startIndex + pageSize);

  const selectedAuditMetadata = useMemo(() => {
    if (!selectedAudit) return null;
    const target = getAuditTargetContext(selectedAudit);
    const roleContext = getAuditRoleChangeContext(selectedAudit);
    return {
      ...roleContext,
      targetLabel: target.label,
      targetSecondary: target.secondary,
    };
  }, [selectedAudit]);

  const selectedSummary = useMemo(() => {
    if (!selectedAudit) return "";
    return getAuditHumanSummary(selectedAudit, selectedAudit.actorFullName || selectedAudit.actorEmail);
  }, [selectedAudit]);

  const selectedChanges = useMemo(() => {
    if (!selectedAudit) return [];
    return getAuditChanges(selectedAudit);
  }, [selectedAudit]);

  const selectedRawPayload = useMemo(() => {
    if (!selectedAudit) return "";
    return JSON.stringify(
      {
        beforeData: selectedAudit.beforeData ?? null,
        afterData: selectedAudit.afterData ?? null,
        metadata: selectedAudit.metadata ?? null,
        meta: selectedAudit.meta ?? null,
      },
      null,
      2
    );
  }, [selectedAudit]);

  const [showRaw, setShowRaw] = useState(false);

  function copyRaw() {
    if (!selectedRawPayload) return;
    navigator.clipboard.writeText(selectedRawPayload);
  }

  function downloadRaw() {
    if (!selectedRawPayload) return;
    const blob = new Blob([selectedRawPayload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-${selectedAudit?.id ?? "payload"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 sm:flex sm:items-center sm:justify-between">
        <div className="relative min-w-0 max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search action, actor, or table..."
            className="h-10 w-full rounded-xl border border-[#CFDBE7] bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B96C6] focus:ring-2 focus:ring-[#4B96C6]/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <div className="relative" ref={rangeMenuRef}>
            <button
              type="button"
              onClick={() => setIsRangeMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={isRangeMenuOpen}
              disabled={isLoadingRange}
              className="inline-flex items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
            >
              <Filter className="h-4 w-4" />
              {isLoadingRange ? "Loading..." : activeRangeLabel}
              <ChevronDown className={`h-4 w-4 transition-transform ${isRangeMenuOpen ? "rotate-180" : ""}`} />
            </button>
            {isRangeMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-30 mt-2 w-48 rounded-xl border border-slate-200 bg-white py-1.5 shadow-xl"
              >
                {TIME_RANGES.map((range) => (
                  <button
                    key={range.value}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selectedRange === range.value}
                    onClick={() => void changeTimeRange(range.value)}
                    className={`w-full px-4 py-2 text-left text-xs font-medium transition-colors ${
                      selectedRange === range.value
                        ? "bg-teal-50 font-bold text-teal-700"
                        : "text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </div>
      </div>

      {rangeError ? (
        <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {rangeError}
        </p>
      ) : null}

      <div className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-900 text-left text-[11px] font-bold tracking-wider text-white uppercase">
                    <th className="px-6 py-4">Action</th>
                    <th className="px-6 py-4">Actor</th>
                    <th className="px-6 py-4">Target</th>
                    <th className="px-6 py-4">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentLogs.map((audit) => {
                    const metadata = getAuditRoleChangeContext(audit);
                    const targetContext = getAuditTargetContext(audit);
                    const summaryText = getAuditActionSummary(audit);
                    const hasRoleDelta =
                      audit.action === "UPDATE_USER_ROLE" &&
                      Boolean(metadata.oldRole || metadata.newRole);

                    return (
                    <tr
                      key={audit.id}
                      className="cursor-pointer transition hover:bg-slate-50/50"
                      onClick={() => setSelectedAudit(audit)}
                    >
                      <td className="max-w-[28rem] px-6 py-4">
                        <div className="flex max-w-md min-w-0 flex-col gap-1.5">
                          <span
                            className={`inline-flex w-fit max-w-full whitespace-normal break-words rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                              actionTone[audit.action] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {audit.action.replace(/_/g, " ")}
                          </span>
                          {summaryText ? (
                            <p
                              className="line-clamp-2 break-words text-xs leading-relaxed text-slate-500 [overflow-wrap:anywhere]"
                              title={summaryText}
                            >
                              {summaryText}
                            </p>
                          ) : null}
                          {hasRoleDelta ? (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs">
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                                {metadata.oldRole || "Unknown"}
                              </span>
                              <span className="text-slate-400">-&gt;</span>
                              <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                                {metadata.newRole || "Unknown"}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{audit.actorFullName}</p>
                        <p className="text-xs text-slate-500">{audit.actorEmail}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-900">{targetContext.label}</span>
                          {targetContext.secondary ? (
                            <span className="text-[11px] text-slate-500">{targetContext.secondary}</span>
                          ) : null}
                          <span className="mt-1 text-[10px] font-mono text-slate-400">{shortAuditId(targetContext.id)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-slate-500 tabular-nums">
                        {formatPhilippineTime(audit.createdAt)}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-slate-100 lg:hidden">
              {currentLogs.map((audit) => {
                const metadata = getAuditRoleChangeContext(audit);
                const targetContext = getAuditTargetContext(audit);
                const summaryText = getAuditActionSummary(audit);
                const hasRoleDelta =
                  audit.action === "UPDATE_USER_ROLE" &&
                  Boolean(metadata.oldRole || metadata.newRole);

                return (
                <li
                  key={audit.id}
                  className="space-y-2 px-6 py-4 transition hover:bg-slate-50/50"
                  onClick={() => setSelectedAudit(audit)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                        actionTone[audit.action] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {audit.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">{formatPhilippineTime(audit.createdAt)}</span>
                  </div>

                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">{audit.actorFullName}</p>
                    <p className="text-xs text-slate-500">{audit.actorEmail}</p>
                  </div>

                  {hasRoleDelta ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 font-medium text-slate-600">
                        {metadata.oldRole || "Unknown"}
                      </span>
                      <span className="text-slate-400">-&gt;</span>
                      <span className="rounded-md bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700">
                        {metadata.newRole || "Unknown"}
                      </span>
                    </div>
                  ) : null}

                  <div className="min-w-0 space-y-1 text-xs text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-900">{targetContext.label}</span>
                      {targetContext.secondary ? <span> · {targetContext.secondary}</span> : null}
                    </div>
                    {summaryText ? (
                      <p
                        className="line-clamp-2 break-words text-slate-500 [overflow-wrap:anywhere]"
                        title={summaryText}
                      >
                        {summaryText}
                      </p>
                    ) : null}
                    <p className="font-mono text-[10px] text-slate-400">{shortAuditId(targetContext.id)}</p>
                  </div>
                </li>
                );
              })}
            </ul>
          </>
        )}
        <div className="mt-auto flex flex-col items-center justify-between gap-4 border-t border-slate-200/80 bg-slate-50/50 px-4 py-4 sm:flex-row sm:px-6">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            <p className="text-xs font-medium text-slate-500">
              Showing{" "}
              <span className="font-bold text-slate-900">{filtered.length > 0 ? startIndex + 1 : 0}</span>
              {" "}to{" "}
              <span className="font-bold text-slate-900">{Math.min(startIndex + pageSize, filtered.length)}</span>
              {" "}of{" "}
              <span className="font-bold text-slate-900">{filtered.length}</span> entries
            </p>
            <label className="flex items-center gap-1.5 border-l border-slate-200 pl-4 text-[11px] font-medium text-slate-400">
              <span>Show</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setCurrentPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-cyan-600"
              >
                <option value={10}>10 rows</option>
                <option value={20}>20 rows</option>
                <option value={50}>50 rows</option>
              </select>
            </label>
          </div>

          <nav aria-label="Audit log pagination" className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentPage(Math.max(displayedPage - 1, 1))}
              disabled={displayedPage === 1 || filtered.length === 0}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
              Previous
            </button>
            <span aria-live="polite" className="px-2 text-xs font-bold text-slate-700">
              Page {filtered.length === 0 ? 0 : displayedPage} of {filtered.length === 0 ? 0 : totalPages}
            </span>
            <button
              type="button"
              onClick={() => setCurrentPage(Math.min(displayedPage + 1, totalPages))}
              disabled={displayedPage === totalPages || filtered.length === 0}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>

      {selectedAudit ? (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" onClick={() => setSelectedAudit(null)}>
          <aside
            className="h-full w-full max-w-xl overflow-y-auto bg-white p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Audit details</p>
                <h3 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
                  {selectedAudit.action.replace(/_/g, " ")}
                </h3>
                <p className="mt-2 max-w-xl text-sm text-slate-600">{selectedSummary}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAudit(null)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="Close audit details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Timestamp</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{formatPhilippineTime(selectedAudit.createdAt)}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Actor</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{selectedAudit.actorFullName}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedAudit.actorEmail}</p>
                <p className="mt-1 truncate font-mono text-xs text-slate-500" title={selectedAudit.actorId}>
                  ID: {shortAuditId(selectedAudit.actorId)}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Target</p>
                <p className="mt-2 text-sm font-medium text-slate-900">{selectedAuditMetadata?.targetLabel || selectedAudit.targetTable}</p>
                <p className="mt-1 text-sm text-slate-500">{selectedAuditMetadata?.targetSecondary || selectedAudit.targetId}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">IP address</p>
                <p className="mt-2 font-mono text-sm text-slate-700">{selectedAuditMetadata?.ipAddress || "Unavailable"}</p>
                <p className="mt-2 text-sm text-slate-700">{parseUserAgentLabel(selectedAuditMetadata?.userAgent)}</p>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Modifications</p>
              {selectedChanges.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">No explicit field changes detected.</p>
              ) : (
                <div className="mt-3 overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
                  <table className="w-full table-fixed text-sm">
                    <thead className="bg-slate-900 text-left text-[11px] font-bold tracking-wider text-white uppercase">
                      <tr>
                        <th className="w-1/4 px-4 py-4">Field</th>
                        <th className="w-[37.5%] px-4 py-4">Before</th>
                        <th className="w-[37.5%] px-4 py-4">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedChanges.map((c) => (
                        <tr key={c.field} className="transition hover:bg-slate-50/50">
                          <td className="break-words px-4 py-4 align-top font-medium text-slate-900 [overflow-wrap:anywhere]">{c.field}</td>
                          <td className="px-4 py-4 align-top text-slate-600">
                            <div className="custom-scroll max-h-48 overflow-auto whitespace-pre-wrap break-words pr-2 [overflow-wrap:anywhere]">
                              {c.before}
                            </div>
                          </td>
                          <td className="px-4 py-4 align-top font-semibold text-slate-900">
                            <div className="custom-scroll max-h-48 overflow-auto whitespace-pre-wrap break-words pr-2 [overflow-wrap:anywhere]">
                              {c.after}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-950 p-5 text-sm text-slate-100">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Raw payload</p>
                  <span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-300">JSON</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRaw((s) => !s)}
                    aria-expanded={showRaw}
                    className="rounded-md bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                  >
                    {showRaw ? "Hide raw" : "Show raw JSON"}
                  </button>
                  <button
                    type="button"
                    onClick={copyRaw}
                    className="rounded-md bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                    aria-label="Copy JSON to clipboard"
                  >
                    Copy
                  </button>
                  <button
                    type="button"
                    onClick={downloadRaw}
                    className="rounded-md bg-white/5 px-3 py-1 text-xs text-slate-200 transition hover:bg-white/10"
                    aria-label="Download JSON"
                  >
                    Download
                  </button>
                </div>
              </div>

              {showRaw ? (
                <pre className="mt-3 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words text-[12px] leading-5 text-slate-200">
                  {selectedRawPayload}
                </pre>
              ) : (
                <div className="mt-3 rounded-lg border border-slate-800/30 bg-slate-900/40 p-4 text-sm text-slate-300">
                  <p className="text-sm">Parsed fields shown above. Expand to view the full JSON payload.</p>
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-20 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-700">
        <ScrollText className="h-5 w-5" />
      </div>
      <h3 className="text-xl font-black text-slate-900">No audit entries found.</h3>
      <p className="max-w-sm text-sm text-slate-500">
        Audit entries will appear here once the app starts writing system change logs.
      </p>
    </div>
  );
}
