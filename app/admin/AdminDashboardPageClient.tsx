"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileCheck, MessageSquare } from "lucide-react";
import { useAdminSearch } from "./AdminSearchContext";
import DashboardHeaderWrapper from "./DashboardHeaderWrapper";

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
  iconName: "Users" | "CalendarDays" | "Inbox" | "Check" | "FileText" | "CheckSquare" | "GraduationCap";
  delta?: string;
  up?: boolean;
  href?: string;
  accent?: "cyan" | "amber" | "emerald";
}

interface PendingReviewItem {
  id: string;
  semester: string;
  coeFileUrl: string;
  gradeFileUrl: string;
  submittedAt: string;
  grantee: {
    school: string;
    yearLevel: string;
    user: { fullName: string };
  };
}

interface DashboardOverview {
  stats: {
    totalGrantees: number;
    pendingApplications: number;
    openInquiries: number;
    documentReviews: number;
  };
  recentInquiries: InquiryItem[];
  pendingReviews: PendingReviewItem[];
}

interface AdminDashboardPageClientProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  stats: StatItem[];
  profilingRegistrationCount: number;
  profilingSeries: number[];
  profilingMonths: string[];
  recentInquiries: InquiryItem[];
  pendingReviews: PendingReviewItem[];
}

export default function AdminDashboardPageClient({
  dateLabel,
  openInquiryCount,
  pendingSubmissionCount,
  stats,
  profilingRegistrationCount,
  profilingSeries,
  profilingMonths,
  recentInquiries,
  pendingReviews,
}: AdminDashboardPageClientProps) {
  const { searchQuery } = useAdminSearch();
  const [overview, setOverview] = useState<DashboardOverview>({
    stats: {
      totalGrantees: Number(stats.find((stat) => stat.label === "Total Grantees")?.value ?? 0),
      pendingApplications: Number(stats.find((stat) => stat.label === "Pending Applications")?.value ?? 0),
      openInquiries: openInquiryCount,
      documentReviews: pendingSubmissionCount,
    },
    recentInquiries,
    pendingReviews,
  });
  const requestInProgress = useRef(false);

  useEffect(() => {
    let disposed = false;
    let controller: AbortController | null = null;

    const refreshOverview = async () => {
      if (disposed || document.visibilityState !== "visible" || requestInProgress.current) return;
      requestInProgress.current = true;
      controller = new AbortController();

      try {
        const response = await fetch("/api/admin/dashboard-stats", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to refresh the admin dashboard.");
        }
        if (!disposed) setOverview(data as DashboardOverview);
      } catch (error) {
        if (!disposed && !controller.signal.aborted) {
          console.error("Failed to refresh admin dashboard overview:", error);
        }
      } finally {
        requestInProgress.current = false;
      }
    };

    const interval = window.setInterval(refreshOverview, 15_000);
    const handleFocus = () => void refreshOverview();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshOverview();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      disposed = true;
      controller?.abort();
      requestInProgress.current = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const liveStats = useMemo(() => {
    const values: Record<string, number> = {
      "Total Grantees": overview.stats.totalGrantees,
      "Pending Applications": overview.stats.pendingApplications,
      "Open Inquiries": overview.stats.openInquiries,
      "Document Reviews": overview.stats.documentReviews,
    };
    return stats.map((stat) =>
      Object.hasOwn(values, stat.label) ? { ...stat, value: String(values[stat.label]) } : stat
    );
  }, [overview.stats, stats]);

  const filteredInquiries = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return overview.recentInquiries;
    }
    return overview.recentInquiries.filter((inquiry) => {
      return [inquiry.subject, inquiry.message, inquiry.user.fullName, inquiry.user.email]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [overview.recentInquiries, searchQuery]);


  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <DashboardHeaderWrapper
        dateLabel={dateLabel}
        openInquiryCount={overview.stats.openInquiries}
        pendingSubmissionCount={overview.stats.documentReviews}
        stats={liveStats}
        operationalSnapshot
      />

      <div className="flex items-center gap-4 px-8 py-2">
        <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Action Center</span>
        <div className="h-px flex-1 rounded-full bg-slate-200/60" />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 px-8 md:grid-cols-2">
            <section className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-gradient-to-r from-slate-900 via-cyan-800 to-cyan-500" />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.4]"
                style={{
                  backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />

              <div className="relative z-10 flex h-full flex-col">
              <header className="flex items-center justify-between border-b border-slate-100/80 bg-white/50 px-6 py-5 backdrop-blur-sm">
                <div>
                  <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Recent Inquiries</h4>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">Inbox</h3>
                </div>
                <Link
                  href="/admin/inquiries"
                  className="group flex items-center gap-1 text-xs font-semibold text-cyan-600 transition-colors hover:text-cyan-700"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </header>

              {filteredInquiries.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-slate-100 bg-white shadow-sm">
                    <div className="absolute inset-0 rounded-full bg-cyan-100/50 blur-md" />
                    <MessageSquare className="relative z-10 h-7 w-7 text-cyan-600" />
                  </div>
                  <h4 className="mb-1 text-sm font-bold text-slate-900">Your inbox is clear</h4>
                  <p className="max-w-[200px] text-xs leading-relaxed text-slate-500">
                    There are no new inquiries or citizen concerns right now.
                  </p>
                </div>
              ) : (
                <div className="flex-1 divide-y divide-slate-100">
                  {filteredInquiries.map((inquiry) => (
                    <Link
                      key={inquiry.id}
                      href={`/admin/inquiries?id=${encodeURIComponent(inquiry.id)}`}
                      className="block w-full px-6 py-4 text-left transition-colors hover:bg-slate-50"
                    >
                      <p className="truncate text-sm font-semibold text-slate-800">{inquiry.subject}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {inquiry.user.fullName} · {inquiry.message}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
              </div>
            </section>

            <section className="group relative flex min-h-[320px] flex-col overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-sm">
              <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-gradient-to-r from-slate-900 via-cyan-800 to-cyan-500" />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-[0.4]"
                style={{
                  backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
                  backgroundSize: "24px 24px",
                }}
              />

              <div className="relative z-10 flex h-full flex-col">
              <header className="flex items-center justify-between border-b border-slate-100/80 bg-white/50 px-6 py-5 backdrop-blur-sm">
                <div>
                  <h4 className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Document Reviews</h4>
                  <h3 className="text-lg font-bold tracking-tight text-slate-900">Pending reviews</h3>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="h-4 w-4 stroke-[3]" />
                </div>
              </header>

              {overview.stats.documentReviews === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 shadow-sm">
                    <div className="absolute inset-0 rounded-full bg-emerald-100/30 blur-md" />
                    <FileCheck className="relative z-10 h-7 w-7 text-emerald-600" />
                  </div>
                  <h4 className="mb-1 text-sm font-bold text-slate-900">All Caught Up!</h4>
                  <p className="mb-6 max-w-[240px] text-xs leading-relaxed text-slate-500">
                    Grantee grade evaluations and COE uploads are fully processed.
                  </p>
                  <Link
                    href="/admin/submissions"
                    className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  >
                    View All Submissions
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-slate-600" />
                  </Link>
                </div>
              ) : (
                <div className="flex flex-1 flex-col">
                  <div className="divide-y divide-slate-100">
                    {overview.pendingReviews.map((review) => (
                      <Link
                        key={review.id}
                        href="/admin/submissions"
                        className="block w-full px-6 py-4 text-left transition-colors hover:bg-slate-50"
                      >
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {review.grantee.user.fullName}
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">
                          {review.semester} · {review.grantee.school} · {review.grantee.yearLevel}
                        </p>
                        <p className="mt-1 text-[11px] font-medium text-amber-700">
                          {review.coeFileUrl ? "COE" : ""}
                          {review.coeFileUrl && review.gradeFileUrl ? " and " : ""}
                          {review.gradeFileUrl ? "Grades" : ""}
                          {" submitted for review"}
                        </p>
                      </Link>
                    ))}
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4">
                    <span className="text-xs font-medium text-slate-500">
                      {overview.stats.documentReviews} document{overview.stats.documentReviews === 1 ? "" : "s"} need review
                    </span>
                    <Link
                      href="/admin/submissions"
                      className="group flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-700 transition-colors hover:text-cyan-800"
                    >
                      Review all
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </div>
                </div>
              )}
              </div>
            </section>
      </div>
    </main>
  );
}
