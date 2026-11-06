"use client";

import { useRef } from "react";
import { Download } from "lucide-react";
import AdminExportButton from "../AdminExportButton";

const exports = [
  { filter: "all_approved", label: "Export All" },
  { filter: "grantees_only", label: "Export Grantees" },
  { filter: "kk_only", label: "Export Registered Youth" },
] as const;

export function MembersExportMenu() {
  const menuRef = useRef<HTMLDetailsElement>(null);

  return (
    <details
      ref={menuRef}
      onClick={(event) => {
        if (event.target instanceof HTMLElement && event.target.closest("button")) {
          menuRef.current?.removeAttribute("open");
        }
      }}
      className="relative shrink-0 self-start sm:self-auto"
    >
      <summary className="inline-flex cursor-pointer list-none items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900">
        <Download aria-hidden="true" className="h-3.5 w-3.5 text-slate-400" />
        <span>Export Profiles</span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 flex w-56 flex-col gap-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
        {exports.map(({ filter, label }) => (
          <AdminExportButton
            key={filter}
            href={`/api/admin/members/export?filter=${filter}`}
            label={label}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-medium text-slate-700 transition hover:bg-slate-50"
            iconClassName="h-4 w-4 shrink-0 text-slate-400"
          />
        ))}
      </div>
    </details>
  );
}
