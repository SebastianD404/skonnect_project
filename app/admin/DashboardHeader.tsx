"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  HelpCircle,
  Plus,
  Search as SearchIcon,
  X,
  AlertCircle,
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
  onSearch: (query: string) => void;
  stats?: Stat[];
  operationalSnapshot?: boolean;
  compact?: boolean;
  showNotificationBell?: boolean;
}

export default function DashboardHeader({
  dateLabel,
  openInquiryCount,
  pendingSubmissionCount,
  timePeriod,
  onTimePeriodChange,
  onSearch,
  stats = [],
  operationalSnapshot = false,
  compact = false,
  showNotificationBell = true,
}: DashboardHeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    onSearch(query);
  };

  return (
    <>
      {/* Top Controls Row */}
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
          {showNotificationBell && (
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative inline-flex items-center justify-center rounded-full border border-slate-200 bg-white p-2 text-slate-700 transition hover:bg-slate-50"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                {openInquiryCount + pendingSubmissionCount > 0 && (
                  <span className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <div className="absolute right-0 mt-2 w-96 max-h-[420px] flex flex-col rounded-2xl bg-white shadow-2xl border border-gray-100 z-50 overflow-hidden">
                  <div className="sticky top-0 bg-white/95 backdrop-blur-sm px-4 py-3 border-b border-gray-100 flex items-center justify-between z-10">
                    <span className="font-semibold text-gray-900 text-sm">Notifications</span>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto p-2 space-y-1.5">
                    {openInquiryCount > 0 && (
                      <div className="rounded-xl px-3 py-2 hover:bg-slate-50 cursor-pointer transition">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">
                              {openInquiryCount} Open Inquiries
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              Awaiting your response
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {pendingSubmissionCount > 0 && (
                      <div className="rounded-xl px-3 py-2 hover:bg-slate-50 cursor-pointer transition">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">
                              {pendingSubmissionCount} Pending Submissions
                            </p>
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                              Under review queue
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {openInquiryCount === 0 && pendingSubmissionCount === 0 && (
                      <div className="px-3 py-8 text-center">
                        <p className="text-sm text-slate-500">
                          All caught up! No new notifications.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="border-t border-slate-200 px-4 py-2">
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        router.push("/admin/inquiries");
                      }}
                      className="w-full text-center text-xs font-medium text-[#0F3D5C] hover:text-[#0D2E47] py-2"
                    >
                      View all
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Main Content Header */}
      <div className="pt-6 pb-2">
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
        <div className="px-8 py-2">
          <div className={`grid gap-4 ${operationalSnapshot ? `mt-8 grid-cols-1 md:grid-cols-2 ${stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4"}` : "sm:grid-cols-2 lg:grid-cols-4"}`}>
            {stats.map((stat) => {
              const Icon = stat.icon;
              if (operationalSnapshot) {
                const isActionQueue = stat.accent === "amber";
                const hasItems = Number(stat.value) > 0;
                const accent = stat.accent === "cyan"
                  ? {
                      icon: "bg-cyan-50 text-cyan-600 group-hover:bg-cyan-100",
                      arrow: "group-hover:text-cyan-600",
                      pill: "border-cyan-100/50 bg-cyan-50/80 text-cyan-700",
                    }
                  : isActionQueue && hasItems
                  ? {
                      icon: "bg-amber-50 text-amber-600 group-hover:bg-amber-100",
                      arrow: "group-hover:text-amber-600",
                      pill: "border-amber-200 bg-amber-50/80 text-amber-700",
                    }
                  : {
                      icon: "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100",
                      arrow: "group-hover:text-emerald-600",
                      pill: "border-emerald-100 bg-emerald-50/80 text-emerald-700",
                    };
                const cardContent = (
                  <>
                    <div className="mb-4 flex items-start justify-between">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all group-hover:scale-105 ${accent.icon}`}>
                          {Icon && <Icon className="h-5 w-5" />}
                        </div>
                        <span className="mt-0.5 text-[11px] font-bold uppercase tracking-widest text-slate-500">
                          {stat.label}
                        </span>
                      </div>
                      <ArrowUpRight
                        aria-hidden="true"
                        className={`h-4 w-4 shrink-0 text-slate-300 transition-colors ${accent.arrow}`}
                      />
                    </div>
                    <div className="mt-auto flex flex-wrap items-baseline gap-2.5">
                      <span className="text-4xl font-black tracking-tight text-slate-900">
                        {stat.value}
                      </span>
                      <span className={`rounded-md border px-2 py-1 text-[11px] font-bold ${accent.pill}`}>
                        {isActionQueue && !hasItems ? "all caught up" : stat.sub}
                      </span>
                    </div>
                  </>
                );
                const cardClassName = "group flex min-h-[140px] w-full flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md";

                return stat.href ? (
                  <button
                    key={stat.label}
                    type="button"
                    onClick={() => router.push(stat.href!)}
                    className={`${cardClassName} cursor-pointer`}
                  >
                    {cardContent}
                  </button>
                ) : (
                  <div key={stat.label} className={cardClassName}>
                    {cardContent}
                  </div>
                );
              }

              return (
                <div key={stat.label} className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F3D5C]/10 to-[#0F3D5C]/5 text-[#0F3D5C] transition group-hover:from-[#0F3D5C]/15 group-hover:to-[#0F3D5C]/10">
                      {Icon && <Icon className="h-5 w-5" />}
                    </div>
                    {stat.delta !== undefined && (
                      <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        stat.up
                          ? "bg-emerald-50 text-emerald-700"
                          : "bg-rose-50 text-rose-700"
                      }`}>
                        {stat.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                        {stat.delta}
                      </div>
                    )}
                  </div>
                  <div className="mt-6">
                    <p className={`text-xs font-semibold uppercase tracking-[0.25em] text-slate-500 ${stat.label === "Pending Document Reviews" ? "text-[0.65rem]" : ""}`}>{stat.label}</p>
                    <div className="mt-3 flex items-baseline gap-2">
                      <span className="text-4xl font-black tracking-tight text-slate-950">{stat.value}</span>
                      <span className="text-xs text-slate-500">{stat.sub}</span>
                    </div>
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
