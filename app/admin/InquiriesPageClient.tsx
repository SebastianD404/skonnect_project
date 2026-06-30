"use client";

import { Fragment, useMemo, useState } from "react";
import { ArrowRight, Search } from "lucide-react";
import DashboardHeaderWrapper from "./DashboardHeaderWrapper";
import type { TimePeriod } from "./DashboardHeaderWrapper";

function extractUrls(text: string) {
  const urlRegex = /https?:\/\/[\w\-./?=&%]+/g;
  return Array.from(text.match(urlRegex) || []);
}

function isImageUrl(url: string) {
  return /(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.avif|\.svg)(\?|$)/i.test(url);
}

interface InquiryRow {
  id: string;
  subject: string;
  message: string;
  language: string;
  isResolved: boolean;
  response: string | null;
  respondedAt: string | null;
  createdAt: string;
  user: {
    fullName: string;
    email: string;
  };
}

interface StatItem {
  label: string;
  value: string;
  sub: string;
  delta: string;
  up: boolean;
  iconName: "Users" | "CalendarDays" | "Inbox" | "Check";
}

interface InquiriesPageClientProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  statsByPeriod: Record<TimePeriod, StatItem[]>;
  inquiries: InquiryRow[];
}

const INQUIRY_FILTERS: Array<{ label: string; value: "ALL" | "OPEN" | "RESOLVED" }> = [
  { label: "All", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "Resolved", value: "RESOLVED" },
];

export default function InquiriesPageClient({
  dateLabel,
  openInquiryCount,
  pendingSubmissionCount,
  statsByPeriod,
  inquiries,
}: InquiriesPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filteredInquiries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return inquiries.filter((inquiry) => {
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "OPEN" ? !inquiry.isResolved : inquiry.isResolved);

      const haystack = [
        inquiry.subject,
        inquiry.message,
        inquiry.user.fullName,
        inquiry.user.email,
      ]
        .join(" ")
        .toLowerCase();

      const matchesSearch = normalizedQuery.length === 0 || haystack.includes(normalizedQuery);
      return matchesStatus && matchesSearch;
    });
  }, [inquiries, searchQuery, statusFilter]);

  const openCount = inquiries.filter((inquiry) => !inquiry.isResolved).length;
  const resolvedCount = inquiries.filter((inquiry) => inquiry.isResolved).length;

  return (
    <>
      <DashboardHeaderWrapper
        dateLabel={dateLabel}
        openInquiryCount={openInquiryCount}
        pendingSubmissionCount={pendingSubmissionCount}
        statsByPeriod={statsByPeriod}
        compact
        onSearch={setSearchQuery}
      />

      <div className="flex-1 py-0 mt-8">
        <div className="px-8 space-y-6">
          <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-3">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-[#0F3D5C]">Support inquiries</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">General support questions</h2>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 w-full">
                  <div className="relative flex-1 min-w-[300px]">
                    <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder="Search subject, message, email..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full rounded-full border border-slate-200 bg-white py-2 pl-11 pr-4 text-sm text-slate-700 placeholder-slate-500 outline-none transition focus:ring-2 focus:ring-[#0F3D5C]/20 focus:border-[#0F3D5C]"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {INQUIRY_FILTERS.map((filter) => (
                      <button
                        key={filter.value}
                        type="button"
                        onClick={() => setStatusFilter(filter.value)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          statusFilter === filter.value
                            ? "bg-[#0F3D5C] text-white shadow-sm"
                            : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                        }`}
                      >
                        {filter.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="whitespace-nowrap px-6 py-4 text-left font-semibold">Subject</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left font-semibold">User</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left font-semibold">Status</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left font-semibold">Submitted</th>
                    <th className="whitespace-nowrap px-6 py-4 text-left font-semibold">Response</th>
                    <th className="px-6 py-4 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredInquiries.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-500">
                        No support inquiries match that search or filter.
                      </td>
                    </tr>
                  ) : (
                    filteredInquiries.map((inquiry) => {
                      const isExpanded = expandedId === inquiry.id;
                      return (
                        <Fragment key={inquiry.id}>
                          <tr className="transition hover:bg-slate-50">
                            <td className="px-6 py-4">
                              <div className="font-semibold text-slate-900">{inquiry.subject}</div>
                              <div className="text-xs text-slate-500 line-clamp-1">{inquiry.message}</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-medium text-slate-900">{inquiry.user.fullName}</div>
                              <div className="text-xs text-slate-500">{inquiry.user.email}</div>
                            </td>
                            <td className="px-6 py-4">
                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  inquiry.isResolved
                                    ? "bg-emerald-100 text-emerald-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {inquiry.isResolved ? "Resolved" : "Open"}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              {new Date(inquiry.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-6 py-4 text-slate-700">
                              {inquiry.respondedAt
                                ? new Date(inquiry.respondedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "—"}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button
                                type="button"
                                onClick={() => setExpandedId(isExpanded ? null : inquiry.id)}
                                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-700 transition hover:bg-slate-200"
                              >
                                {isExpanded ? "Hide" : "Details"}
                                <ArrowRight className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="bg-slate-50">
                              <td colSpan={6} className="px-6 py-5">
                                <div className="grid gap-5 lg:grid-cols-[1.35fr_0.9fr]">
                                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                                    <p className="text-xs uppercase tracking-[0.28em] text-[#0F3D5C]">Message</p>
                                    <div className="mt-3 text-sm leading-relaxed text-slate-700 space-y-4">
                                      <p>{inquiry.message}</p>
                                      {extractUrls(inquiry.message).filter(isImageUrl).length > 0 ? (
                                        <div className="grid gap-4 sm:grid-cols-2">
                                          {extractUrls(inquiry.message)
                                            .filter(isImageUrl)
                                            .map((url) => (
                                              <div key={url} className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 shadow-sm">
                                                <img src={url} alt="Uploaded document" className="h-48 w-full object-cover" />
                                              </div>
                                            ))}
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                  <div className="rounded-3xl border border-slate-200 bg-white p-5">
                                    <p className="text-xs uppercase tracking-[0.28em] text-[#0F3D5C]">Response</p>
                                    <p className="mt-3 text-sm leading-relaxed text-slate-700">
                                      {inquiry.response ?? "No response yet."}
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
