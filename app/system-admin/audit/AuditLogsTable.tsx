"use client";

import { useMemo, useState } from "react";
import { Download, Filter, ScrollText, Search, X } from "lucide-react";
import { getAuditRoleChangeContext, shortAuditId } from "@/lib/audit/metadata";
import { formatPhilippineTime } from "@/lib/audit/time";

type AuditItem = {
  id: string;
  action: string;
  targetTable: string;
  targetId: string;
  beforeData?: unknown;
  afterData?: unknown;
  metadata?: unknown;
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
    return getAuditRoleChangeContext(selectedAudit);
  }, [selectedAudit]);

  const selectedRawPayload = useMemo(() => {
    if (!selectedAudit) return "";
    return JSON.stringify(
      {
        beforeData: selectedAudit.beforeData ?? null,
        afterData: selectedAudit.afterData ?? null,
        metadata: selectedAudit.metadata ?? null,
      },
      null,
      2
    );
  }, [selectedAudit]);

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
                            {audit.action}
                          </span>
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
                        {audit.action === "UPDATE_USER_ROLE" ? (
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold text-slate-900">{metadata.targetUserName || metadata.targetUserEmail || "Unknown user"}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{shortAuditId(metadata.targetUserId || audit.targetId)}</span>
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold text-slate-900">{audit.targetTable}</p>
                            <p className="font-mono text-xs text-slate-500">{audit.targetId}</p>
                          </>
                        )}
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
                      {audit.action}
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

                  <div className="text-xs text-slate-500">
                    {audit.action === "UPDATE_USER_ROLE" ? (
                      <span>
                        <span className="font-semibold text-slate-900">
                          {metadata.targetUserName || metadata.targetUserEmail || "Unknown user"}
                        </span>{" "}
                        · <span className="font-mono">{shortAuditId(metadata.targetUserId || audit.targetId)}</span>
                      </span>
                    ) : (
                      <span>
                        <span className="font-semibold text-slate-900">{audit.targetTable}</span> ·{" "}
                        <span className="font-mono">{audit.targetId}</span>
                      </span>
                    )}
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
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Audit details</p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{selectedAudit.action}</h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAudit(null)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100"
                aria-label="Close audit details"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <dl className="mt-6 grid grid-cols-[120px_minmax(0,1fr)] gap-y-3 text-sm">
              <dt className="text-slate-500">Timestamp</dt>
              <dd className="font-medium text-slate-900">{formatPhilippineTime(selectedAudit.createdAt)}</dd>
              <dt className="text-slate-500">Actor</dt>
              <dd className="font-medium text-slate-900">{selectedAudit.actorFullName} ({selectedAudit.actorEmail})</dd>
              <dt className="text-slate-500">Target</dt>
              <dd className="font-medium text-slate-900">{selectedAudit.targetTable} · {selectedAudit.targetId}</dd>
              <dt className="text-slate-500">IP address</dt>
              <dd className="font-mono text-xs text-slate-700">{selectedAuditMetadata?.ipAddress || "Unavailable"}</dd>
            </dl>

            <div className="mt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Raw payload (JSON)</p>
              <pre className="mt-2 max-h-[28rem] overflow-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                {selectedRawPayload}
              </pre>
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
