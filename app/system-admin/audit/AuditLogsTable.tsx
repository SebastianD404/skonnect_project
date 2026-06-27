"use client";

import { useMemo, useState } from "react";
import { Download, Filter, ScrollText, Search } from "lucide-react";

type AuditItem = {
  id: string;
  action: string;
  targetTable: string;
  targetId: string;
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

  const filtered = useMemo(() => {
    const value = query.toLowerCase().trim();
    if (!value) {
      return audits;
    }

    return audits.filter((audit) =>
      [audit.action, audit.actorFullName, audit.actorEmail, audit.targetTable, audit.targetId]
        .join(" ")
        .toLowerCase()
        .includes(value)
    );
  }, [audits, query]);

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
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 text-sm font-medium text-slate-800 transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
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
                  {filtered.map((audit) => (
                    <tr key={audit.id} className="transition hover:bg-[#F8FBFE]">
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                            actionTone[audit.action] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {audit.action}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{audit.actorFullName}</p>
                        <p className="text-xs text-slate-500">{audit.actorEmail}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="font-semibold text-slate-900">{audit.targetTable}</p>
                        <p className="font-mono text-xs text-slate-500">{audit.targetId}</p>
                      </td>
                      <td className="px-6 py-4 text-slate-500 tabular-nums">
                        {new Date(audit.createdAt).toISOString().replace("T", " ").slice(0, 16)} UTC
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-[#E8EEF5] lg:hidden">
              {filtered.map((audit) => (
                <li key={audit.id} className="space-y-2 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <span
                      className={`inline-flex rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                        actionTone[audit.action] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {audit.action}
                    </span>
                    <span className="text-xs text-slate-500 tabular-nums">{audit.createdAt.slice(0, 10)}</span>
                  </div>

                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">{audit.actorFullName}</p>
                    <p className="text-xs text-slate-500">{audit.actorEmail}</p>
                  </div>

                  <div className="text-xs text-slate-500">
                    <span className="font-semibold text-slate-900">{audit.targetTable}</span> ·{" "}
                    <span className="font-mono">{audit.targetId}</span>
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
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
