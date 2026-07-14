"use client";

import { useMemo, useState } from "react";
import { Download, Filter, ScrollText, Search, X } from "lucide-react";
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

const actionTone: Record<string, string> = {
  ROLE_UPDATED: "bg-[#0F3D5C]/10 text-[#0F3D5C]",
  UPDATE_USER_ROLE: "bg-[#0F3D5C]/10 text-[#0F3D5C]",
  USER_DEACTIVATED: "bg-rose-100 text-rose-700",
  GRANT_APPROVED: "bg-emerald-100 text-emerald-700",
  POLICY_UPDATED: "bg-amber-100 text-amber-700",
  APPROVE_SKEAP_APPLICATION: "bg-emerald-100 text-emerald-700",
  REJECT_SKEAP_APPLICATION: "bg-rose-100 text-rose-700",
  MUTATE_GRANTEE_STATUS: "bg-sky-100 text-sky-700",
  OVERRIDE_DEADLINE: "bg-amber-100 text-amber-700",
  APPROVE_ACADEMIC_SUBMISSION: "bg-emerald-100 text-emerald-700",
  FLAG_SUBMISSION_FOR_CORRECTION: "bg-amber-100 text-amber-700",
  EXPORT_KK_PROFILING_DATA: "bg-violet-100 text-violet-700",
  MANUAL_PROFILE_UPDATE: "bg-indigo-100 text-indigo-700",
  CREATE_ANNOUNCEMENT: "bg-cyan-100 text-cyan-700",
  DELETE_ANNOUNCEMENT: "bg-rose-100 text-rose-700",
  CREATE_EVENT: "bg-emerald-100 text-emerald-700",
  CANCEL_EVENT: "bg-rose-100 text-rose-700",
};

export default function AuditLogsTable({ audits }: Props) {
  const [query, setQuery] = useState("");
  const [selectedAudit, setSelectedAudit] = useState<AuditItem | null>(null);
  const exportHref = query
    ? `/api/system-admin/audit/export?query=${encodeURIComponent(query)}`
    : "/api/system-admin/audit/export";

  const filtered = useMemo(() => {
    const value = query.toLowerCase().trim();
    if (!value) {
      return audits;
    }

    return audits.filter((audit) => {
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
  }, [audits, query]);

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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search action, actor, or table..."
            className="h-10 w-full rounded-xl border border-[#CFDBE7] bg-white pl-9 pr-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#4B96C6] focus:ring-2 focus:ring-[#4B96C6]/20"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            <Filter className="h-4 w-4" />
            Last 30 days
          </button>
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </a>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#D6E1EC] bg-white shadow-sm">
        {filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <div className="hidden lg:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#E4ECF3] bg-[#F7FAFD] text-left text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Actor</th>
                    <th className="px-6 py-3">Target</th>
                    <th className="px-6 py-3">Recorded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EEF5]">
                  {filtered.map((audit) => {
                    const metadata = getAuditRoleChangeContext(audit);
                    const targetContext = getAuditTargetContext(audit);
                    const summaryText = getAuditActionSummary(audit);
                    const hasRoleDelta =
                      audit.action === "UPDATE_USER_ROLE" &&
                      Boolean(metadata.oldRole || metadata.newRole);

                    return (
                    <tr
                      key={audit.id}
                      className="cursor-pointer transition hover:bg-[#F8FBFE]"
                      onClick={() => setSelectedAudit(audit)}
                    >
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <span
                            className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                              actionTone[audit.action] ?? "bg-slate-100 text-slate-600"
                            }`}
                          >
                            {audit.action.replace(/_/g, " ")}
                          </span>
                          {summaryText ? (
                            <p className="text-xs leading-5 text-slate-500">{summaryText}</p>
                          ) : null}
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

            <ul className="divide-y divide-[#E8EEF5] lg:hidden">
              {filtered.map((audit) => {
                const metadata = getAuditRoleChangeContext(audit);
                const targetContext = getAuditTargetContext(audit);
                const summaryText = getAuditActionSummary(audit);
                const hasRoleDelta =
                  audit.action === "UPDATE_USER_ROLE" &&
                  Boolean(metadata.oldRole || metadata.newRole);

                return (
                <li
                  key={audit.id}
                  className="space-y-2 p-5 transition hover:bg-[#F8FBFE]"
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

                  <div className="space-y-1 text-xs text-slate-500">
                    <div>
                      <span className="font-semibold text-slate-900">{targetContext.label}</span>
                      {targetContext.secondary ? <span> · {targetContext.secondary}</span> : null}
                    </div>
                    {summaryText ? <p className="text-slate-500">{summaryText}</p> : null}
                    <p className="font-mono text-[10px] text-slate-400">{shortAuditId(targetContext.id)}</p>
                  </div>
                </li>
                );
              })}
            </ul>
          </>
        )}
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
                <div className="mt-3 overflow-hidden rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-4 py-2">Field</th>
                        <th className="px-4 py-2">Before</th>
                        <th className="px-4 py-2">After</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedChanges.map((c) => (
                        <tr key={c.field}>
                          <td className="px-4 py-3 font-medium text-slate-900">{c.field}</td>
                          <td className="px-4 py-3 text-slate-600">{c.before}</td>
                          <td className="px-4 py-3 text-slate-900 font-semibold">{c.after}</td>
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
