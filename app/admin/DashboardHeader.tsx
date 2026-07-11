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
  type LucideIcon,
} from "lucide-react";

type IconName = "Users" | "CalendarDays" | "Inbox" | "Check";

interface Stat {
  label: string;
  value: string;
  sub: string;
  delta: string;
  up: boolean;
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
              placeholder="Search grantees, events, inquiries..."
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
                <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-slate-200 bg-white shadow-xl z-50">
                  <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                    <h3 className="font-semibold text-slate-900">Notifications</h3>
                    <button
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="max-h-96 divide-y divide-slate-200 overflow-y-auto">
                    {openInquiryCount > 0 && (
                      <div className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">
                              {openInquiryCount} Open Inquiries
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Awaiting your response
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {pendingSubmissionCount > 0 && (
                      <div className="px-4 py-3 hover:bg-slate-50 cursor-pointer transition">
                        <div className="flex items-start gap-3">
                          <div className="mt-1 h-2 w-2 rounded-full bg-sky-500 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 text-sm">
                              {pendingSubmissionCount} Pending Submissions
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                              Under review queue
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    {openInquiryCount === 0 && pendingSubmissionCount === 0 && (
                      <div className="px-4 py-8 text-center">
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
          <button
            onClick={() => router.push("/admin/events?new=1")}
            className="inline-flex items-center gap-2 rounded-full bg-[#0F3D5C] px-4 py-1.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#0D2E47] active:scale-95"
            title="Create new event"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New event</span>
          </button>
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

            <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm w-fit">
              {(["Today", "Week", "Month", "Quarter"] as TimePeriod[]).map((period) => (
                <button
                  key={period}
                  onClick={() => onTimePeriodChange(period)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition whitespace-nowrap ${
                    timePeriod === period
                      ? "bg-[#0F3D5C] text-white shadow-sm"
                      : "text-slate-600 hover:text-slate-950 hover:bg-slate-50"
                  }`}
                >
                  {period}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && stats.length > 0 && (
        <div className="px-8 py-2">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {stats.map((stat) => {
              const Icon = stat.icon;
              return (
                <div 
                  key={stat.label} 
                  className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md hover:border-slate-300"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#0F3D5C]/10 to-[#0F3D5C]/5 text-[#0F3D5C] group-hover:from-[#0F3D5C]/15 group-hover:to-[#0F3D5C]/10 transition">
                      {Icon && <Icon className="h-5 w-5" />}
                    </div>
                    <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      stat.up 
                        ? 'bg-emerald-50 text-emerald-700' 
                        : 'bg-rose-50 text-rose-700'
                    }`}>
                      {stat.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {stat.delta}
                    </div>
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
