"use client";

import { useMemo, useState, useRef } from "react";
import Link from "next/link";
import YouthParticipationChart from "../../components/YouthParticipationChart";
import { Check, Clock, MoreHorizontal, Users } from "lucide-react";
import DashboardHeaderWrapper from "./DashboardHeaderWrapper";

interface EventItem {
  id: string;
  title: string;
  description: string;
  venue: string;
  eventDate: string;
  status: string;
  filledSlots: number;
  maxSlots: number;
}

interface InquiryItem {
  id: string;
  subject: string;
  message: string;
  createdAt: string;
  language: string;
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

interface AdminDashboardPageClientProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  stats: StatItem[];
  upcomingEvents: EventItem[];
  recentInquiries: InquiryItem[];
  profilingRegistrationCount: number;
  profilingSeries?: number[];
  profilingMonths?: string[];
}

const taskItems = [
  { label: "Approve pending submissions", done: false },
  { label: "Reply to inquiries", done: true },
  { label: "Finalize event schedule", done: false },
  { label: "Upload announcement", done: true },
];

function StatusPill({ tone, children }: { tone: "open" | "scheduled" | "draft"; children: React.ReactNode }) {
  const classes =
    tone === "open"
      ? "bg-emerald-100 text-emerald-700"
      : tone === "scheduled"
      ? "bg-sky-100 text-sky-700"
      : "bg-slate-100 text-slate-700";

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${classes}`}>{children}</span>;
}

export default function AdminDashboardPageClient({
  dateLabel,
  openInquiryCount,
  pendingSubmissionCount,
  stats,
  upcomingEvents,
  recentInquiries,
  profilingRegistrationCount,
  profilingSeries = [],
  profilingMonths = [],
}: AdminDashboardPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredEvents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return upcomingEvents;
    }
    return upcomingEvents.filter((event) => {
      return [event.title, event.description, event.venue, event.status]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [upcomingEvents, searchQuery]);

  const filteredInquiries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return recentInquiries;
    }
    return recentInquiries.filter((inquiry) => {
      return [inquiry.subject, inquiry.message, inquiry.user.fullName, inquiry.user.email]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [recentInquiries, searchQuery]);


  return (
    <>
      <DashboardHeaderWrapper
        dateLabel={dateLabel}
        openInquiryCount={openInquiryCount}
        pendingSubmissionCount={pendingSubmissionCount}
        stats={stats}
        onSearch={setSearchQuery}
      />

      <div className="flex-1 py-8">
        <div className="px-8 flex flex-col gap-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6 items-stretch">
            <div className="lg:col-span-2 flex flex-col gap-6">
              <div className="w-full min-w-0 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Youth Participation</h3>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-4xl font-bold text-slate-800">{profilingRegistrationCount.toLocaleString()}</span>
                      <span className="text-sm font-medium text-emerald-500">{profilingSeries.length > 1 ? `+${profilingSeries[profilingSeries.length - 1] - profilingSeries[profilingSeries.length - 2]}` : "+0"}</span>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-600 border border-slate-100">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500 animate-pulse" />
                    Updated by SK officials
                  </span>
                </div>
                <YouthParticipationChart />
              </div>

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-950">Upcoming events</p>
                    <p className="text-sm text-slate-500">Manage scheduled youth activities</p>
                  </div>
                  <Link href="/admin/events" className="text-xs font-medium text-slate-600 hover:text-slate-950 transition hover:underline">
                    Manage →
                  </Link>
                </div>

                <div className="mt-5 grid grid-cols-[1.5fr_1fr_0.9fr_0.9fr_auto] gap-3 border-b border-slate-200 pb-3 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-500">
                  <div>Event</div>
                  <div>Date</div>
                  <div>Attendees</div>
                  <div>Status</div>
                  <div />
                </div>

                <ul className="divide-y divide-slate-200">
                  {filteredEvents.length === 0 ? (
                    <li className="py-16 text-center text-sm text-slate-500">No upcoming events match that search.</li>
                  ) : (
                    filteredEvents.map((event) => {
                      const tone = event.status === "REGISTRATION_OPEN" ? "open" : event.status === "UPCOMING" ? "scheduled" : "draft";
                      return (
                        <li key={event.id} className="grid grid-cols-[1.5fr_1fr_0.9fr_0.9fr_auto] items-center gap-3 py-4 text-sm text-slate-700">
                          <div className="font-medium text-slate-950">{event.title}</div>
                          <div>{new Date(event.eventDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</div>
                          <div className="flex items-center gap-1 text-slate-600">
                            <Users className="h-3.5 w-3.5" />
                            {event.filledSlots}
                          </div>
                          <div>
                            <StatusPill tone={tone}>{event.status.replace(/_/g, " ")}</StatusPill>
                          </div>
                          <button className="text-slate-500 hover:text-slate-900">
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </li>
                      );
                    })
                  )}
                </ul>
              </div>
            </div>

            <div className="flex flex-col gap-6 h-full">
              <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col">
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Recent Inquiries</h3>
                    <h4 className="text-lg font-bold text-slate-800 mt-0.5">Inbox</h4>
                  </div>
                  <button className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1">
                    View all →
                  </button>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-3">
                    <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0a2 2 0 01-2 2H6a2 2 0 01-2-2m16 0l-3.586 3.586a2 2 0 01-2.828 0L6 13m14 0a2 2 0 00-2-2H6a2 2 0 00-2 2" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-700">Your inbox is clear</p>
                  <p className="text-xs text-slate-400 max-w-[200px] mt-1">
                    No new incoming inquiries or citizen concerns match your workspace view.
                  </p>
                </div>
              </div>

              <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h3 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">Document Reviews</h3>
                      <h4 className="text-lg font-bold text-slate-800 mt-0.5">Pending reviews</h4>
                    </div>
                    <div className="w-8 h-8 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-500">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>

                  <div className="flex items-start gap-4 p-4 rounded-xl bg-slate-50/70 border border-slate-100/50">
                    <div className="w-9 h-9 rounded-lg bg-white shadow-sm border border-slate-100 flex items-center justify-center text-sm font-bold text-slate-700 shrink-0">
                      {pendingSubmissionCount}
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-xs font-semibold text-slate-700">All Caught Up</p>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        Grantee grade evaluations and COE uploads are fully processed.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6">
                  <button className="w-full py-2.5 px-4 bg-[#0f3456] hover:bg-[#16436e] active:bg-[#0b2742] text-white rounded-xl text-xs font-semibold tracking-wide shadow-sm transition-all duration-150">
                    Open Review Console
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
