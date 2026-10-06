"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  Search as SearchIcon,
  X,
  Book,
  Mail,
  Phone,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  type LucideIcon,
} from "lucide-react";

type IconName = "Users" | "CalendarDays" | "Inbox" | "Check" | "FileText" | "CheckSquare" | "GraduationCap";

interface Stat {
  label: string;
  value: string;
  sub: string;
  delta?: string;
  up?: boolean;
  href?: string;
  accent?: "cyan" | "amber" | "emerald";
  iconName: IconName;
  icon?: LucideIcon;
}

type TimePeriod = "Today" | "Week" | "Month" | "Quarter";

interface DashboardHeaderProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  timePeriod: TimePeriod;
  onTimePeriodChange: (period: TimePeriod) => void;
  onSearch?: (query: string) => void;
  stats?: Stat[];
  operationalSnapshot?: boolean;
  compact?: boolean;
  showToolbar?: boolean;
}

export default function DashboardHeader({
  dateLabel,
  timePeriod,
  onTimePeriodChange,
  onSearch,
  stats = [],
  operationalSnapshot = false,
  compact = false,
  showToolbar = true,
}: DashboardHeaderProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showHelpModal, setShowHelpModal] = useState(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch?.(query);
  };

  return (
    <>
      {showToolbar && (
      <div className={`border-b border-slate-200 ${compact ? "py-1" : "py-2"}`}>
        <div className="px-8 flex items-center gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search grantees, inquiries..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-12 pr-4 text-sm text-slate-700 placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-[#0F3D5C]/20 focus:border-[#0F3D5C]"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setShowHelpModal(true)}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:border-slate-300"
              title="Get help"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Help</span>
            </button>
          </div>
        </div>
      </div>
      )}

      {/* Main Content Header */}
      <div>
        <div className="px-8 flex flex-col gap-0">
          <p className="text-xs uppercase tracking-[0.35em] font-semibold text-[#0F3D5C] leading-none">
            {dateLabel}
          </p>

          {/* Title and Time Period Selector */}
          <div className="flex flex-col gap-0 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
            <div className="lg:flex-1">
              <h1 className="text-4xl lg:text-5xl font-black tracking-tight text-slate-950 leading-tight -mb-2">
                Here&apos;s what&apos;s happening in your barangay.
              </h1>
            </div>

            {!operationalSnapshot && (
              <div className="inline-flex w-fit items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                {(["Today", "Week", "Month", "Quarter"] as TimePeriod[]).map((period) => (
                  <button
                    key={period}
                    onClick={() => onTimePeriodChange(period)}
                    className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition ${
                      timePeriod === period
                        ? "bg-[#0F3D5C] text-white shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    }`}
                  >
                    {period}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && stats.length > 0 && (
        <div className="px-8">
          <div className={`grid gap-4 ${operationalSnapshot ? `grid-cols-1 md:grid-cols-2 ${stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}` : "sm:grid-cols-2 lg:grid-cols-4"}`}>
            {stats.map((stat) => {
              const Icon = stat.icon;
              if (operationalSnapshot) {
                const isActionQueue = stat.accent === "amber";
                const hasItems = Number(stat.value) > 0;
                const isPrimaryMetric = stat.label === "Total Grantees";
                const cardContent = (
                  <>
                    <div
                      aria-hidden="true"
                      className={`pointer-events-none absolute rounded-full blur-2xl transition-colors duration-500 ${isPrimaryMetric ? "-top-12 -right-12 h-40 w-40 bg-cyan-100/40 group-hover:bg-cyan-200/50" : "-top-10 -right-10 h-32 w-32 bg-cyan-50/50 group-hover:bg-cyan-100/50"}`}
                    />
                    <div className="relative z-10 flex items-center justify-between gap-3">
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${isPrimaryMetric ? "text-cyan-600" : "text-slate-400"}`}>
                        {stat.label}
                      </span>
                      <div className="flex shrink-0 items-center gap-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full shadow-sm transition-transform duration-300 group-hover:scale-110 ${isPrimaryMetric ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md" : "border border-cyan-100 bg-cyan-50/70 text-cyan-600"}`}>
                          {Icon && <Icon className="h-4 w-4" />}
                        </div>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-4 w-4 text-slate-300 transition-colors group-hover:text-cyan-600"
                        />
                      </div>
                    </div>
                    <div className="relative z-10">
                      <span className="text-3xl font-black tracking-tight leading-none text-slate-900">
                        {stat.value}
                      </span>
                      <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                        {isActionQueue && !hasItems ? "all caught up" : stat.sub}
                      </p>
                    </div>
                  </>
                );
                const cardClassName = `group relative flex w-full flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 text-left shadow-sm transition-all duration-300 hover:shadow-md ${isPrimaryMetric ? "hover:border-cyan-300" : "hover:border-cyan-200"}`;

                return stat.href ? (
                  <Link
                    key={stat.label}
                    href={stat.href}
                    className={`${cardClassName} cursor-pointer no-underline`}
                  >
                    {cardContent}
                  </Link>
                ) : (
                  <div key={stat.label} className={cardClassName}>
                    {cardContent}
                  </div>
                );
              }

              return (
                <div key={stat.label} className={`group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-all duration-300 hover:shadow-md ${stat.label === "Open inquiries" ? "hover:border-cyan-300" : "hover:border-cyan-200"}`}>
                  <div
                    aria-hidden="true"
                    className={`pointer-events-none absolute rounded-full blur-2xl transition-colors duration-500 ${stat.label === "Open inquiries" ? "-top-12 -right-12 h-40 w-40 bg-cyan-100/40 group-hover:bg-cyan-200/50" : "-top-10 -right-10 h-32 w-32 bg-cyan-50/50 group-hover:bg-cyan-100/50"}`}
                  />
                  <div className="relative z-10 flex items-center justify-between gap-3">
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${stat.label === "Open inquiries" ? "text-cyan-600" : "text-slate-400"}`}>{stat.label}</p>
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm transition-transform duration-300 group-hover:scale-110 ${stat.label === "Open inquiries" ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md" : "border border-cyan-100 bg-cyan-50/70 text-cyan-600"}`}>
                      {Icon && <Icon className="h-4 w-4" />}
                    </div>
                  </div>
                  <div className="relative z-10 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="text-3xl font-black leading-none tracking-tight text-slate-900">{stat.value}</span>
                    <span className="text-[11px] font-medium text-slate-400">{stat.sub}</span>
                    {stat.delta !== undefined && (
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        stat.up ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                      }`}>
                        {stat.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {stat.delta}
                      </span>
                    )}
                    </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-3xl bg-white shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-slate-900">Help & Support</h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="px-6 py-6 space-y-4">
              <div>
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Book className="h-4 w-4 text-[#0F3D5C]" />
                  Documentation
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  Learn how to use the admin dashboard and manage your barangay programs.
                </p>
                <button className="text-sm font-medium text-[#0F3D5C] hover:text-[#0D2E47]">
                  View docs →
                </button>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#0F3D5C]" />
                  Contact Support
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  Email our support team for technical assistance.
                </p>
                <a
                  href="mailto:support@skonnect.com"
                  className="text-sm font-medium text-[#0F3D5C] hover:text-[#0D2E47]"
                >
                  support@skonnect.com
                </a>
              </div>

              <div className="border-t border-slate-200 pt-4">
                <h3 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-[#0F3D5C]" />
                  FAQ
                </h3>
                <p className="text-sm text-slate-600 mb-3">
                  Check out frequently asked questions about the platform.
                </p>
                <button className="text-sm font-medium text-[#0F3D5C] hover:text-[#0D2E47]">
                  View FAQ →
                </button>
              </div>
            </div>

            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                onClick={() => setShowHelpModal(false)}
                className="w-full rounded-full bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0D2E47] transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
