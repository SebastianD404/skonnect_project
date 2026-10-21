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
      className={`relative min-h-[160px] p-5 ${className}`}
      role="region"
      aria-label="Returned for Edit submissions"
    >
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
