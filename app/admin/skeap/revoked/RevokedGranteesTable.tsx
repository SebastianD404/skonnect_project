"use client";

import { useState, useTransition, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import AdminTablePaginationFooter from "../../AdminTablePaginationFooter";

export type RevokedGranteeRow = {
  id: string;
  fullName: string;
  email: string | null;
  sitio: string | null;
  dateRevoked: Date;
  reason: string | null;
};

export default function RevokedGranteesTable({
  records,
  query,
  page,
  pageSize,
  totalCount,
}: {
  records: RevokedGranteeRow[];
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

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    const normalizedQuery = searchQuery.trim();
    if (normalizedQuery) params.set("q", normalizedQuery);
    else params.delete("q");
    params.set("page", "1");
    startTransition(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
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
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-9 items-center justify-center rounded-xl bg-[#0F3D5C] px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] disabled:cursor-wait disabled:opacity-60"
        >
          Search
        </button>
      </form>

      <div className="flex flex-col gap-3 p-3 md:hidden">
        {records.map((record) => (
          <article key={record.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <h2 className="min-w-0 truncate text-sm font-bold text-slate-900" title={record.fullName}>
                {record.fullName}
              </h2>
              <span className="shrink-0 rounded-full bg-rose-50 px-2.5 py-1 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-200">
                Revoked
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Sitio</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{record.sitio || "—"}</dd>
              </div>
              <div>
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date revoked</dt>
                <dd className="mt-0.5 font-medium text-slate-700">{formatDate(record.dateRevoked)}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Reason</dt>
                <dd className="mt-0.5 break-words text-slate-600">{record.reason || "No reason recorded"}</dd>
              </div>
            </dl>
          </article>
        ))}
        {records.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
            No revoked grantees match your search.
          </div>
        ) : null}
      </div>

      <div className={`hidden w-full overflow-x-auto md:block ${isPending ? "opacity-60" : ""}`}>
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm">
          <thead className="bg-gradient-to-r from-slate-900 to-cyan-900 text-cyan-50">
            <tr className="text-[11px] font-bold uppercase tracking-wider">
              <th scope="col" className="w-[25%] px-4 py-3.5">Name</th>
              <th scope="col" className="w-[16%] px-4 py-3.5">Sitio</th>
              <th scope="col" className="w-[18%] px-4 py-3.5">Date Revoked</th>
              <th scope="col" className="w-[41%] px-4 py-3.5">Reason for Revocation</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {records.map((record) => (
              <tr key={record.id} className="align-top transition-colors hover:bg-slate-50/70">
                <td className="px-4 py-4">
                  <div className="font-semibold text-slate-900">{record.fullName}</div>
                  {record.email ? <div className="mt-0.5 truncate text-xs text-slate-500">{record.email}</div> : null}
                </td>
                <td className="px-4 py-4">{record.sitio || "—"}</td>
                <td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatDate(record.dateRevoked)}</td>
                <td className="whitespace-normal px-4 py-4 text-slate-600">{record.reason || "No reason recorded"}</td>
              </tr>
            ))}
            {records.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-sm text-slate-500">
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
    </>
  );
}
