"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
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
  delta: string;
  up: boolean;
  iconName: "Users" | "CalendarDays" | "Inbox" | "Check";
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
  const [searchQuery, setSearchQuery] = useState("");

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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6 items-stretch">
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
            </div>

            <div className="flex flex-col gap-6 h-full">
              <div className="flex-1 bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col">
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
