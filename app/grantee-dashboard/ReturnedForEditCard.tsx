"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

type Props = {
  count?: number;
  className?: string;
};

export default function ReturnedForEditCard({ count = 0, className = "" }: Props) {
  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md ${className}`}
      role="region"
      aria-label="Returned for Edit submissions"
    >
      <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 opacity-10 blur-2xl transition group-hover:opacity-20`} />

      <div className="relative flex items-center justify-between">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset bg-amber-50 text-amber-700 ring-amber-200`}>
          <AlertTriangle className="h-4 w-4" />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">ACTION REQUIRED</span>
      </div>

      <div className="relative mt-4 text-3xl font-semibold tracking-tight text-slate-900">{count}</div>
      <div className="relative mt-1 text-xs text-slate-500">Submissions needing your attention</div>
    </div>
  );
}
