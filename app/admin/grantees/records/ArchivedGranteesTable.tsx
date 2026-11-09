"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";

type HistoricalGranteeRecord = {
  id: string;
  userId: string;
  status: string;
  yearLevel: string;
  school: string;
  dateEnrolled: Date;
  dateRemoved: Date | null;
  remarks: string | null;
  updatedAt: Date;
  graduatedAt: Date | null;
  fullName: string | null;
  email: string | null;
};

type StatusTab = "ALL" | "GRADUATED" | "REMOVED";

const TABS: { value: StatusTab; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "GRADUATED", label: "Graduated" },
  { value: "REMOVED", label: "Removed" },
];

export default function ArchivedGranteesTable({
  allRecords,
  initialQuery,
}: {
  allRecords: HistoricalGranteeRecord[];
  initialQuery: string;
}) {
  const [activeTab, setActiveTab] = useState<StatusTab>("ALL");
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isPending, startTransition] = useTransition();

  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return allRecords.filter((record) => {
      const matchesTab =
        activeTab === "ALL" ||
        (activeTab === "GRADUATED" && record.status === "GRADUATED") ||
        (activeTab === "REMOVED" && record.status === "REMOVED");
      const matchesSearch =
        !normalizedQuery ||
        [record.fullName, record.email, record.school, record.yearLevel, record.remarks]
          .some((value) => value?.toLowerCase().includes(normalizedQuery));

      return matchesTab && matchesSearch;
    });
  }, [activeTab, allRecords, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const pageRecords = useMemo(
    () => filteredRecords.slice((page - 1) * pageSize, page * pageSize),
    [filteredRecords, page, pageSize],
  );

  return (
    <>
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Filter archived grantees by name, email, school, or remarks</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => {
              setCurrentPage(1);
              setSearchQuery(event.target.value);
            }}
            placeholder="Filter by name, email, or classification..."
            title="Filters archived grantee profiles"
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
          />
        </label>

        <nav aria-label="Filter historical grantee records" className="flex shrink-0 items-center gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setCurrentPage(1);
                startTransition(() => setActiveTab(value));
              }}
              aria-pressed={activeTab === value}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-200 ${
                activeTab === value
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="w-full overflow-x-auto whitespace-nowrap">
        <table className="w-full min-w-[900px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-gradient-to-r from-slate-900 to-cyan-900 text-cyan-50">
            <tr className="text-[11px] font-bold uppercase tracking-wider">
              <th className="w-[23%] px-4 py-3.5">Name</th>
              <th className="w-[11%] px-4 py-3.5">Status</th>
              <th className="w-[22%] px-4 py-3.5">School / year</th>
              <th className="w-[14%] px-4 py-3.5">Enrolled</th>
              <th className="w-[14%] px-4 py-3.5">End date</th>
              <th className="w-[11%] px-4 py-3.5">Remarks</th>
              <th className="w-[5%] px-4 py-3.5 text-right">View</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-100 text-slate-700 transition-opacity duration-150 ease-in-out ${isPending ? "opacity-60" : "opacity-100"}`}>
            {pageRecords.map((record) => {
              const endDate = record.graduatedAt ?? record.dateRemoved;
              return (
                <tr key={record.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-3.5">
                    <div className="truncate font-semibold text-slate-900" title={record.fullName ?? "Unknown scholar"}>
                      {record.fullName ?? "Unknown scholar"}
                    </div>
                    <div className="truncate text-xs text-slate-500" title={record.email ?? ""}>
                      {record.email ?? "No email"}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                      record.status === "GRADUATED"
                        ? "bg-slate-100 text-slate-700"
                        : "bg-rose-100 text-rose-700"
                    }`}>
                      {record.status === "GRADUATED" ? "Graduated" : "Removed"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="truncate font-medium text-slate-900" title={record.school}>{record.school}</div>
                    <div className="truncate text-xs text-slate-500" title={record.yearLevel}>{record.yearLevel}</div>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-500">{formatDate(record.dateEnrolled)}</td>
                  <td className="whitespace-nowrap px-4 py-3.5 font-medium text-slate-700">
                    {endDate ? formatDate(endDate) : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="truncate text-slate-600" title={record.remarks ?? ""}>{record.remarks || "—"}</div>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <Link
                      href={`/admin/grantees/${record.id}`}
                      title="View archived grantee record"
                      aria-label="View archived grantee record"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95"
                    >
                      <Eye className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </td>
                </tr>
              );
            })}
            {pageRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-sm text-slate-500">
                  No historical grantee records match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row">
        <div className="flex flex-wrap items-center gap-4">
          <span className="text-xs font-medium text-slate-500">
            {filteredRecords.length === 0 ? (
              <span>No records found</span>
            ) : (
              <span className="font-bold text-slate-700">
                {filteredRecords.length} result{filteredRecords.length === 1 ? "" : "s"}
              </span>
            )}
          </span>
          <label className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
            <span className="text-[11px] font-medium text-slate-400">Show</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-cyan-600"
            >
              <option value={10}>10 rows</option>
              <option value={20}>20 rows</option>
              <option value={50}>50 rows</option>
            </select>
          </label>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={page <= 1 || filteredRecords.length === 0}
            onClick={() => setCurrentPage(page - 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Previous
          </button>
          <span className="px-1 text-xs font-medium text-slate-500">
            Page <span className="font-bold text-slate-700">{page}</span> of{" "}
            <span className="font-bold text-slate-700">{totalPages}</span>
          </span>
          <button
            type="button"
            disabled={page >= totalPages || filteredRecords.length === 0}
            onClick={() => setCurrentPage(page + 1)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
