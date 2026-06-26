"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
          <div className="grid gap-4 lg:grid-cols-[1.8fr_1.1fr]">
            <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.3em] text-[#0F3D5C]">Youth participation</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="text-3xl font-semibold text-slate-950">1,284</span>
                    <span className="text-xs font-medium text-emerald-600">+18.2%</span>
                  </div>
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/15 bg-white px-4 py-2 text-sm font-semibold text-[#0F3D5C] shadow-sm">
                  <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#0F3D5C]" />
                  Updated by SK officials
                </div>
              </div>

              <div className="mt-8 h-32 rounded-[1.75rem] bg-slate-100" />

              <div className="mt-3 grid grid-cols-6 gap-2 text-[10px] uppercase tracking-[0.22em] text-slate-500">
                {['Jan','Feb','Mar','Apr','May','Jun'].map((m) => (
                  <span key={m}>{m}</span>
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-4">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[#0F3D5C]">Recent inquiries</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">Inbox</h2>
                  </div>
                  <Link href="/admin/inquiries" className="text-xs font-medium text-slate-600 hover:text-slate-950 transition hover:underline">
                    View all →
                  </Link>
                </div>

                <ul className="mt-5 space-y-4">
                  {filteredInquiries.map((inquiry) => (
                    <li key={inquiry.id} className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#0F3D5C]/10 text-[#0F3D5C] font-semibold">
                        {inquiry.user.fullName
                          .split(" ")
                          .map((segment) => segment[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                          <span>{inquiry.user.fullName}</span>
                          <span className="text-xs text-slate-500">{inquiry.subject}</span>
                        </div>
                        <p className="truncate text-xs text-slate-500">{inquiry.message}</p>
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(inquiry.createdAt).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </li>
                  ))}
                  {filteredInquiries.length === 0 && (
                    <li className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
                      No inquiries match that search.
                    </li>
                  )}
                </ul>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm uppercase tracking-[0.3em] text-[#0F3D5C]">Document reviews</p>
                    <h2 className="mt-1 text-lg font-semibold text-slate-950">Pending reviews</h2>
                  </div>
                  <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F3D5C]/10 text-[#0F3D5C]">
                    <Check className="h-6 w-6" />
                  </div>
                </div>
                <div className="mt-5 flex items-center gap-3">
                  <div className="rounded-3xl bg-slate-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.28em] text-slate-600">
                    {pendingSubmissionCount}
                  </div>
                  <div className="text-sm text-slate-500">
                    Grantee grade and COE uploads waiting for review.
                  </div>
                </div>
                <div className="mt-6">
                  <Link
                    href="/admin/submissions"
                    className="inline-flex items-center justify-center rounded-full bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2E47]"
                  >
                    Review documents
                  </Link>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
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

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="text-base font-semibold text-slate-950">Today's tasks</div>
                <div className="text-xs text-slate-500">3 / 5</div>
              </div>
              <ul className="mt-5 space-y-3">
                {taskItems.map((task) => (
                  <li key={task.label} className="flex items-center gap-3 text-sm">
                    <span
                      className={`flex h-5 w-5 items-center justify-center rounded-full border ${
                        task.done ? "border-[#0F3D5C] bg-[#0F3D5C] text-white" : "border-slate-300 bg-white text-slate-400"
                      }`}
                    >
                      {task.done ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className={task.done ? "text-slate-500 line-through" : "text-slate-700"}>{task.label}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5 flex items-center gap-2 rounded-3xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                <span>Avg. response time today:</span>
                <span className="ml-auto font-semibold text-slate-900">12m</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
