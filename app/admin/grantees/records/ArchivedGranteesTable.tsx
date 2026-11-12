"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ADMIN_TABLE_PAGE_SIZES, DEFAULT_ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-pagination";

type HistoricalGranteeRecord = {
  id: string;
  yearLevel: string;
  school: string;
  dateEnrolled: Date;
  remarks: string | null;
  graduatedAt: Date | null;
  fullName: string | null;
  email: string | null;
};

export default function ArchivedGranteesTable({
  allRecords,
  initialQuery,
}: {
  allRecords: HistoricalGranteeRecord[];
  initialQuery: string;
}) {
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_ADMIN_TABLE_PAGE_SIZE);
  const filteredRecords = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return allRecords.filter((record) =>
      !normalizedQuery ||
      [record.fullName, record.email, record.school, record.yearLevel, record.remarks]
        .some((value) => value?.toLowerCase().includes(normalizedQuery))
    );
  }, [allRecords, searchQuery]);

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

        <p className="text-xs font-medium text-slate-500">Graduated scholars only</p>
      </div>

      <div className="flex flex-col gap-3 p-3 md:hidden">
        {pageRecords.map((record) => {
          const endDate = record.graduatedAt;
          return (
            <article key={record.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold text-slate-900" title={record.fullName ?? "Unknown scholar"}>
                    {record.fullName ?? "Unknown scholar"}
                  </h3>
                  <p className="mt-0.5 truncate text-xs text-slate-500" title={record.email ?? ""}>
                    {record.email ?? "No email"}
                  </p>
                </div>
                <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-700">
                  Graduated
                </span>
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                <div className="col-span-2 min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">School / year</dt>
                  <dd className="mt-0.5 truncate font-semibold text-slate-800" title={record.school}>{record.school}</dd>
                  <dd className="text-[11px] text-slate-500">{record.yearLevel}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Enrolled</dt>
                  <dd className="mt-0.5 break-words font-medium text-slate-700">{formatDate(record.dateEnrolled)}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">End date</dt>
                  <dd className={`mt-0.5 break-words font-medium ${endDate ? "text-slate-700" : "text-slate-400"}`}>
                    {endDate ? formatDate(endDate) : "—"}
                  </dd>
                </div>
                <div className="col-span-2 min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Remarks</dt>
                  <dd className="mt-0.5 break-words text-slate-600">{record.remarks || "—"}</dd>
                </div>
              </dl>

              <div className="flex justify-end border-t border-slate-100 pt-2">
                <Link
                  href={`/admin/grantees/${record.id}`}
                  title="View archived grantee record"
                  aria-label={`View archived record for ${record.fullName ?? "grantee"}`}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-slate-100 px-3 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-200"
                >
                  <Eye className="h-4 w-4" aria-hidden="true" />
                  View record
                </Link>
              </div>
            </article>
          );
        })}
        {pageRecords.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            No historical grantee records match your search.
          </div>
        ) : null}
      </div>

      <div className="hidden w-full overflow-x-auto whitespace-nowrap md:block">
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
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {pageRecords.map((record) => {
              const endDate = record.graduatedAt;
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
                    <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                      Graduated
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

      <div className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50/50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3.5">
        <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-start sm:gap-4">
          <span className="shrink-0 text-xs font-medium text-slate-500">
            {filteredRecords.length === 0 ? (
              <span>No records found</span>
            ) : (
              <span className="font-bold text-slate-700">
                {filteredRecords.length} result{filteredRecords.length === 1 ? "" : "s"}
              </span>
            )}
          </span>
          <label className="flex shrink-0 items-center gap-2 sm:border-l sm:border-slate-200 sm:pl-4">
            <span className="text-[11px] font-medium text-slate-500 sm:text-slate-400">Rows</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-cyan-600"
            >
              {ADMIN_TABLE_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size} rows</option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 sm:w-auto">
          <button
            type="button"
            disabled={page <= 1 || filteredRecords.length === 0}
            onClick={() => setCurrentPage(page - 1)}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8"
          >
            Previous
          </button>
          <span className="whitespace-nowrap px-1 text-center text-xs font-medium text-slate-500">
            Page <span className="font-bold text-slate-700">{page}</span> of{" "}
            <span className="font-bold text-slate-700">{totalPages}</span>
          </span>
          <button
            type="button"
            disabled={page >= totalPages || filteredRecords.length === 0}
            onClick={() => setCurrentPage(page + 1)}
            className="min-h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8"
          >
            Next
          </button>
        </div>
      </div>
    </>
  );
}
