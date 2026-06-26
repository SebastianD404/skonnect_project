"use client";

import { useState } from "react";
import { GranteeStatusTable, type GranteeTableRow } from "./grantees/GranteeStatusTable";
import DashboardHeaderWrapper from "./DashboardHeaderWrapper";
import Link from "next/link";
import { Check, Clock, Users } from "lucide-react";

interface StatItem {
  label: string;
  value: string;
  sub: string;
  delta: string;
  up: boolean;
  iconName: "Users" | "CalendarDays" | "Inbox" | "Check";
}

interface AdminGranteesPageClientProps {
  dateLabel: string;
  openInquiryCount: number;
  pendingSubmissionCount: number;
  stats: StatItem[];
  statsByPeriod?: Record<"Today" | "Week" | "Month" | "Quarter", StatItem[]>;
  grantees: GranteeTableRow[];
}

export default function AdminGranteesPageClient({
  dateLabel,
  openInquiryCount,
  pendingSubmissionCount,
  stats,
  statsByPeriod,
  grantees,
}: AdminGranteesPageClientProps) {
  const [searchQuery, setSearchQuery] = useState("");

  return (
    <>
      <DashboardHeaderWrapper
        dateLabel={dateLabel}
        openInquiryCount={openInquiryCount}
        pendingSubmissionCount={pendingSubmissionCount}
        stats={stats}
        statsByPeriod={statsByPeriod}
        onSearch={setSearchQuery}
      />

      <div className="flex-1 py-8">
        <div className="px-8 space-y-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-[#0F3D5C]">Grantee status</p>
                <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">Track scholar progress</h1>
                <p className="mt-2 max-w-2xl text-sm text-slate-500">
                  See the latest status, academic average, and enrollment details for every approved grantee.
                </p>
              </div>
            </div>
          </div>

          <GranteeStatusTable
            grantees={grantees}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
          />
        </div>
      </div>
    </>
  );
}
