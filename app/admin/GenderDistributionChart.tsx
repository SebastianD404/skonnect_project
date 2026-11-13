"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { ScholarDistributionAnalytics } from "@/lib/admin-scholar-analytics";

type GenderDistribution = ScholarDistributionAnalytics["genderDistribution"];

const SERIES = [
  { key: "male", label: "Male", color: "#0F3D5C" },
  { key: "female", label: "Female", color: "#0891B2" },
  { key: "notSpecified", label: "Not specified", color: "#94A3B8" },
] as const;

export function GenderDistributionChart({ data }: { data: GenderDistribution }) {
  const total = data.male + data.female + data.notSpecified;
  const chartData = SERIES.map((series) => ({
    name: series.label,
    count: data[series.key],
    color: series.color,
  }));

  return (
    <section
      aria-labelledby="gender-distribution-title"
      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
    >
      <header>
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
          Demographics
        </p>
        <h2 id="gender-distribution-title" className="mt-1 text-lg font-bold tracking-tight text-slate-900">
          Gender Distribution
        </h2>
        <p className="mt-1 text-sm text-slate-500">Verified KK profiles by sex</p>
      </header>

      <div className="mt-4 grid items-center gap-4 sm:grid-cols-[minmax(150px,1fr)_minmax(140px,1fr)]">
        <div
          role="img"
          aria-label={`Gender distribution: ${data.male} male, ${data.female} female, ${data.notSpecified} not specified`}
          className="relative mx-auto h-48 w-full max-w-[220px]"
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                dataKey="count"
                nameKey="name"
                innerRadius="66%"
                outerRadius="88%"
                paddingAngle={total > 0 ? 3 : 0}
                stroke="white"
                strokeWidth={2}
              >
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value) => [Number(value).toLocaleString("en-PH"), "Youth"]}
                contentStyle={{
                  borderRadius: "0.75rem",
                  borderColor: "#E2E8F0",
                  fontSize: "0.75rem",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {total.toLocaleString("en-PH")}
            </span>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Total youth
            </span>
          </div>
        </div>

        <ul className="space-y-3">
          {SERIES.map((series) => {
            const count = data[series.key];
            const percentage = total > 0 ? Math.round((count / total) * 100) : 0;
            return (
              <li key={series.key} className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: series.color }}
                  />
                  <span className="truncate text-sm font-medium text-slate-600">{series.label}</span>
                </div>
                <span className="shrink-0 text-right">
                  <span className="block text-sm font-semibold tabular-nums text-slate-900">
                    {count.toLocaleString("en-PH")}
                  </span>
                  <span className="block text-[11px] tabular-nums text-slate-400">{percentage}%</span>
                </span>
              </li>
            );
          })}
          {total === 0 ? (
            <li className="text-xs leading-relaxed text-slate-400">No verified youth records yet.</li>
          ) : null}
        </ul>
      </div>
    </section>
  );
}
