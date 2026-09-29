"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, RotateCcw, Search, Send } from "lucide-react";
import DashboardHeaderWrapper from "./DashboardHeaderWrapper";
import type { TimePeriod } from "./DashboardHeaderWrapper";

function extractUrls(text: string) {
  const urlRegex = /https?:\/\/[\w\-./?=&%]+/g;
  return Array.from(text.match(urlRegex) || []);
}

function isImageUrl(url: string) {
  return /(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.avif|\.svg)(\?|$)/i.test(url);
}

interface InquiryThreadMessage {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
}

interface InquiryRow {
  id: string;
  subject: string;
  message: string;
  language: string;
  isResolved: boolean;
  response: string | null;
  respondedAt: string | null;
  reviewThread: InquiryThreadMessage[];
  createdAt: string;
  user: {
    fullName: string;
    email: string;
  };
}

function getConversationMessages(inquiry: InquiryRow) {
  const messages = Array.isArray(inquiry.reviewThread)
    ? inquiry.reviewThread.filter(
        (message) =>
          message &&
          (message.role === "admin" || message.role === "applicant") &&
          typeof message.text === "string" &&
          typeof message.createdAt === "string"
      )
    : [];

  if (!messages.some((message) => message.role === "applicant" && message.text === inquiry.message)) {
    messages.push({
      id: `original-${inquiry.id}`,
      role: "applicant",
      createdAt: inquiry.createdAt,
      text: inquiry.message,
    });
  }

  if (inquiry.response && !messages.some((message) => message.role === "admin" && message.text === inquiry.response)) {
    messages.push({
      id: `response-${inquiry.id}`,
      role: "admin",
      createdAt: inquiry.respondedAt ?? inquiry.createdAt,
      text: inquiry.response,
    });
  }

  return messages.sort((left, right) => Date.parse(left.createdAt) - Date.parse(right.createdAt));
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
  const [localInquiries, setLocalInquiries] = useState(inquiries);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [resolvingInquiryId, setResolvingInquiryId] = useState<string | null>(null);
  const [reopeningInquiryId, setReopeningInquiryId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<Record<string, string>>({});

  useEffect(() => {
    setLocalInquiries(inquiries);
  }, [inquiries]);

  const filteredInquiries = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return localInquiries.filter((inquiry) => {
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
  }, [localInquiries, searchQuery, statusFilter]);

  async function handleSendReply(inquiryId: string) {
    const text = (replyText[inquiryId] ?? "").trim();
    if (!text) {
      setReplyError((prev) => ({ ...prev, [inquiryId]: "Reply cannot be empty." }));
      return;
    }

    setReplyError((prev) => ({ ...prev, [inquiryId]: "" }));
    setSendingReplyId(inquiryId);

    try {
      const response = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reply", text }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send reply.");
      }

      const respondedAt = payload.respondedAt ?? new Date().toISOString();
      setLocalInquiries((prev) =>
        prev.map((inquiry) =>
          inquiry.id === inquiryId
            ? {
                ...inquiry,
                isResolved: payload.isResolved ?? inquiry.isResolved,
                response: payload.response ?? text,
                respondedAt,
                reviewThread: Array.isArray(payload.reviewThread)
                  ? payload.reviewThread
                  : [
                      {
                        id: `admin-${Date.now()}`,
                        role: "admin" as const,
                        createdAt: respondedAt,
                        text,
                      },
                      ...inquiry.reviewThread,
                    ],
              }
            : inquiry
        )
      );
      setReplyText((prev) => ({ ...prev, [inquiryId]: "" }));
    } catch (err) {
      setReplyError((prev) => ({
        ...prev,
        [inquiryId]: err instanceof Error ? err.message : "Unable to send reply.",
      }));
    } finally {
      setSendingReplyId(null);
    }
  }

  async function handleResolve(inquiryId: string) {
    setReplyError((prev) => ({ ...prev, [inquiryId]: "" }));
    const wasResolved = localInquiries.find((inquiry) => inquiry.id === inquiryId)?.isResolved ?? false;
    setLocalInquiries((prev) =>
      prev.map((inquiry) => (inquiry.id === inquiryId ? { ...inquiry, isResolved: true } : inquiry))
    );
    setResolvingInquiryId(inquiryId);

    try {
      const response = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "resolve" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to resolve inquiry.");
      }

      setLocalInquiries((prev) =>
        prev.map((inquiry) =>
          inquiry.id === inquiryId
            ? {
                ...inquiry,
                isResolved: true,
                reviewThread: Array.isArray(payload.reviewThread) ? payload.reviewThread : inquiry.reviewThread,
              }
            : inquiry
        )
      );
    } catch (err) {
      setLocalInquiries((prev) =>
        prev.map((inquiry) => (inquiry.id === inquiryId ? { ...inquiry, isResolved: wasResolved } : inquiry))
      );
      setReplyError((prev) => ({
        ...prev,
        [inquiryId]: err instanceof Error ? err.message : "Unable to resolve inquiry.",
      }));
    } finally {
      setResolvingInquiryId(null);
    }
  }

  async function handleReopen(inquiryId: string) {
    setReplyError((prev) => ({ ...prev, [inquiryId]: "" }));
    const wasResolved = localInquiries.find((inquiry) => inquiry.id === inquiryId)?.isResolved ?? true;
    setLocalInquiries((prev) =>
      prev.map((inquiry) => (inquiry.id === inquiryId ? { ...inquiry, isResolved: false } : inquiry))
    );
    setReopeningInquiryId(inquiryId);

    try {
      const response = await fetch(`/api/inquiries/${inquiryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reopen" }),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to reopen inquiry.");
      }

      setLocalInquiries((prev) =>
        prev.map((inquiry) =>
          inquiry.id === inquiryId
            ? { ...inquiry, isResolved: payload.isResolved ?? false }
            : inquiry
        )
      );
    } catch (err) {
      setLocalInquiries((prev) =>
        prev.map((inquiry) => (inquiry.id === inquiryId ? { ...inquiry, isResolved: wasResolved } : inquiry))
      );
      setReplyError((prev) => ({
        ...prev,
        [inquiryId]: err instanceof Error ? err.message : "Unable to reopen inquiry.",
      }));
    } finally {
      setReopeningInquiryId(null);
    }
  }

  return (
    <>
      <DashboardHeaderWrapper
        dateLabel={dateLabel}
        openInquiryCount={openInquiryCount}
        pendingSubmissionCount={pendingSubmissionCount}
        statsByPeriod={statsByPeriod}
        compact
        onSearch={setSearchQuery}
        showNotificationBell={false}
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

            <div className="relative max-h-[600px] overflow-auto custom-scroll">
              <table className="w-full min-w-[900px] divide-y divide-slate-200 text-sm">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-slate-500 shadow-sm">
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
                      const conversationMessages = getConversationMessages(inquiry);
                      return (
                        <Fragment key={inquiry.id}>
                          <tr className="transition hover:bg-slate-50">
                            <td className="w-[250px] max-w-[250px] px-6 py-4">
                              <div className="truncate font-semibold text-slate-900" title={inquiry.subject}>
                                {inquiry.subject}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-slate-500" title={inquiry.message}>
                                {inquiry.message}
                              </div>
                            </td>
                            <td className="max-w-[200px] px-6 py-4">
                              <div className="truncate font-medium text-slate-900" title={inquiry.user.fullName}>
                                {inquiry.user.fullName}
                              </div>
                              <div className="truncate text-xs text-slate-500" title={inquiry.user.email}>
                                {inquiry.user.email}
                              </div>
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
                            <tr className="bg-slate-50/50">
                              <td colSpan={6} className="border-b border-slate-200 bg-slate-50/50 p-0 shadow-inner">
                                <div className="grid grid-cols-1 gap-8 p-6 md:p-8 lg:grid-cols-12 lg:gap-10">
                                  <div className="flex min-w-0 flex-col lg:col-span-5">
                                    <h4 className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                      Conversation
                                    </h4>
                                    <div className="max-h-[360px] space-y-4 overflow-y-auto custom-scroll rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:p-5">
                                      {conversationMessages.map((message) => {
                                        const messageImages = extractUrls(message.text).filter(isImageUrl);
                                        return (
                                          <div
                                            key={message.id}
                                            className={`flex ${message.role === "admin" ? "justify-end" : "justify-start"}`}
                                          >
                                            <article
                                              className={`min-w-0 max-w-[92%] rounded-xl px-4 py-3 ${
                                                message.role === "admin"
                                                  ? "bg-[#0F3D5C] text-white"
                                                  : "border border-slate-200 bg-slate-50 text-slate-700"
                                              }`}
                                            >
                                              <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
                                                <span className={`text-[10px] font-bold uppercase tracking-wider ${message.role === "admin" ? "text-white/70" : "text-slate-400"}`}>
                                                  {message.role === "admin" ? "Admin response" : "User message"}
                                                </span>
                                                <time className={`text-[10px] ${message.role === "admin" ? "text-white/70" : "text-slate-400"}`}>
                                                  {new Date(message.createdAt).toLocaleString("en-US", {
                                                    month: "short",
                                                    day: "numeric",
                                                    year: "numeric",
                                                    hour: "numeric",
                                                    minute: "2-digit",
                                                  })}
                                                </time>
                                              </div>
                                              <p className="whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">
                                                {message.text}
                                              </p>
                                              {messageImages.length > 0 ? (
                                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                                  {messageImages.map((url) => (
                                                    <div key={url} className="overflow-hidden rounded-lg border border-white/20 bg-white/10">
                                                      <img src={url} alt="Uploaded document" className="h-40 w-full object-cover" />
                                                    </div>
                                                  ))}
                                                </div>
                                              ) : null}
                                            </article>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>

                                  {inquiry.isResolved ? (
                                    <div className="flex min-w-0 flex-col lg:col-span-7">
                                      <div className="mb-3 flex items-center justify-between gap-3">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                          Resolution
                                        </h4>
                                        <div className="flex items-center gap-2">
                                          <button
                                            type="button"
                                            onClick={() => handleReopen(inquiry.id)}
                                            disabled={reopeningInquiryId === inquiry.id || resolvingInquiryId === inquiry.id}
                                            title="Reopen this inquiry"
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-slate-300 disabled:cursor-not-allowed disabled:opacity-50"
                                          >
                                            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                                            {reopeningInquiryId === inquiry.id ? "Reopening..." : "Reopen inquiry"}
                                          </button>
                                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-700">
                                            Resolved
                                          </span>
                                        </div>
                                      </div>
                                      <div className="border-l-2 border-emerald-500 bg-white px-5 py-4 shadow-sm">
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <p className="text-xs font-semibold text-slate-900">Official response</p>
                                          {inquiry.respondedAt ? (
                                            <time className="text-xs text-slate-500">
                                              {new Date(inquiry.respondedAt).toLocaleDateString("en-US", {
                                                month: "short",
                                                day: "numeric",
                                                year: "numeric",
                                              })}
                                            </time>
                                          ) : null}
                                        </div>
                                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-700 [overflow-wrap:anywhere]">
                                          {inquiry.response || "This inquiry was resolved without a recorded response."}
                                        </p>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="flex min-w-0 flex-col lg:col-span-7">
                                      <div className="mb-3 flex items-center justify-between gap-3">
                                        <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                          Resolution &amp; reply
                                        </h4>
                                        <div className="flex items-center gap-3">
                                          <button
                                            type="button"
                                            onClick={() => handleResolve(inquiry.id)}
                                            disabled={resolvingInquiryId === inquiry.id || sendingReplyId === inquiry.id}
                                            title="Close this inquiry"
                                            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                                            {resolvingInquiryId === inquiry.id ? "Resolving..." : "Mark as Resolved"}
                                          </button>
                                          <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">
                                            Open
                                          </span>
                                        </div>
                                      </div>
                                      <div className="flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all focus-within:border-cyan-600 focus-within:ring-2 focus-within:ring-cyan-600/20">
                                        <textarea
                                          value={replyText[inquiry.id] ?? ""}
                                          onChange={(event) =>
                                            setReplyText((prev) => ({
                                              ...prev,
                                              [inquiry.id]: event.target.value,
                                            }))
                                          }
                                          rows={5}
                                          className="min-h-[140px] w-full resize-y bg-transparent p-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                                          placeholder="Type your official response to the grantee here..."
                                        />
                                        {replyError[inquiry.id] ? (
                                          <p role="alert" className="px-4 pb-3 text-sm text-rose-700">{replyError[inquiry.id]}</p>
                                        ) : null}
                                        <div className="mt-auto flex justify-end border-t border-slate-100 bg-slate-50 px-4 py-3">
                                          <button
                                            type="button"
                                            onClick={() => handleSendReply(inquiry.id)}
                                            disabled={sendingReplyId === inquiry.id || resolvingInquiryId === inquiry.id || !(replyText[inquiry.id] ?? "").trim()}
                                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                                          >
                                            <Send className="h-4 w-4" aria-hidden="true" />
                                            {sendingReplyId === inquiry.id ? "Sending..." : "Send reply"}
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )}
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
