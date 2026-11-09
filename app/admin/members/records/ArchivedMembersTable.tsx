"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import AdminExportButton from "../../AdminExportButton";
import type { KKProfilingRegistration } from "../../kk-profiling/types";
import { ArchivedMemberRowActions } from "./ArchivedMemberRowActions";

export function ArchivedMembersTable({
  records,
  initialQuery,
}: {
  records: KKProfilingRegistration[];
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const normalizedQuery = query.trim();
      if (normalizedQuery) params.set("q", normalizedQuery);
      else params.delete("q");
      params.set("page", "1");
      const search = params.toString();
      const currentSearch = searchParams.toString();
      if (search !== currentSearch) {
        router.replace(`${pathname}${search ? `?${search}` : ""}`, { scroll: false });
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pathname, query, router, searchParams]);

  return (
    <>
      <div className="flex items-center justify-between p-4 bg-white border-b border-slate-100">
        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Filter archived members by name, email, or classification</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, email, or classification..."
            title="Filters archived member profiles"
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
          />
        </label>
        <AdminExportButton
          href="/api/admin/members/records/export"
          label="Export Records"
          className="inline-flex shrink-0 items-center justify-center gap-2 self-start rounded-xl bg-[#0F3D5C] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] sm:self-auto"
          iconClassName="h-3.5 w-3.5"
        />
      </div>
      <div className="w-full overflow-x-auto whitespace-nowrap">
        <table className="w-full table-fixed overflow-hidden border-collapse text-left text-sm">
          <thead className="bg-[#0f172a] text-white">
            <tr className="text-xs font-semibold tracking-wider">
              <th className="w-[26%] px-3.5 py-3.5">NAME</th>
              <th className="w-[16%] px-3.5 py-3.5">AGE GROUP</th>
              <th className="w-[16%] px-3.5 py-3.5">CLASSIFICATION</th>
              <th className="w-[9%] px-3.5 py-3.5 text-center">SK VOTER</th>
              <th className="w-[11%] px-3.5 py-3.5 text-center">STATUS</th>
              <th className="w-[12%] whitespace-nowrap px-3.5 py-3.5">SUBMITTED</th>
              <th className="w-[10%] px-3.5 py-3.5 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {records.map((record) => {
              const memberName = record.user?.fullName || record.fullName;
              return (
                <tr key={record.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="px-3.5 py-3.5">
                    <div className="truncate font-semibold text-slate-900" title={memberName}>{memberName}</div>
                    <div className="block truncate text-xs text-slate-500" title={record.user?.email || record.email}>
                      {record.user?.email || record.email}
                    </div>
                  </td>
                  <td className="break-words px-3.5 py-3.5">{record.youthAgeGroup}</td>
                  <td className="break-words px-3.5 py-3.5">{record.youthClassification}</td>
                  <td className="px-3.5 py-3.5 text-center">{record.registeredSKVoter}</td>
                  <td className="px-3.5 py-3.5 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className={`inline-flex max-w-full items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        record.reviewStatus === "Rejected"
                          ? "bg-amber-50 text-amber-800"
                          : "bg-slate-100 text-slate-700"
                      }`}>
                        {record.reviewStatus}
                      </span>
                      {record.archivedReason === "Aged Out (Turned 31)" ? (
                        <span className="inline-flex max-w-full items-center rounded-full bg-yellow-50 px-2.5 py-0.5 text-[10px] font-medium text-yellow-800">
                          Aged Out (&gt;30 yrs)
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3.5 py-3.5 text-slate-500">{formatDate(record.submittedAt)}</td>
                  <td className="px-3.5 py-3.5 text-right">
                    <ArchivedMemberRowActions registration={record} />
                  </td>
                </tr>
              );
            })}
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                  No archived or rejected member profiles match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
