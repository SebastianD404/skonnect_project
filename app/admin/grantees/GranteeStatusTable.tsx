"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Eye, Loader2, Search, Trash2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { SerializableSkeapApplicationFormPayload } from "./[id]/SkeapApplicationReviewClient";
import AdminTablePaginationFooter from "../AdminTablePaginationFooter";

export interface GranteeTableRow {
  id: string;
  fullName: string;
  email: string;
  school: string;
  yearLevel: string;
  status: "ACTIVE" | "PROBATIONARY" | "GRADUATED" | "REMOVED";
  generalAverage: number | null;
  dateEnrolled: string;
  graduatedAt?: string | null;
  retentionExpiresAt?: string | null;
  updatedAt: string;
  detailsHref?: string;
  application?: SerializableSkeapApplicationFormPayload | null;
  applicationDownloadHref?: string;
}

const STATUS_LABELS: Record<GranteeTableRow["status"], string> = {
  ACTIVE: "Active",
  PROBATIONARY: "Active",
  GRADUATED: "Graduated",
  REMOVED: "Removed",
};

const STATUS_CLASSES: Record<GranteeTableRow["status"], string> = {
  ACTIVE: "bg-emerald-100 text-emerald-700",
  PROBATIONARY: "bg-emerald-100 text-emerald-700",
  GRADUATED: "bg-slate-100 text-slate-700",
  REMOVED: "bg-rose-100 text-rose-700",
};

const FILTERS: Array<{ label: string; value: "ALL" | GranteeTableRow["status"] }> = [
  { label: "All", value: "ALL" },
  { label: "Active", value: "ACTIVE" },
  { label: "Graduated", value: "GRADUATED" },
  { label: "Removed", value: "REMOVED" },
];

