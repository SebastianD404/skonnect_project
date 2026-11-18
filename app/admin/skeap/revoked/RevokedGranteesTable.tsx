"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, Eye, FileText, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import AdminTablePaginationFooter from "../../AdminTablePaginationFooter";
import RevokedScholarInspectionModal, { type RevokedGranteeRecord } from "./RevokedScholarInspectionModal";
import RevocationProofViewer from "./RevocationProofViewer";

export default function RevokedGranteesTable({
  records,
  query,
  page,
  pageSize,
  totalCount,
}: {
  records: RevokedGranteeRecord[];
  query: string;
  page: number;
  pageSize: number;
  totalCount: number;
}) {
  const [searchQuery, setSearchQuery] = useState(query);
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRecord, setSelectedRecord] = useState<RevokedGranteeRecord | null>(null);
  const [proofGranteeId, setProofGranteeId] = useState<string | null>(null);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery) params.set("q", normalizedQuery);
    else params.delete("q");
    params.delete("search");
    params.set("page", "1");
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  }

  function getInitials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "—";
    return `${parts[0][0]}${parts.length > 1 ? parts[parts.length - 1][0] : ""}`.toUpperCase();
  }

  return (
    <>
      <form
        onSubmit={submitSearch}
        className="flex flex-col items-stretch justify-between gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center"
      >
        <label className="relative block w-full sm:max-w-sm">
          <span className="sr-only">Search revoked grantees by name, sitio, or reason</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search name, sitio, or reason..."
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
          />
        </label>
      </form>

      <div className="flex flex-col gap-3 p-3 md:hidden">
        {records.map((record) => (
          <article key={record.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                  {getInitials(record.fullName)}
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold text-slate-900" title={record.fullName}>
                    {record.fullName}
                  </h2>
                  {record.email ? <p className="mt-0.5 truncate text-xs text-slate-500">{record.email}</p> : null}
                </div>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-medium ring-1 ring-inset ${
                record.isPermanentlyBarred
                  ? "bg-rose-50 text-rose-700 ring-rose-600/20"
                  : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
              }`}>
                {record.isPermanentlyBarred ? "Permanently Barred" : "Eligible to Reapply"}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sitio</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{record.sitio || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date revoked</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{formatDate(record.revokedAt)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Reason</dt>
                <dd className="mt-0.5 line-clamp-2 max-w-md text-sm text-slate-600">{record.reason || "No reason recorded"}</dd>
                {record.revocationProofPath ? (
                  <dd className="mt-1.5">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setProofGranteeId(record.id);
                      }}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50/80 px-2.5 py-0.5 text-xs font-medium text-teal-700 transition-all hover:border-teal-300 hover:bg-teal-100 hover:shadow-2xs"
                      title="View supporting proof document"
                    >
                      <FileText className="h-3 w-3" aria-hidden="true" />
                      {record.revocationProofType || "Supporting Proof"}
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </dd>
                ) : null}
              </div>
            </dl>
            <div className="flex justify-end">
              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedRecord(record)}
                  aria-label={`View revocation details for ${record.fullName}`}
                  className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50"
                >
                  <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                  View
                </button>
              </div>
            </div>
          </article>
        ))}
        {records.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            No revoked grantees match your search.
          </div>
        ) : null}
      </div>

      <div className={`hidden w-full overflow-x-auto md:block ${isPending ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[1120px] table-fixed border-collapse text-left text-sm">
          <thead className="border-y border-slate-200/80 bg-slate-50/80 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            <tr>
              <th scope="col" className="w-[19%] px-4 py-3.5">Name</th>
              <th scope="col" className="w-[9%] px-4 py-3.5">Sitio</th>
              <th scope="col" className="w-[14%] px-4 py-3.5">Date Revoked</th>
              <th scope="col" className="w-[25%] px-4 py-3.5">Reason for Revocation</th>
              <th scope="col" className="w-[15%] px-4 py-3.5">Reapplication</th>
              <th scope="col" className="w-[18%] whitespace-nowrap px-4 py-3.5 text-right align-middle">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {records.map((record) => (
              <tr
                key={record.id}
                onClick={() => setSelectedRecord(record)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    setSelectedRecord(record);
                  }
                }}
                tabIndex={0}
                aria-label={`View revocation details for ${record.fullName}`}
                className="cursor-pointer align-middle transition-colors hover:bg-slate-50/70 focus-visible:bg-slate-50 focus-visible:outline-none"
              >
                <td className="px-4 py-4 align-middle">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                      {getInitials(record.fullName)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{record.fullName}</div>
                      {record.email ? <div className="mt-0.5 truncate text-xs text-slate-500">{record.email}</div> : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-4 align-middle">{record.sitio || "—"}</td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-600 align-middle">{formatDate(record.revokedAt)}</td>
                <td className="px-4 py-4 align-middle">
                  <p className="line-clamp-2 max-w-md text-sm text-slate-600">{record.reason || "No reason recorded"}</p>
                  {record.revocationProofPath ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setProofGranteeId(record.id);
                      }}
                      className="mt-1.5 inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50/80 px-2.5 py-0.5 text-xs font-medium text-teal-700 transition-all hover:border-teal-300 hover:bg-teal-100 hover:shadow-2xs"
                      title="View supporting proof document"
                    >
                      <FileText className="h-3 w-3" aria-hidden="true" />
                      {record.revocationProofType || "Supporting Proof"}
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                </td>
                <td className="px-4 py-4 align-middle">
                  <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset ${
                    record.isPermanentlyBarred
                      ? "bg-rose-50 text-rose-700 ring-rose-600/20"
                      : "bg-emerald-50 text-emerald-700 ring-emerald-600/20"
                  }`}>
                    {record.isPermanentlyBarred ? "Permanently Barred" : "Eligible to Reapply"}
                  </span>
                </td>
                <td className="whitespace-nowrap px-4 py-4 text-right align-middle">
                  <div className="inline-flex items-center justify-end gap-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setSelectedRecord(record);
                      }}
                      aria-label={`View revocation details for ${record.fullName}`}
                      className="inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 shadow-2xs transition-colors hover:border-slate-300 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      View
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {records.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500 align-middle">
                  No revoked grantees match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <AdminTablePaginationFooter
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        basePath="/admin/skeap/revoked"
        startNavigation={startTransition}
      />
      <RevokedScholarInspectionModal
        key={selectedRecord?.id ?? "closed"}
        record={selectedRecord}
        onClose={() => setSelectedRecord(null)}
        onViewProof={setProofGranteeId}
      />
      {proofGranteeId ? (
        <RevocationProofViewer
          granteeId={proofGranteeId}
          onClose={() => setProofGranteeId(null)}
        />
      ) : null}
    </>
  );
}
