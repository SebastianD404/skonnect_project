"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
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

interface AdminDashboardPageClientProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  stats: StatItem[];
  profilingRegistrationCount: number;
  profilingSeries: number[];
  profilingMonths: string[];
  recentInquiries: InquiryItem[];
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
}: AdminDashboardPageClientProps) {
  const router = useRouter();
  const { searchQuery } = useAdminSearch();

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
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <DashboardHeaderWrapper
        dateLabel={dateLabel}
        openInquiryCount={openInquiryCount}
        pendingSubmissionCount={pendingSubmissionCount}
        stats={stats}
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
                <button
                  type="button"
                  onClick={() => router.push("/admin/inquiries")}
                  className="group flex items-center gap-1 text-xs font-semibold text-cyan-600 transition-colors hover:text-cyan-700"
                >
                  View all
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </button>
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
                    <button
                      key={inquiry.id}
                      type="button"
                      onClick={() => router.push("/admin/inquiries")}
                      className="block w-full px-6 py-4 text-left transition-colors hover:bg-slate-50"
                    >
                      <p className="truncate text-sm font-semibold text-slate-800">{inquiry.subject}</p>
                      <p className="mt-1 truncate text-xs text-slate-500">
                        {inquiry.user.fullName} · {inquiry.message}
                      </p>
                    </button>
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

              {pendingSubmissionCount === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 shadow-sm">
                    <div className="absolute inset-0 rounded-full bg-emerald-100/30 blur-md" />
                    <FileCheck className="relative z-10 h-7 w-7 text-emerald-600" />
                  </div>
                  <h4 className="mb-1 text-sm font-bold text-slate-900">All Caught Up!</h4>
                  <p className="mb-6 max-w-[240px] text-xs leading-relaxed text-slate-500">
                    Grantee grade evaluations and COE uploads are fully processed.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/admin/submissions")}
                    className="group flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-semibold text-slate-700 shadow-sm transition-all hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                  >
                    View All Submissions
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 transition-all group-hover:translate-x-0.5 group-hover:text-slate-600" />
                  </button>
                </div>
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                  <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-100 bg-white text-amber-600 shadow-sm">
                    <div className="absolute inset-0 rounded-full bg-amber-100/50 blur-md" />
                    <FileCheck className="relative z-10 h-7 w-7" />
                  </div>
                  <h4 className="mb-1 text-sm font-bold text-slate-900">
                    {pendingSubmissionCount} document{pendingSubmissionCount === 1 ? "" : "s"} need review
                  </h4>
                  <p className="mb-6 max-w-[240px] text-xs leading-relaxed text-slate-500">
                    Review submitted grade evaluations and COE uploads.
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/admin/submissions")}
                    className="group flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-slate-800"
                  >
                    Review pending documents
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </button>
                </div>
              )}
              </div>
            </section>
      </div>
    </main>
  );
}
