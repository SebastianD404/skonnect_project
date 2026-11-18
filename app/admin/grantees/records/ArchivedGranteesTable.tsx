"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Eye, FileText, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { ADMIN_TABLE_PAGE_SIZES, DEFAULT_ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-pagination";
import AdminPaginationControls from "../../AdminPaginationControls";
import ExitClearanceViewer from "./ExitClearanceViewer";

type HistoricalGranteeRecord = {
  id: string;
  yearLevel: string;
  school: string;
  dateEnrolled: Date;
  remarks: string | null;
  graduationRemarks: string | null;
  graduatedAt: Date | null;
  exitClearanceStatus: string;
  exitClearanceUrl: string | null;
  fullName: string | null;
  profileFullName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
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
  const [previewGranteeId, setPreviewGranteeId] = useState<string | null>(null);
  const filteredRecords = useMemo(() => {
    const queryTokens = normalizeTokens(searchQuery);
    return allRecords.filter((record) => {
      const haystack = [
        record.lastName,
        record.firstName,
        record.middleName,
        record.profileFullName,
        record.fullName,
        record.email,
        record.school,
        record.yearLevel,
        record.remarks,
        record.graduationRemarks,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .replace(/[.,]/g, " ");
      return queryTokens.every((token) => haystack.includes(token));
    });
  }, [allRecords, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
  const page = Math.min(currentPage, totalPages);
  const firstResult = filteredRecords.length === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, filteredRecords.length);
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

      <div className="flex flex-col gap-3 p-3 xl:hidden">
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
                  <dd className="mt-0.5 break-words text-slate-600">{record.graduationRemarks || record.remarks || "—"}</dd>
                </div>
                <div className="col-span-2 flex items-center justify-between gap-3 border-t border-slate-200 pt-3">
                  <div className="min-w-0">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Exit clearance</dt>
                    <dd className="mt-1">
                      <ClearanceStatus
                        granteeId={record.id}
                        status={record.exitClearanceStatus}
                        url={record.exitClearanceUrl}
                        onView={setPreviewGranteeId}
                      />
                    </dd>
                  </div>
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

      <div className="hidden w-full min-w-0 xl:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead className="bg-gradient-to-r from-slate-900 to-cyan-900 text-cyan-50">
            <tr className="text-[11px] font-bold uppercase tracking-wider">
              <th className="w-[20%] px-3 py-3.5">Name</th>
              <th className="w-[16%] px-3 py-3.5">School / year</th>
              <th className="w-[12%] px-3 py-3.5">Enrolled</th>
              <th className="w-[12%] px-3 py-3.5">End date</th>
              <th className="w-[12%] px-3 py-3.5">Remarks</th>
              <th className="w-[18%] px-3 py-3.5">Exit clearance</th>
              <th className="w-[10%] py-3.5 pl-2 pr-6 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {pageRecords.map((record) => {
              const endDate = record.graduatedAt;
              return (
                <tr key={record.id} className="hover:bg-slate-50/70">
                  <td className="px-3 py-3.5">
                    <div className="truncate font-semibold text-slate-900" title={record.fullName ?? "Unknown scholar"}>
                      {record.fullName ?? "Unknown scholar"}
                    </div>
                    <div className="truncate text-xs text-slate-500" title={record.email ?? ""}>
                      {record.email ?? "No email"}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="truncate font-medium text-slate-900" title={record.school}>{record.school}</div>
                    <div className="truncate text-xs text-slate-500" title={record.yearLevel}>{record.yearLevel}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-xs text-slate-500">{formatDate(record.dateEnrolled)}</td>
                  <td className="whitespace-nowrap px-3 py-3.5 text-xs font-medium text-slate-700">
                    {endDate ? formatDate(endDate) : "—"}
                  </td>
                  <td className="px-3 py-3.5">
                    <div className="truncate text-slate-600" title={record.graduationRemarks || record.remarks || ""}>
                      {record.graduationRemarks || record.remarks || "—"}
                    </div>
                  </td>
                  <td className="px-3 py-3.5">
                    <ClearanceStatus
                      granteeId={record.id}
                      status={record.exitClearanceStatus}
                      url={record.exitClearanceUrl}
                      onView={setPreviewGranteeId}
                    />
                  </td>
                  <td className="py-3.5 pl-2 pr-6 text-right">
                    <Link
                      href={`/admin/grantees/${record.id}`}
                      title="View archived grantee record"
                      aria-label="View archived grantee record"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
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

      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 px-5 py-3.5">
        <div className="flex flex-wrap items-center gap-4">
          <p className="inline-flex h-8 items-center gap-1.5 text-xs text-slate-500 tabular-nums">
            {filteredRecords.length === 0 ? (
              <span>No records found</span>
            ) : (
              <>
                <span>Showing</span>
                <span className="font-semibold text-slate-900">{firstResult}–{lastResult}</span>
                <span>of</span>
                <span className="font-semibold text-slate-900">{filteredRecords.length.toLocaleString()}</span>
              </>
            )}
          </p>
          <label className="inline-flex h-8 items-center gap-2 border-l border-slate-200 pl-4">
            <span className="text-xs font-medium text-slate-500">Rows per page</span>
            <select
              aria-label="Rows per page"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setCurrentPage(1);
              }}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-400"
            >
              {ADMIN_TABLE_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>{size} rows</option>
              ))}
            </select>
          </label>
        </div>
        <AdminPaginationControls
          page={page}
          totalPages={totalPages}
          onPageChange={setCurrentPage}
          disabled={filteredRecords.length === 0}
        />
      </div>
      {previewGranteeId ? (
        <ExitClearanceViewer
          granteeId={previewGranteeId}
          onClose={() => setPreviewGranteeId(null)}
        />
      ) : null}
    </>
  );
}

function normalizeTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function ClearanceStatus({
  granteeId,
  status,
  url,
  onView,
}: {
  granteeId: string;
  status: string;
  url: string | null;
  onView: (granteeId: string) => void;
}) {
  if (url) {
    return (
      <div className="inline-flex items-center gap-2 whitespace-nowrap">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
          Cleared
        </span>
        <button
          type="button"
          onClick={() => onView(granteeId)}
          title="View Exit Clearance"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-2xs transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
        >
          <FileText className="h-[13px] w-[13px]" aria-hidden="true" />
          View
        </button>
      </div>
    );
  }

  if (status === "CLEARED" || status === "VERIFIED") {
    return (
      <span
        title="Verified via physical copy at SK Office"
        className="inline-flex whitespace-nowrap items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700"
      >
        Cleared
      </span>
    );
  }

  return (
    <span className="inline-flex whitespace-nowrap items-center rounded-full border border-amber-200/80 bg-amber-50/80 px-2.5 py-1 text-xs font-medium text-amber-700">
      Not recorded
    </span>
  );
}
