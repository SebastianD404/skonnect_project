"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Eye, Search, Trash2 } from "lucide-react";
import type { SerializableSkeapApplicationFormPayload } from "./[id]/SkeapApplicationReviewClient";

export interface GranteeTableRow {
  id: string;
  fullName: string;
  email: string;
  school: string;
  yearLevel: string;
  status: "ACTIVE" | "PROBATIONARY" | "GRADUATED" | "REMOVED";
  generalAverage: number | null;
  dateEnrolled: string;
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
  searchQuery: externalSearchQuery,
  onSearchQueryChange,
  onViewApplication,
  onDelete,
}: {
  grantees: GranteeTableRow[];
  searchQuery?: string;
  onSearchQueryChange?: (value: string) => void;
  onViewApplication?: (grantee: GranteeTableRow) => void;
  onDelete?: (grantee: GranteeTableRow) => void;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | GranteeTableRow["status"]>("ALL");
  const effectiveQuery = externalSearchQuery !== undefined ? externalSearchQuery : query;

  const handleQueryChange = (value: string) => {
    setQuery(value);
    onSearchQueryChange?.(value);
  };

  const filteredGrantees = useMemo(() => {
    return grantees.filter((grantee) => {
      const matchesStatus = statusFilter === "ALL" || grantee.status === statusFilter;
      const lowerQuery = effectiveQuery.toLowerCase();
      const matchesQuery =
        grantee.fullName.toLowerCase().includes(lowerQuery) ||
        grantee.email.toLowerCase().includes(lowerQuery) ||
        grantee.school.toLowerCase().includes(lowerQuery) ||
        grantee.yearLevel.toLowerCase().includes(lowerQuery);
      return matchesStatus && matchesQuery;
    });
  }, [grantees, effectiveQuery, statusFilter]);

  return (
    <div className="space-y-5">
      <div className="grid gap-3 md:grid-cols-[1.1fr_0.9fr]">
        <label className="relative block w-full">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search grantees, school, email..."
            value={effectiveQuery}
            onChange={(event) => handleQueryChange(event.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white py-3 pl-12 pr-4 text-sm text-slate-700 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
          />
        </label>

        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                statusFilter === filter.value
                  ? "bg-[#0F3D5C] text-white shadow-sm"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="whitespace-nowrap px-6 py-4 text-left font-semibold text-slate-500">Scholar</th>
              <th className="whitespace-nowrap px-6 py-4 text-left font-semibold text-slate-500">School / Year</th>
              <th className="whitespace-nowrap px-6 py-4 text-left font-semibold text-slate-500">Status</th>
              <th className="whitespace-nowrap px-6 py-4 text-left font-semibold text-slate-500">Average</th>
              <th className="whitespace-nowrap px-6 py-4 text-left font-semibold text-slate-500">Enrolled</th>
              <th className="px-6 py-4 text-center font-semibold text-slate-500">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {filteredGrantees.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-16 text-center text-sm text-slate-500">
                  No grantees match that search or filter.
                </td>
              </tr>
            ) : (
              filteredGrantees.map((grantee) => (
                <tr key={grantee.id} className="transition hover:bg-slate-50">
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
                  <td className="px-6 py-4 text-slate-900">
                    {grantee.generalAverage !== null ? grantee.generalAverage.toFixed(2) : "—"}
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(grantee.dateEnrolled).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="inline-flex items-center justify-center gap-2">
                      {grantee.application ? (
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
                      <button
                        type="button"
                        onClick={() => onDelete?.(grantee)}
                        title="Delete grantee"
                        aria-label="Delete grantee"
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-700 transition hover:bg-rose-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
