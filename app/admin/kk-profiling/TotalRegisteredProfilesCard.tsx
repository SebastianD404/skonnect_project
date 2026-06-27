"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";

interface TotalRegisteredProfilesCardProps {
  allTimeCount: number;
  monthlyCount: number;
  weeklyCount: number;
  weeklyMomentum: number;
}

const periods = [
  { key: "all", label: "All time" },
  { key: "month", label: "This month" },
  { key: "week", label: "This week" },
] as const;

type PeriodKey = (typeof periods)[number]["key"];

export default function TotalRegisteredProfilesCard({
  allTimeCount,
  monthlyCount,
  weeklyCount,
  weeklyMomentum,
}: TotalRegisteredProfilesCardProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodKey>("all");

  const count =
    selectedPeriod === "month"
      ? monthlyCount
      : selectedPeriod === "week"
      ? weeklyCount
      : allTimeCount;

  const description =
    selectedPeriod === "month"
      ? "Registered this month."
      : selectedPeriod === "week"
      ? "Registered this week."
      : "All-time registered youth.";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm min-h-0 h-full grid grid-rows-[4rem_auto_auto] gap-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Total registered profiles</p>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">
          <TrendingUp className="h-3 w-3" />
          <span>{weeklyMomentum} in last 7 days</span>
        </div>
      </div>

      <div className="grid gap-3">
        <p className="text-3xl font-black tracking-tight text-slate-950">{count}</p>
        <p className="text-sm text-slate-500">{description}</p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        {periods.map((period) => {
          const selected = selectedPeriod === period.key;
          return (
            <button
              key={period.key}
              type="button"
              onClick={() => setSelectedPeriod(period.key)}
              className={`w-full rounded-full border px-2 py-1 text-[0.62rem] font-semibold transition ${
                selected
                  ? "border-slate-900 bg-slate-950 text-white shadow-sm"
                  : "border-slate-200 bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {period.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
