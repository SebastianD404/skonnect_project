"use client";

import { useState } from "react";

export default function ClassificationBreakdownModal({ classifications }: { classifications: Array<[string, number]> }) {
  const [open, setOpen] = useState(false);

  const sorted = classifications.slice().sort((a, b) => b[1] - a[1]);

  return (
    <div>
      <button
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0D2E47]"
      >
        View full breakdown
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[1.25rem] bg-white p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Full classification breakdown</h3>
              <button onClick={() => setOpen(false)} className="rounded-md px-2 py-1 text-sm text-slate-600">Close</button>
            </div>

            <div className="mt-4 grid gap-2">
              {sorted.map(([label, count]) => (
                <div key={label} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="text-sm text-slate-700">{label}</span>
                  <span className="text-sm font-semibold text-slate-950">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
