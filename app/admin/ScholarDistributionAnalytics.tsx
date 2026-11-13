"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import pet from "@/public/SKPet.png";
import { toPng } from "html-to-image";
import * as XLSX from "xlsx-js-style";
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
  FileSpreadsheet,
  Image as ImageIcon,
  MoreVertical,
  type LucideIcon,
} from "lucide-react";
import type { ScholarDistributionAnalytics as Analytics } from "@/lib/admin-scholar-analytics";

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
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const chartCardRef = useRef<HTMLElement>(null);
  const capacity = analytics.maxSlots;
  const capacityOverage = analytics.capacityUsed - capacity;
  const isPopulationView = chartView === "population";
  const chartTitle = isPopulationView
    ? "Youth Population by Sitio"
    : "Scholar Distribution by Sitio";
  const chartSubtitle = isPopulationView
    ? "Approved KK-profiled youth across Barangay Pico."
    : "Active and approved SKEAP scholars across Barangay Pico.";
  const chartLabel = isPopulationView ? "Approved KK youth" : "SKEAP scholars";
  const chartData = isPopulationView
    ? analytics.populationDistribution.map(({ sitio, population }) => ({ sitio, value: population }))
    : analytics.scholarDistribution.map(({ sitio, scholars }) => ({ sitio, value: scholars }));

  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !exportMenuRef.current?.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExportMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExportMenuOpen]);

  const exportChartAsPng = async () => {
    setExportError(null);
    const chartCard = chartCardRef.current;
    if (!chartCard) {
      setExportError("The analytics card is not ready to export. Please try again.");
      return;
    }

    try {
      const image = await toPng(chartCard, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 3,
        filter: (element) =>
          !(element instanceof Element && element.getAttribute("data-export-ignore") === "true"),
      });
      const anchor = document.createElement("a");
      anchor.href = image;
      anchor.download = "sitio-analytics-chart.png";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setIsExportMenuOpen(false);
    } catch (error) {
      console.error("Failed to export the sitio analytics card image:", error);
      setExportError("Unable to export the chart image. Please try again.");
    }
  };

  const exportAnalyticsToExcel = () => {
    setExportError(null);
    try {
      const reportTitle = isPopulationView
        ? "Barangay Pico - Youth Population by Sitio"
        : "Barangay Pico - SKEAP Scholar Distribution by Sitio";
      const countHeader = isPopulationView ? "Total Profiled Youth" : "Total Active Scholars";
      const generatedOn = new Date().toLocaleString("en-PH");
      const worksheet = XLSX.utils.aoa_to_sheet([
        [reportTitle],
        [`Generated on: ${generatedOn}`],
        [],
        ["Sitio Name", countHeader],
        ...chartData.map(({ sitio, value }) => [sitio, value]),
      ]);
      worksheet["!cols"] = [{ wch: 25 }, { wch: 20 }];
      worksheet["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

      const titleCell = worksheet["A1"];
      const timestampCell = worksheet["A2"];
      const sitioHeaderCell = worksheet["A4"];
      const countHeaderCell = worksheet["B4"];
      if (!titleCell || !timestampCell || !sitioHeaderCell || !countHeaderCell) {
        throw new Error("Unable to create the sitio analytics report layout.");
      }

      titleCell.s = { font: { bold: true, sz: 14 } };
      timestampCell.s = { font: { sz: 11, italic: true } };

      const gridBorder = {
        top: { style: "thin" as const, color: { rgb: "D3D3D3" } },
        left: { style: "thin" as const, color: { rgb: "D3D3D3" } },
        bottom: { style: "thin" as const, color: { rgb: "D3D3D3" } },
        right: { style: "thin" as const, color: { rgb: "D3D3D3" } },
      };
      const headerStyle = {
        fill: { patternType: "solid" as const, fgColor: { rgb: "1F2937" } },
        font: { bold: true, color: { rgb: "FFFFFF" } },
        alignment: { horizontal: "center" as const, vertical: "center" as const },
        border: gridBorder,
      };
      sitioHeaderCell.s = headerStyle;
      countHeaderCell.s = headerStyle;

      const lastDataRow = 4 + chartData.length;
      for (let rowNumber = 4; rowNumber <= lastDataRow; rowNumber += 1) {
        const sitioCell = worksheet[`A${rowNumber}`];
        const countCell = worksheet[`B${rowNumber}`];
        if (!sitioCell || !countCell) {
          throw new Error(`Unable to create sitio analytics table row ${rowNumber}.`);
        }

        sitioCell.s = {
          ...sitioCell.s,
          border: gridBorder,
        };
        countCell.s = {
          ...countCell.s,
          ...(rowNumber > 4
            ? { alignment: { horizontal: "center", vertical: "center" } }
            : {}),
          border: gridBorder,
        };
      }

      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Sitio Analytics");
      XLSX.writeFile(workbook, "sitio-analytics-data.xlsx", { cellStyles: true });
      setIsExportMenuOpen(false);
    } catch (error) {
      console.error("Failed to export sitio analytics data:", error);
      setExportError("Unable to export the data table. Please try again.");
    }
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
            <div
              ref={exportMenuRef}
              data-export-ignore="true"
              className="relative shrink-0"
            >
              <button
                type="button"
                aria-label="Export chart"
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                aria-controls="youth-analytics-export-menu"
                onClick={() => {
                  setExportError(null);
                  setIsExportMenuOpen((open) => !open);
                }}
                className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
              >
                <MoreVertical className="h-5 w-5" aria-hidden="true" />
              </button>
              {isExportMenuOpen ? (
                <div
                  id="youth-analytics-export-menu"
                  role="menu"
                  aria-label="Export youth registry analytics"
                  className="absolute right-0 top-full z-20 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                >
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => void exportChartAsPng()}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <ImageIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    Download as Image (.png)
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={exportAnalyticsToExcel}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-slate-500" aria-hidden="true" />
                    Export Data Table (.xlsx)
                  </button>
                  {exportError ? (
                    <p role="alert" className="px-3 py-2 text-xs text-rose-700">
                      {exportError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
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
