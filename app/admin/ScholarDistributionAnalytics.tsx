"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import pet from "@/public/SKPet.png";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import type { ScholarDistributionAnalytics as Analytics } from "@/lib/admin-scholar-analytics";
import AnalyticsExportMenu from "./AnalyticsExportMenu";
import { exportAnalyticsCardAsPng, exportAnalyticsTable } from "./analytics-export";

export type DashboardMetricKey = "totalYouth" | "skeapSlot" | "skeapPending" | "kkPending";

export type DashboardMetricCardData = {
  key: DashboardMetricKey;
  href: string;
  label: string;
  value: number | string;
  subtitle: string;
  icon: LucideIcon;
  featured?: boolean;
};

function MetricCard({
  href,
  label,
  value,
  subtitle,
  icon: Icon,
  featured = false,
}: Omit<DashboardMetricCardData, "key">) {
  const valueLabel = typeof value === "number" ? value.toLocaleString("en-PH") : value;

  return (
    <Link
      href={href}
      aria-label={`${label}: ${value}. ${subtitle}`}
      className="group relative flex h-[132px] min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card-wash p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-card-active active:shadow-card-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-glow/70 blur-2xl transition-opacity duration-300 group-hover:bg-glow" />
      <div className="relative z-10 flex min-w-0 items-center justify-between gap-3">
        <p className="eyebrow min-w-0 truncate text-brand">{label}</p>
        <div className="flex shrink-0 items-center gap-2">
          <span className={`flex h-9 w-9 items-center justify-center rounded-full ${
            featured
              ? "bg-brand text-primary-foreground shadow-sm"
              : "bg-glow text-brand ring-1 ring-brand/10"
          }`}>
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <ArrowUpRight aria-hidden="true" className="h-4 w-4 text-brand/50" />
        </div>
      </div>
      <div className="relative z-10 min-w-0">
        <p className="truncate text-[1.75rem] font-black leading-none tracking-tight text-ink">
          {valueLabel}
        </p>
        <p className="mt-1 truncate text-[11px] leading-tight text-ink/65">{subtitle}</p>
      </div>
    </Link>
  );
}

function ScholarshipAssistant() {
  return (
    <div
      role="img"
      aria-label="Scholarship assistant"
      className="relative hidden h-[132px] w-[180px] items-center justify-center xl:flex"
    >
      <div className="sk-pet">
        <div className="sk-pet-glow" aria-hidden="true" />
        <div className="sk-pet-orbit" aria-hidden="true" />
        <Image
          src={pet}
          alt=""
          width={132}
          height={132}
          draggable={false}
          className="sk-pet-img"
        />
        <span className="sk-pet-shadow" aria-hidden="true" />
      </div>
    </div>
  );
}

export default function ScholarDistributionAnalytics({
  analytics,
  metricCards,
}: {
  analytics: Analytics;
  metricCards: DashboardMetricCardData[];
}) {
  const [chartView, setChartView] = useState<"population" | "scholars">("population");
  const chartCardRef = useRef<HTMLElement>(null);
  const capacity = analytics.maxSlots;
  const capacityOverage = analytics.capacityUsed - capacity;
  const isPopulationView = chartView === "population";
  const chartTitle = isPopulationView
    ? "Youth Population by Sitio"
    : "SKEAP Grantee Distribution by Sitio";
  const chartSubtitle = isPopulationView
    ? "Approved KK-profiled youth across Barangay Pico."
    : "Active and approved SKEAP grantees across Barangay Pico.";
  const chartLabel = isPopulationView ? "Approved KK youth" : "SKEAP grantees";
  const chartData = isPopulationView
    ? analytics.populationDistribution.map(({ sitio, population }) => ({ sitio, value: population }))
    : analytics.scholarDistribution.map(({ sitio, scholars }) => ({ sitio, value: scholars }));

  const exportChartAsPng = () =>
    exportAnalyticsCardAsPng(
      chartCardRef.current,
      isPopulationView
        ? "youth-population-by-sitio.png"
        : "skeap-grantee-distribution-by-sitio.png",
    );
  const exportAnalyticsToExcel = () => {
    const reportTitle = isPopulationView
      ? "Barangay Pico - Youth Population by Sitio"
      : "Barangay Pico - SKEAP Grantee Distribution by Sitio";
    exportAnalyticsTable({
      fileName: isPopulationView
        ? "youth-population-by-sitio.xlsx"
        : "skeap-grantee-distribution-by-sitio.xlsx",
      sheetName: "Sitio Analytics",
      title: reportTitle,
      headers: ["Sitio Name", isPopulationView ? "Total Profiled Youth" : "Total SKEAP Grantees"],
      rows: chartData.map(({ sitio, value }) => [sitio, value]),
    });
  };

  return (
    <>
      {capacityOverage > 0 ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-rose-900">
              SKEAP capacity exceeded by {capacityOverage}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-rose-800">
              {analytics.capacityUsed} active records are counted against a {capacity}-slot {capacity === 55 ? "hard maximum" : "configured limit"}. New approvals and promotions are blocked; existing grants are not changed automatically.
            </p>
          </div>
          <Link href="/admin/skeap/active" className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-2 text-center text-xs font-semibold text-rose-800 transition hover:bg-rose-100">
            Review active grantees
          </Link>
        </div>
      ) : null}
      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_180px] xl:items-center">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {metricCards.map(({ key, ...metric }) => (
            <MetricCard
              key={key}
              {...metric}
            />
          ))}
        </div>

        <ScholarshipAssistant />
      </div>

      <section
        ref={chartCardRef}
        aria-label="Youth registry analytics"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <header className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
              Youth registry analytics
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900">
              {chartTitle}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{chartSubtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <div
              role="group"
              aria-label="Analytics chart view"
              className="flex w-fit shrink-0 rounded-full bg-slate-100 p-1"
            >
              <button
                type="button"
                aria-pressed={isPopulationView}
                onClick={() => setChartView("population")}
                className={`rounded-full px-2 py-2 text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs ${
                  isPopulationView
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                Total Population
              </button>
              <button
                type="button"
                aria-pressed={!isPopulationView}
                onClick={() => setChartView("scholars")}
                className={`rounded-full px-2 py-2 text-[11px] font-semibold transition-colors sm:px-3 sm:text-xs ${
                  !isPopulationView
                    ? "bg-cyan-500 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-200"
                }`}
              >
                SKEAP Scholars
              </button>
            </div>
            <AnalyticsExportMenu
              label="youth registry analytics"
              onExportImage={exportChartAsPng}
              onExportTable={exportAnalyticsToExcel}
            />
          </div>
        </header>

        <div className="h-[370px] bg-white px-2 pb-5 sm:px-5">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 4, right: 48, bottom: 4, left: 0 }}
              barCategoryGap={10}
            >
              <CartesianGrid horizontal={false} stroke="#e2e8f0" />
              <XAxis
                type="number"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#64748b", fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="sitio"
                width={155}
                axisLine={false}
                tickLine={false}
                tick={{ fill: "#475569", fontSize: 11 }}
              />
              <Tooltip
                cursor={{ fill: "#f8fafc" }}
                formatter={(value) => [Number(value).toLocaleString("en-PH"), chartLabel]}
                contentStyle={{
                  borderRadius: 12,
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 8px 24px rgba(15, 23, 42, .08)",
                }}
              />
              <Bar
                dataKey="value"
                name={chartLabel}
                fill={isPopulationView ? "#06b6d4" : "#0F3D5C"}
                radius={[0, 5, 5, 0]}
                maxBarSize={24}
              >
                <LabelList dataKey="value" position="right" fill="#334155" fontSize={11} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

    </>
  );
}
