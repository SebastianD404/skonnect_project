"use client";

import { ChevronDown, Download } from "lucide-react";

const REPORT_OPTIONS = [
  { status: "all", label: "Export All Archives" },
  { status: "graduated", label: "Export Graduated Alumni" },
  { status: "removed", label: "Export Removed Scholars" },
] as const;

export default function GranteeArchiveExportMenu() {
  return (
    <details className="group relative shrink-0">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-xl bg-[#0F3D5C] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
        <Download className="h-4 w-4" aria-hidden="true" />
        Export Reports
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
        {REPORT_OPTIONS.map(({ status, label }) => (
          <a
            key={status}
            href={`/api/admin/grantees/records/export?status=${status}`}
            className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-950 focus-visible:bg-slate-50 focus-visible:outline-none"
          >
            <Download className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            {label}
          </a>
        ))}
      </div>
    </details>
  );
}
