"use client";

import { useRef, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ScholarDistributionAnalytics } from "@/lib/admin-scholar-analytics";
import AnalyticsExportMenu from "./AnalyticsExportMenu";
import { exportAnalyticsCardAsPng, exportAnalyticsTable } from "./analytics-export";

type DemographicsData = Pick<
  ScholarDistributionAnalytics,
  "genderDistribution" | "youthGenderDistribution" | "yearLevelDistribution" | "programOutcomes"
>;

const SEX_SERIES = [
  { key: "male", label: "Male", color: "#0ea5e9" },
  { key: "female", label: "Female", color: "#8b5cf6" },
  { key: "notSpecified", label: "Not specified", color: "#cbd5e1" },
] as const;

export default function DemographicsSection({ data }: { data: DemographicsData }) {
  const sexCardRef = useRef<HTMLElement | null>(null);
  const yearCardRef = useRef<HTMLElement | null>(null);
  const outcomesCardRef = useRef<HTMLElement | null>(null);
  const [sexPopulation, setSexPopulation] = useState<"youth" | "grantee">("youth");
  const selectedGenderDistribution =
    sexPopulation === "youth" ? data.youthGenderDistribution : data.genderDistribution;
  const totalBySex =
    selectedGenderDistribution.male +
    selectedGenderDistribution.female +
    selectedGenderDistribution.notSpecified;
  const sexData = SEX_SERIES.map((series) => ({
    name: series.label,
    count: selectedGenderDistribution[series.key],
    color: series.color,
  }));
  const outcomes = [
    {
      label: "Active Grantees",
      count: data.programOutcomes.activeGrantees,
      dotColor: "bg-emerald-500",
    },
    {
      label: "Graduated",
      count: data.programOutcomes.graduated,
      dotColor: "bg-indigo-500",
    },
    {
      label: "Removed / Revoked",
      count: data.programOutcomes.removedOrRevoked,
      dotColor: "bg-rose-500",
    },
  ];
  const totalOutcomes = outcomes.reduce((total, outcome) => total + outcome.count, 0);

  const exportSexImage = () =>
    exportAnalyticsCardAsPng(
      sexCardRef.current,
      sexPopulation === "youth"
        ? "youth-population-by-sex.png"
        : "skeap-grantee-population-by-sex.png",
    );
  const exportSexTable = () =>
    exportAnalyticsTable({
      fileName:
        sexPopulation === "youth"
          ? "youth-population-by-sex.xlsx"
          : "skeap-grantee-population-by-sex.xlsx",
      sheetName: sexPopulation === "youth" ? "Youth by Sex" : "Grantees by Sex",
      title:
        sexPopulation === "youth"
          ? "Youth Population by Sex"
          : "Grantee Population by Sex",
      headers: ["Sex", sexPopulation === "youth" ? "Total Youth" : "Total Grantees"],
      rows: sexData.map(({ name, count }) => [name, count]),
    });
  const exportYearImage = () =>
    exportAnalyticsCardAsPng(yearCardRef.current, "skeap-scholars-by-year-level.png");
  const exportYearTable = () =>
    exportAnalyticsTable({
      fileName: "skeap-scholars-by-year-level.xlsx",
      sheetName: "Scholars by Year",
      title: "SKEAP Scholars by Year Level",
      headers: ["Year Level", "Scholars"],
      rows: data.yearLevelDistribution.map(({ yearLevel, count }) => [yearLevel, count]),
    });
  const exportOutcomesImage = () =>
    exportAnalyticsCardAsPng(outcomesCardRef.current, "skeap-program-outcomes.png");
  const exportOutcomesTable = () =>
    exportAnalyticsTable({
      fileName: "skeap-program-outcomes.xlsx",
      sheetName: "Program Outcomes",
      title: "SKEAP Program Outcomes",
      headers: ["Program Outcome", "Scholars", "Percentage"],
      rows: outcomes.map(({ label, count }) => [
        label,
        count,
        totalOutcomes > 0 ? Math.round((count / totalOutcomes) * 100) : 0,
      ]),
    });

  return (
    <section aria-labelledby="demographics-heading">
      <div className="flex items-center gap-4 py-2">
        <h2
          id="demographics-heading"
          className="text-[10px] font-bold uppercase tracking-widest text-slate-400"
        >
          Demographics
        </h2>
        <div aria-hidden="true" className="h-px flex-1 rounded-full bg-slate-200/60" />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <section
          ref={sexCardRef}
          aria-labelledby="youth-by-sex-title"
          className="min-h-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <header className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <h3 id="youth-by-sex-title" className="text-base font-bold text-slate-900">
                {sexPopulation === "youth" ? "Youth Population by Sex" : "Grantee Population by Sex"}
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                {sexPopulation === "youth"
                  ? "Across the entire KK youth registry"
                  : "Across all SKEAP grantee statuses"}
              </p>
              <div
                role="group"
                aria-label="Sex distribution population"
                className="mt-3 inline-flex rounded-full bg-slate-100 p-1"
              >
                <button
                  type="button"
                  aria-pressed={sexPopulation === "youth"}
                  onClick={() => setSexPopulation("youth")}
                  className={`rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                    sexPopulation === "youth"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  Youth
                </button>
                <button
                  type="button"
                  aria-pressed={sexPopulation === "grantee"}
                  onClick={() => setSexPopulation("grantee")}
                  className={`rounded-full px-2.5 py-1.5 text-[10px] font-semibold transition-colors ${
                    sexPopulation === "grantee"
                      ? "bg-slate-800 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-200"
                  }`}
                >
                  Grantees
                </button>
              </div>
            </div>
            <AnalyticsExportMenu
              label={sexPopulation === "youth" ? "youth population by sex" : "grantee population by sex"}
              onExportImage={exportSexImage}
              onExportTable={exportSexTable}
            />
          </header>
          <div className="mt-3 h-[190px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={sexData}
                  dataKey="count"
                  nameKey="name"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={totalBySex > 0 ? 3 : 0}
                  stroke="#ffffff"
                  strokeWidth={2}
                >
                  {sexData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <text
                  x="50%"
                  y="47%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#0f172a"
                  fontSize="20"
                  fontWeight="700"
                  aria-hidden="true"
                >
                  {totalBySex.toLocaleString("en-PH")}
                </text>
                <text
                  x="50%"
                  y="59%"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#94a3b8"
                  fontSize="10"
                  fontWeight="600"
                  aria-hidden="true"
                >
                  {sexPopulation === "youth" ? "Youth" : "Grantees"}
                </text>
                <Tooltip
                  formatter={(value) => [Number(value).toLocaleString("en-PH"), "Youth"]}
                  contentStyle={{ borderRadius: "0.75rem", borderColor: "#e2e8f0", fontSize: "0.75rem" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="mt-2 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
            {SEX_SERIES.map((series) => (
              <li key={series.key} className="flex items-center gap-1.5 text-xs text-slate-600">
                <span
                  aria-hidden="true"
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: series.color }}
                />
                <span>{series.label}</span>
                <span className="font-semibold tabular-nums text-slate-800">
                  {selectedGenderDistribution[series.key].toLocaleString("en-PH")}
                </span>
              </li>
            ))}
          </ul>
          {totalBySex === 0 ? (
            <p className="mt-2 text-center text-xs text-slate-400">
              No {sexPopulation === "youth" ? "KK youth" : "SKEAP grantee"} records yet.
            </p>
          ) : null}
        </section>

        <section
          ref={yearCardRef}
          aria-labelledby="scholars-by-year-title"
          className="min-h-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <header className="flex items-start gap-2">
            <div className="min-w-0">
              <h3 id="scholars-by-year-title" className="text-base font-bold text-slate-900">
                Scholars by Year Level
              </h3>
              <p className="mt-1 text-xs text-slate-500">1st through 4th year</p>
            </div>
            <AnalyticsExportMenu
              label="scholars by year level"
              onExportImage={exportYearImage}
              onExportTable={exportYearTable}
            />
          </header>
          <div role="img" aria-label="SKEAP scholars by academic year level" className="mt-4 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.yearLevelDistribution} margin={{ top: 10, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis
                  dataKey="yearLevel"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#64748b", fontSize: 10 }}
                  interval={0}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  tick={{ fill: "#94a3b8", fontSize: 10 }}
                  width={34}
                />
                <Tooltip
                  formatter={(value) => [Number(value).toLocaleString("en-PH"), "Scholars"]}
                  contentStyle={{ borderRadius: "0.75rem", borderColor: "#e2e8f0", fontSize: "0.75rem" }}
                />
                <Bar dataKey="count" name="Scholars" fill="#0ea5e9" radius={[4, 4, 0, 0]} maxBarSize={38} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section
          ref={outcomesCardRef}
          aria-labelledby="program-outcomes-title"
          className="min-h-[320px] rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <header className="flex items-start gap-2">
            <div className="min-w-0">
              <h3 id="program-outcomes-title" className="text-base font-bold text-slate-900">
                Program Outcomes
              </h3>
              <p className="mt-1 text-xs text-slate-500">Historical SKEAP grantee records</p>
            </div>
            <AnalyticsExportMenu
              label="program outcomes"
              onExportImage={exportOutcomesImage}
              onExportTable={exportOutcomesTable}
            />
          </header>
          <div className="mt-4">
            {outcomes.map(({ label, count, dotColor }) => (
              <div
                key={label}
                className="flex items-center justify-between border-b border-slate-100 py-3 last:border-0"
              >
                <div className="flex items-center gap-2.5">
                  <span aria-hidden="true" className={`h-2 w-2 rounded-full ${dotColor}`} />
                  <span className="font-medium text-slate-700">{label}</span>
                </div>
                <div className="flex items-center">
                  <span className="text-lg font-bold tabular-nums text-slate-900">
                    {count.toLocaleString("en-PH")}
                  </span>
                  <span className="ml-2 text-xs tabular-nums text-slate-400">
                    {totalOutcomes > 0 ? Math.round((count / totalOutcomes) * 100) : 0}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}