export function GranteeStatusTable({
  grantees,
  page,
  pageSize,
  totalCount,
  isLoading,
  startNavigation,
  onViewApplication,
  onDelete,
}: {
  grantees: GranteeTableRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  isLoading: boolean;
  startNavigation: (callback: () => void) => void;
  onViewApplication?: (grantee: GranteeTableRow) => void;
  onDelete?: (grantee: GranteeTableRow) => void;
}) {
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get("status")?.toUpperCase();
  const statusFilter = FILTERS.find((filter) => filter.value === requestedStatus)?.value ?? "ALL";
  const handleQueryChange = (value: string) => {
    setQuery(value);
  };

  const handleStatusFilterChange = (value: (typeof FILTERS)[number]["value"]) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "ALL") {
      params.delete("status");
    } else {
      params.set("status", value.toLowerCase());
    }
    params.set("page", "1");

    const queryString = params.toString();
    startNavigation(() => {
      router.replace(queryString ? `${pathname}?${queryString}` : pathname, { scroll: false });
    });
  };

  const filteredGrantees = useMemo(() => {
    return grantees.filter((grantee) => {
      const matchesStatus = statusFilter === "ALL" || (
        statusFilter === "ACTIVE"
          ? grantee.status === "ACTIVE" || grantee.status === "PROBATIONARY"
          : grantee.status === statusFilter
      );
      const lowerQuery = query.trim().toLowerCase();
      const matchesQuery =
        grantee.fullName.toLowerCase().includes(lowerQuery) ||
        grantee.email.toLowerCase().includes(lowerQuery) ||
        grantee.school.toLowerCase().includes(lowerQuery) ||
        grantee.yearLevel.toLowerCase().includes(lowerQuery);
      return matchesStatus && matchesQuery;
    });
  }, [grantees, query, statusFilter]);

  return (
    <div className="mt-4 flex h-fit flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-white p-4 sm:flex-row sm:p-5">
        <label className="relative block w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Filter the current grantee table"
            title="Filters rows in the current Grantees view"
            placeholder="Filter by name, email, or school..."
            value={query}
            onChange={(event) => handleQueryChange(event.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 transition-colors focus:border-cyan-500"
          />
        </label>

        <div className="flex w-full shrink-0 items-center overflow-x-auto rounded-xl bg-slate-100 p-1 sm:w-auto">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => handleStatusFilterChange(filter.value)}
              aria-pressed={statusFilter === filter.value}
              className={`shrink-0 rounded-lg px-4 py-1.5 text-sm transition-all ${
                statusFilter === filter.value
                  ? "bg-white font-semibold text-slate-900 shadow-sm"
                  : "font-medium text-slate-500 hover:text-slate-900"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className={`relative w-full overflow-x-auto ${isLoading ? "min-h-[200px]" : ""}`}>
        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="absolute inset-x-0 bottom-0 top-[50px] z-20 flex items-center justify-center bg-white/60 backdrop-blur-[1.5px] transition-all duration-300"
          >
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-cyan-600" />
              <span className="text-xs font-semibold text-slate-600">Loading records...</span>
            </div>
          </div>
        ) : null}
        <table className="w-full border-collapse whitespace-nowrap text-left text-sm">
          <thead className="relative z-30 bg-gradient-to-r from-slate-900 to-cyan-900">
            <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-cyan-50">
              <th className="px-6 py-4">Scholar</th>
              <th className="px-6 py-4">School / Year</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Average</th>
              <th className="px-6 py-4">Enrolled</th>
              <th className="px-6 py-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className={`divide-y divide-slate-100 bg-white text-sm transition-opacity duration-300 ${isLoading ? "pointer-events-none opacity-40" : "opacity-100"}`}>
            {filteredGrantees.map((grantee) => {
                const isBelowGwa = grantee.generalAverage !== null && grantee.generalAverage < 80;
                return (
                  <tr key={grantee.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F3D5C] text-xs font-bold text-white">
                          {grantee.fullName
                            .split(" ")
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((part) => part[0]?.toUpperCase())
                            .join("")}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-slate-900">{grantee.fullName}</div>
                          <div className="truncate text-xs text-slate-500">{grantee.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-900 font-medium">{grantee.school}</div>
                      <div className="text-xs text-slate-500">{grantee.yearLevel}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[grantee.status]}`}>
                        {STATUS_LABELS[grantee.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className={`${isBelowGwa ? "text-rose-700 font-semibold" : "text-slate-900"}`}>
                        {grantee.generalAverage !== null ? grantee.generalAverage.toFixed(2) : "—"}
                      </div>
                      {isBelowGwa ? (
                        <div className="mt-1 text-xs text-rose-600">Below 80</div>
                      ) : null}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {formatDate(grantee.dateEnrolled)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="inline-flex items-center justify-center gap-2">
                        {grantee.status === "GRADUATED" && grantee.detailsHref ? (
                          <Link
                            href={grantee.detailsHref}
                            title="View archived grantee record"
                            aria-label="View archived grantee record"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-[#0F3D5C]/10 hover:text-[#0F3D5C]"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        ) : grantee.application ? (
                          <button
                            type="button"
                            onClick={() => onViewApplication?.(grantee)}
                            title="View application form"
                            aria-label="View application form"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-[#0F3D5C]/10 hover:text-[#0F3D5C]"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        ) : grantee.detailsHref ? (
                          <Link
                            href={grantee.detailsHref}
                            title="View grantee"
                            aria-label="View grantee"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-[#0F3D5C]/10 hover:text-[#0F3D5C]"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="View grantee"
                            aria-label="View grantee"
                            className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full bg-slate-50 text-slate-400"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                        )}
                        {grantee.status !== "GRADUATED" ? (
                          <button
                            type="button"
                            onClick={() => onDelete?.(grantee)}
                            title="Delete grantee"
                            aria-label="Delete grantee"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
            })}
          </tbody>
        </table>
        {filteredGrantees.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            No grantees match that search or filter.
          </div>
        ) : null}
      </div>
      <AdminTablePaginationFooter
        totalCount={totalCount}
        page={page}
        pageSize={pageSize}
        basePath="/admin/grantees"
        startNavigation={startNavigation}
      />
    </div>
  );
}
