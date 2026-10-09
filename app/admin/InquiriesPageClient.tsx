"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, Clock, Inbox, RotateCcw, Search, Send, TrendingDown, TrendingUp } from "lucide-react";
import { useAdminSearch } from "./AdminSearchContext";
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
  inquiryCounts: Record<"ALL" | "OPEN" | "RESOLVED", number>;
  operationalStats: {
    activeBacklog: number;
    receivedToday: number;
    receivedYesterday: number;
    resolvedThisMonth: number;
    resolvedLastMonth: number;
    averageResponseTime: number | null;
    previousAverageResponseTime: number | null;
  };
}

const INQUIRY_PAGE_SIZE = 15;

const INQUIRY_FILTERS: Array<{ label: string; value: "ALL" | "OPEN" | "RESOLVED" }> = [
  { label: "All", value: "ALL" },
  { label: "Open", value: "OPEN" },
  { label: "Resolved", value: "RESOLVED" },
];

export default function InquiriesPageClient({
  inquiries,
  inquiryCounts,
  operationalStats,
}: InquiriesPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetInquiryId = searchParams.get("id");
  const { searchQuery, setSearchQuery } = useAdminSearch();
  const [statusFilter, setStatusFilter] = useState<"ALL" | "OPEN" | "RESOLVED">("ALL");
  const [selectedInquiryId, setSelectedInquiryId] = useState<string | null>(inquiries[0]?.id ?? null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [localInquiries, setLocalInquiries] = useState(inquiries);
  const [counts, setCounts] = useState(inquiryCounts);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const conversationContainerRef = useRef<HTMLDivElement>(null);
  const [replyText, setReplyText] = useState<Record<string, string>>({});
  const [sendingReplyId, setSendingReplyId] = useState<string | null>(null);
  const [resolvingInquiryId, setResolvingInquiryId] = useState<string | null>(null);
  const [reopeningInquiryId, setReopeningInquiryId] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<Record<string, string>>({});
  const appliedDeepLinkId = useRef<string | null>(null);

  useEffect(() => {
    setLocalInquiries((current) => {
      const firstPageIds = new Set(inquiries.map((inquiry) => inquiry.id));
      return [...inquiries, ...current.filter((inquiry) => !firstPageIds.has(inquiry.id))];
    });
    setCounts(inquiryCounts);
  }, [inquiries, inquiryCounts]);

  useEffect(() => {
    if (!targetInquiryId || appliedDeepLinkId.current === targetInquiryId) return;
    const targetId = targetInquiryId;
    let active = true;
    appliedDeepLinkId.current = targetId;

    async function selectTargetInquiry() {
      let target = localInquiries.find((inquiry) => inquiry.id === targetId);
      if (!target) {
        try {
          const response = await fetch(`/api/admin/inquiries?id=${encodeURIComponent(targetId)}`, {
            cache: "no-store",
          });
          const payload = await response.json();
          if (!response.ok) throw new Error(payload.error ?? "Unable to load the selected inquiry.");
          const fetchedTarget: InquiryRow | undefined = Array.isArray(payload.inquiries)
            ? payload.inquiries[0]
            : undefined;
          target = fetchedTarget;
          if (fetchedTarget && active) {
            setLocalInquiries((current) => current.some((inquiry) => inquiry.id === fetchedTarget.id)
              ? current
              : [...current, fetchedTarget]);
          }
        } catch (error) {
          if (active) {
            setLoadMoreError(error instanceof Error ? error.message : "Unable to load the selected inquiry.");
          }
          return;
        }
      }
      if (!target || !active) return;
      setSelectedInquiryId(targetId);
      setStatusFilter("ALL");
      setSearchQuery("");
    }

    void selectTargetInquiry();
    return () => {
      active = false;
    };
  }, [localInquiries, setSearchQuery, targetInquiryId]);

  useEffect(() => {
    const refreshInquiries = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") refreshInquiries();
    };

    const intervalId = window.setInterval(refreshInquiries, 10_000);
    window.addEventListener("focus", refreshInquiries);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshInquiries);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

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

  const selectedInquiry = filteredInquiries.find((item) => item.id === selectedInquiryId) ?? null;
  const statusLoadedCount = localInquiries.filter((inquiry) =>
    statusFilter === "ALL" ||
    (statusFilter === "OPEN" ? !inquiry.isResolved : inquiry.isResolved)
  ).length;
  const activeTotalCount = counts[statusFilter];
  const selectedConversationKey = useMemo(() => {
    return selectedInquiry
      ? getConversationMessages(selectedInquiry)
          .map((message) => `${message.id}:${message.createdAt}:${message.text}`)
          .join("|")
      : "";
  }, [selectedInquiry]);

  useEffect(() => {
    if (selectedInquiryId && conversationContainerRef.current) {
      conversationContainerRef.current.scrollTop = conversationContainerRef.current.scrollHeight;
    }
  }, [selectedInquiryId, selectedConversationKey]);

  const operationalMetrics = useMemo(() => {
    const {
      activeBacklog,
      receivedToday,
      receivedYesterday,
      resolvedThisMonth,
      resolvedLastMonth,
      averageResponseTime,
      previousAverageResponseTime,
    } = operationalStats;
    const formatDuration = (milliseconds: number | null) => {
      if (milliseconds === null) return "N/A";
      const minutes = Math.round(milliseconds / 60_000);
      if (minutes < 60) return `${minutes}m`;
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}m`;
    };
    const receivedChange = receivedYesterday === 0
      ? receivedToday === 0 ? "0% vs yesterday" : `+${receivedToday} vs yesterday`
      : `${Math.round(((receivedToday - receivedYesterday) / receivedYesterday) * 100) > 0 ? "+" : ""}${Math.round(((receivedToday - receivedYesterday) / receivedYesterday) * 100)}% vs yesterday`;
    const resolvedChange = resolvedThisMonth - resolvedLastMonth;
    const responseTimeChange = averageResponseTime === null
      ? "Pending data"
      : previousAverageResponseTime === null
        ? averageResponseTime <= 60 * 60_000 ? "Fast response" : "No prior data"
        : `${Math.round((averageResponseTime - previousAverageResponseTime) / 60_000) > 0 ? "+" : ""}${Math.round((averageResponseTime - previousAverageResponseTime) / 60_000)}m`;

    return [
      {
        label: "Open Inquiries",
        value: String(activeBacklog),
        description: "unresolved items",
        trend: activeBacklog > 0 ? "Requires Action" : "All clear",
        icon: Inbox,
        tone: activeBacklog > 0 ? "bg-amber-50 text-amber-600" : "bg-emerald-50 text-emerald-600",
        trendIcon: null,
      },
      {
        label: "Received Today",
        value: String(receivedToday),
        description: "submitted today",
        trend: receivedChange,
        icon: CalendarDays,
        tone: "bg-slate-100 text-slate-600",
        trendIcon: null,
      },
      {
        label: "Resolved This Month",
        value: String(resolvedThisMonth),
        description: "closed this month",
        trend: `${resolvedChange > 0 ? "+" : ""}${resolvedChange}`,
        icon: CheckCircle2,
        tone: "bg-emerald-50 text-emerald-600",
        trendIcon: resolvedChange >= 0 ? TrendingUp : TrendingDown,
      },
      {
        label: "Avg Response Time",
        value: averageResponseTime === null ? "No replies yet" : formatDuration(averageResponseTime),
        description: "average submission-to-reply time",
        trend: responseTimeChange,
        icon: Clock,
        tone: averageResponseTime !== null && (previousAverageResponseTime !== null
          ? averageResponseTime <= previousAverageResponseTime
          : averageResponseTime <= 60 * 60_000)
          ? "bg-emerald-50 text-emerald-600"
          : "bg-slate-100 text-slate-600",
        trendIcon: averageResponseTime !== null && (previousAverageResponseTime !== null
          ? averageResponseTime <= previousAverageResponseTime
          : averageResponseTime <= 60 * 60_000)
          ? TrendingDown
          : previousAverageResponseTime !== null && averageResponseTime !== null ? TrendingUp : null,
      },
    ];
  }, [operationalStats]);

  async function loadMoreInquiries() {
    if (isLoadingMore || statusLoadedCount === 0 || statusLoadedCount >= activeTotalCount) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextPage = Math.floor(statusLoadedCount / INQUIRY_PAGE_SIZE) + 1;
      const params = new URLSearchParams({
        page: String(nextPage),
        limit: String(INQUIRY_PAGE_SIZE),
        status: statusFilter,
      });
      const response = await fetch(`/api/admin/inquiries?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load older inquiries.");

      const nextInquiries: InquiryRow[] = Array.isArray(payload.inquiries) ? payload.inquiries : [];
      setLocalInquiries((current) => {
        const existingIds = new Set(current.map((inquiry) => inquiry.id));
        return [...current, ...nextInquiries.filter((inquiry) => !existingIds.has(inquiry.id))];
      });
      if (typeof payload.totalCount === "number") {
        setCounts((current) => ({ ...current, [statusFilter]: payload.totalCount }));
      }
    } catch (loadError) {
      setLoadMoreError(loadError instanceof Error ? loadError.message : "Unable to load older inquiries.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  async function handleStatusFilterChange(nextFilter: "ALL" | "OPEN" | "RESOLVED") {
    setStatusFilter(nextFilter);
    setLoadMoreError(null);
    const hasLoadedMatchingInquiry = localInquiries.some((inquiry) =>
      nextFilter === "ALL" ||
      (nextFilter === "OPEN" ? !inquiry.isResolved : inquiry.isResolved)
    );
    if (nextFilter === "ALL" || hasLoadedMatchingInquiry || counts[nextFilter] === 0 || isLoadingMore) return;

    setIsLoadingMore(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: String(INQUIRY_PAGE_SIZE),
        status: nextFilter,
      });
      const response = await fetch(`/api/admin/inquiries?${params}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Unable to load inquiries.");
      const matchingInquiries: InquiryRow[] = Array.isArray(payload.inquiries) ? payload.inquiries : [];
      setLocalInquiries((current) => {
        const existingIds = new Set(current.map((inquiry) => inquiry.id));
        return [...current, ...matchingInquiries.filter((inquiry) => !existingIds.has(inquiry.id))];
      });
      if (typeof payload.totalCount === "number") {
        setCounts((current) => ({ ...current, [nextFilter]: payload.totalCount }));
      }
    } catch (error) {
      setLoadMoreError(error instanceof Error ? error.message : "Unable to load inquiries.");
    } finally {
      setIsLoadingMore(false);
    }
  }

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
      window.dispatchEvent(new Event("admin-inquiries-updated"));
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
      window.dispatchEvent(new Event("admin-inquiries-updated"));
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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="max-w-2xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Communication</span>
          <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Manage Inquiries</h1>
          <p className="text-sm leading-relaxed text-slate-500">
            Review, respond to, and resolve support questions and citizen concerns.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {operationalMetrics.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="group relative flex min-h-[172px] min-w-0 flex-col justify-between overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition-all hover:border-slate-300">
              <div className="relative z-10 flex items-center justify-between gap-3">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400">{stat.label}</span>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-600">
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className={`relative z-10 mt-4 tracking-tight ${stat.value === "No replies yet" ? "text-lg font-semibold text-slate-400" : "text-3xl font-black text-slate-900"}`}>
                {stat.value}
              </div>
              <div className="relative z-10 mt-2 flex min-w-0 items-center justify-between gap-2">
                <span className="min-w-0 truncate text-xs text-slate-500" title={stat.description}>{stat.description}</span>
                <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${stat.tone}`}>
                  {stat.trendIcon ? <stat.trendIcon className="h-3 w-3" /> : null}
                  {stat.trend}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex h-[min(720px,calc(100vh-390px))] min-h-[480px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <aside className={`${selectedInquiry ? "hidden md:flex" : "flex"} w-full shrink-0 flex-col bg-slate-50/50 md:w-[350px] md:border-r md:border-slate-200`}>
          <div className="space-y-3 border-b border-slate-200 bg-white p-4">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search inquiries or email..."
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-100 py-2 pl-9 pr-3 text-xs text-slate-700 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900"
              />
            </label>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
              {INQUIRY_FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  onClick={() => void handleStatusFilterChange(filter.value)}
                  aria-pressed={statusFilter === filter.value}
                  className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-all ${
                    statusFilter === filter.value
                      ? "bg-white font-semibold text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {filteredInquiries.length ? filteredInquiries.map((inquiry) => (
              <button
                key={inquiry.id}
                type="button"
                onClick={() => setSelectedInquiryId(inquiry.id)}
                aria-current={selectedInquiryId === inquiry.id ? "true" : undefined}
                className={`flex w-full flex-col gap-1.5 border-l-4 p-4 text-left transition-colors ${
                  selectedInquiryId === inquiry.id
                    ? "border-slate-900 bg-white shadow-sm"
                    : "border-transparent hover:bg-slate-100/80"
                }`}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-xs font-bold text-slate-900">{inquiry.user.fullName}</span>
                  <time className="shrink-0 text-[10px] text-slate-400">
                    {new Date(inquiry.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </time>
                </div>
                <p className="w-full truncate text-xs font-semibold text-slate-700">{inquiry.subject}</p>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    inquiry.isResolved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                  }`}>
                    {inquiry.isResolved ? "Resolved" : "Open"}
                  </span>
                  {!inquiry.isResolved && !inquiry.response ? (
                    <span className="h-2 w-2 rounded-full bg-amber-500" title="Needs response" />
                  ) : null}
                </div>
              </button>
            )) : (
              <div className="px-4 py-10 text-center">
                <p className="text-xs text-slate-500">No inquiries match the current search or filter.</p>
                {loadMoreError ? <p role="alert" className="mt-3 text-xs text-rose-600">{loadMoreError}</p> : null}
              </div>
            )}
            {filteredInquiries.length > 0 && statusLoadedCount < activeTotalCount ? (
              <div className="space-y-2 p-3">
                {loadMoreError ? <p role="alert" className="text-xs text-rose-600">{loadMoreError}</p> : null}
                <button
                  type="button"
                  onClick={() => void loadMoreInquiries()}
                  disabled={isLoadingMore}
                  className="w-full py-2.5 mt-4 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition-all disabled:cursor-wait disabled:opacity-60"
                >
                  {isLoadingMore ? "Loading..." : "Load older inquiries"}
                </button>
              </div>
            ) : null}
          </div>
        </aside>

        <section className={`${selectedInquiry ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-white`}>
          {selectedInquiry ? (
            <>
              <header className="flex items-start justify-between gap-4 border-b border-slate-200 bg-white p-4">
                <div className="flex min-w-0 items-start gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedInquiryId(null)}
                    className="mt-0.5 rounded-md p-1 text-slate-500 hover:bg-slate-100 md:hidden"
                    aria-label="Back to inquiry list"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold text-slate-900">{selectedInquiry.subject}</h2>
                    <p className="mt-0.5 truncate text-xs text-slate-500">
                      Submitted by <span className="font-medium text-slate-700">{selectedInquiry.user.fullName}</span>
                      {" "}({selectedInquiry.user.email})
                    </p>
                    <p className="mt-1 text-[10px] text-slate-400">
                      {new Date(selectedInquiry.createdAt).toLocaleString()}
                    </p>
                  </div>
                </div>
                {selectedInquiry.isResolved ? (
                  <button
                    type="button"
                    onClick={() => handleReopen(selectedInquiry.id)}
                    disabled={reopeningInquiryId === selectedInquiry.id || resolvingInquiryId === selectedInquiry.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                    {reopeningInquiryId === selectedInquiry.id ? "Reopening..." : "Reopen"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleResolve(selectedInquiry.id)}
                    disabled={resolvingInquiryId === selectedInquiry.id || sendingReplyId === selectedInquiry.id}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:scale-[1.02] hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                    {resolvingInquiryId === selectedInquiry.id ? "Resolving..." : "Mark as Resolved"}
                  </button>
                )}
              </header>

              <div
                ref={conversationContainerRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto bg-slate-50/30 p-4 sm:p-6"
              >
                {getConversationMessages(selectedInquiry).map((message) => {
                  const messageImages = extractUrls(message.text).filter(isImageUrl);
                  return (
                    <div
                      key={message.id}
                      className={`flex flex-col ${message.role === "admin" ? "items-end" : "items-start"}`}
                    >
                      <div className="mb-1 flex items-center gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                          {message.role === "admin" ? "SK official" : selectedInquiry.user.fullName}
                        </span>
                        <time className="text-[10px] text-slate-400">
                          {new Date(message.createdAt).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </time>
                      </div>
                      <article className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed ${
                        message.role === "admin"
                          ? "rounded-tr-none bg-slate-900 text-white"
                          : "rounded-tl-none border border-slate-200 bg-white text-slate-800 shadow-sm"
                      }`}>
                        <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{message.text}</p>
                        {messageImages.length ? (
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

              {replyError[selectedInquiry.id] ? (
                <p role="alert" className="border-t border-rose-100 bg-rose-50 px-4 py-2 text-sm text-rose-700">
                  {replyError[selectedInquiry.id]}
                </p>
              ) : null}

              {selectedInquiry.isResolved ? (
                <div className="border-t border-slate-200 bg-white p-4 text-xs text-slate-500">
                  This inquiry is resolved. Reopen it to send another reply.
                </div>
              ) : (
                <div className="space-y-3 border-t border-slate-200 bg-white p-4">
                  <label htmlFor={`inquiry-reply-${selectedInquiry.id}`} className="sr-only">Reply to inquiry</label>
                  <textarea
                    id={`inquiry-reply-${selectedInquiry.id}`}
                    value={replyText[selectedInquiry.id] ?? ""}
                    onChange={(event) => setReplyText((previous) => ({
                      ...previous,
                      [selectedInquiry.id]: event.target.value,
                    }))}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                      event.preventDefault();
                      void handleSendReply(selectedInquiry.id);
                    }}
                    rows={3}
                    placeholder="Reply to applicant..."
                    className="w-full resize-none rounded-lg border border-slate-200 p-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSendReply(selectedInquiry.id)}
                      disabled={sendingReplyId === selectedInquiry.id || resolvingInquiryId === selectedInquiry.id || !(replyText[selectedInquiry.id] ?? "").trim()}
                      className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Send className="h-3.5 w-3.5" aria-hidden="true" />
                      {sendingReplyId === selectedInquiry.id ? "Sending..." : "Send reply"}
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-slate-400">
              Select an inquiry from the left to view the conversation.
            </div>
          )}
        </section>
      </div>

      <div className="hidden flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-white p-4 sm:flex-row sm:p-5">
          <label className="relative block w-full sm:w-80">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              placeholder="Search subject, message, email..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 transition-colors focus:border-cyan-500"
            />
          </label>
          <div className="flex w-full shrink-0 items-center overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-auto">
            {INQUIRY_FILTERS.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setStatusFilter(filter.value)}
                aria-pressed={statusFilter === filter.value}
                className={`shrink-0 rounded-lg px-4 py-1.5 text-sm transition-all ${
                  statusFilter === filter.value
                    ? "bg-white font-semibold text-slate-900 shadow-sm"
                    : "font-medium text-slate-500 hover:text-slate-900"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

            <div className="w-full overflow-x-auto">
              <table className="w-full table-fixed border-collapse whitespace-nowrap text-left text-sm divide-y divide-slate-200">
                <thead className="relative z-30 bg-gradient-to-r from-slate-900 to-cyan-900">
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-cyan-50">
                    <th className="w-[25%] pl-6 pr-4 py-4 text-left sm:pl-8">Subject</th>
                    <th className="w-[20%] px-4 py-4 text-left">User</th>
                    <th className="w-[12%] px-4 py-4 text-left">Status</th>
                    <th className="w-[13%] px-4 py-4 text-left">Submitted</th>
                    <th className="w-[14%] px-4 py-4 text-left">Response</th>
                    <th className="w-[16%] pl-8 pr-6 py-4 text-left text-[11px] font-bold uppercase tracking-widest text-cyan-50 sm:pl-9">
                      Action
                    </th>
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
                            <td className="max-w-0 pl-6 pr-4 py-4 sm:pl-8">
                              <div className="truncate font-semibold text-slate-900" title={inquiry.subject}>
                                {inquiry.subject}
                              </div>
                              <div className="mt-0.5 truncate text-xs text-slate-500" title={inquiry.message}>
                                {inquiry.message}
                              </div>
                            </td>
                            <td className="max-w-0 px-4 py-4">
                              <div className="truncate font-medium text-slate-900" title={inquiry.user.fullName}>
                                {inquiry.user.fullName}
                              </div>
                              <div className="truncate text-xs text-slate-500" title={inquiry.user.email}>
                                {inquiry.user.email}
                              </div>
                            </td>
                            <td className="px-4 py-4">
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
                            <td className="px-4 py-4 text-slate-700">
                              {new Date(inquiry.createdAt).toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                              })}
                            </td>
                            <td className="px-4 py-4 text-slate-700">
                              {inquiry.respondedAt
                                ? new Date(inquiry.respondedAt).toLocaleDateString("en-US", {
                                    month: "short",
                                    day: "numeric",
                                    year: "numeric",
                                  })
                                : "—"}
                            </td>
                            <td className="px-4 py-4 sm:px-6">
                              <div className="flex justify-end sm:justify-start">
                                <button
                                  type="button"
                                  onClick={() => setExpandedId(isExpanded ? null : inquiry.id)}
                                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-100 hover:text-slate-900"
                                >
                                  {isExpanded ? "Hide" : "Details"}
                                  <ArrowRight className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="bg-slate-50/50">
                              <td colSpan={6} className="border-b border-slate-200 bg-slate-50/50 p-0 shadow-inner">
                                <div className="space-y-5 border-t border-slate-200 bg-slate-50/50 p-5 sm:p-6">
                                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <div className="flex items-center gap-3">
                                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Inquiry thread</h4>
                                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${inquiry.isResolved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                                        {inquiry.isResolved ? "Resolved" : "Open"}
                                      </span>
                                    </div>
                                    {inquiry.isResolved ? (
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
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleResolve(inquiry.id)}
                                        disabled={resolvingInquiryId === inquiry.id || sendingReplyId === inquiry.id}
                                        title="Close this inquiry"
                                        className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-white px-3.5 py-1.5 text-xs font-bold text-emerald-700 shadow-sm transition-all hover:scale-[1.02] hover:border-emerald-400 hover:bg-emerald-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:scale-100"
                                      >
                                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                                        {resolvingInquiryId === inquiry.id ? "Resolving..." : "Mark as Resolved"}
                                      </button>
                                    )}
                                  </div>

                                  <div className="max-h-[400px] space-y-4 overflow-y-auto custom-scroll rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
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

                                  {inquiry.isResolved ? (
                                    <div className="rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
                                      This inquiry is resolved. Reopen it to send another reply.
                                    </div>
                                  ) : (
                                    <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                                      <label htmlFor={`inquiry-reply-${inquiry.id}`} className="sr-only">Reply to inquiry</label>
                                      <textarea
                                        id={`inquiry-reply-${inquiry.id}`}
                                        value={replyText[inquiry.id] ?? ""}
                                        onChange={(event) =>
                                          setReplyText((prev) => ({
                                            ...prev,
                                            [inquiry.id]: event.target.value,
                                          }))
                                        }
                                        rows={3}
                                        className="w-full resize-y rounded-lg border border-slate-200 p-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20"
                                        placeholder="Type your official response to the grantee here..."
                                      />
                                      {replyError[inquiry.id] ? (
                                        <p role="alert" className="text-sm text-rose-700">{replyError[inquiry.id]}</p>
                                      ) : null}
                                      <div className="flex justify-end">
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
        </main>
  );
}
