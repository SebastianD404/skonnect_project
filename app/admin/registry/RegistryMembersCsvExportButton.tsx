"use client";

import { Download } from "lucide-react";
import { useRegistryMembersViewRows } from "./RegistryMembersViewRowsContext";
import { useRegistryMembersSearchStatus } from "./RegistryMembersSearchStatus";
import { getSkeapStatusBadge } from "../kk-profiling/KKProfilingRegistrationsTable";
import { buildRegistryViewCsv } from "./registry-view-csv";

export function RegistryMembersCsvExportButton() {
  const rows = useRegistryMembersViewRows() ?? [];
  const isSearching = useRegistryMembersSearchStatus()?.isSearching ?? false;

  const exportView = () => {
    if (rows.length === 0 || isSearching) return;

    const csv = buildRegistryViewCsv(rows.map((row) => ({
      name: row.fullName,
      email: row.email,
      ageGroup: row.youthAgeGroup,
      classification: row.youthClassification,
      skVoter: row.registeredSKVoter,
      skeapStatus: getSkeapStatusBadge(row.skeapStatus).label,
    })));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "profiled-youth-view.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <button
      type="button"
      onClick={exportView}
      disabled={rows.length === 0 || isSearching}
      aria-busy={isSearching}
      className="inline-flex h-9 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <Download aria-hidden="true" className="h-3.5 w-3.5" />
      <span>Export View (CSV)</span>
    </button>
  );
}
