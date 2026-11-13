"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Archive, Eye, Loader2, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import AdminTablePaginationFooter from "../AdminTablePaginationFooter";
import AcademicJourneyHoverCard from "./AcademicJourneyHoverCard";

export interface GranteeTableRow {
  id: string;
  fullName: string;
  email: string;
  school: string;
  yearLevel: string;
  currentJourneySemesterIndex: number;
  validatedJourneySemesterIndexes: number[];
  status: "ACTIVE" | "PROBATIONARY" | "GRADUATED" | "REMOVED";
  contactNumber: string | null;
  dateEnrolled: string;
  graduatedAt?: string | null;
  retentionExpiresAt?: string | null;
  updatedAt: string;
  detailsHref?: string;
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

function SkeletonBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-slate-200 ${className}`} aria-hidden="true" />;
}

function GranteeTableSkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }, (_, rowIndex) => (
        <tr key={rowIndex} className="h-[72px] border-b border-slate-100" aria-hidden="true">
          <td className="px-3 py-4 sm:px-4">
            <SkeletonBlock className="h-4 w-36 max-w-full" />
            <SkeletonBlock className="mt-2 h-3 w-28 max-w-full" />
          </td>
          <td className="px-3 py-4 sm:px-4">
            <SkeletonBlock className="h-4 w-32 max-w-full" />
            <SkeletonBlock className="mt-2 h-3 w-20" />
          </td>
          <td className="px-3 py-4 sm:px-4"><SkeletonBlock className="h-6 w-20 rounded-full" /></td>
          <td className="px-3 py-4 sm:px-4"><SkeletonBlock className="h-4 w-24" /></td>
          <td className="px-3 py-4 sm:px-4"><SkeletonBlock className="h-4 w-20" /></td>
          <td className="px-3 py-4 text-center sm:px-4"><SkeletonBlock className="mx-auto h-9 w-20 rounded-lg" /></td>
        </tr>
      ))}
    </>
  );
}

function GranteeMobileSkeletonCards() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }, (_, rowIndex) => (
        <article
          key={rowIndex}
          className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4"
          aria-hidden="true"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <SkeletonBlock className="h-4 w-40 max-w-full" />
              <SkeletonBlock className="mt-2 h-3 w-32 max-w-full" />
            </div>
            <SkeletonBlock className="h-6 w-20 rounded-full" />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-3">
            <SkeletonBlock className="h-12 w-full" />
            <SkeletonBlock className="h-12 w-full" />
          </div>
          <SkeletonBlock className="mt-4 h-9 w-24 rounded-lg" />
        </article>
      ))}
    </div>
  );
}

export function GranteeStatusTable({
  grantees,
  page,
  pageSize,
  totalCount,
  query,
  onQueryChange,
  isLoading,
  startNavigation,
  onEndScholarship,
}: {
  grantees: GranteeTableRow[];
  page: number;
  pageSize: number;
  totalCount: number;
  query: string;
  onQueryChange: (query: string) => void;
  isLoading: boolean;
  startNavigation: (callback: () => void) => void;
  onEndScholarship?: (grantee: GranteeTableRow) => void;
}) {
  const [pendingGranteeId, setPendingGranteeId] = useState<string | null>(null);
  const [isViewingGrantee, startViewTransition] = useTransition();
  const router = useRouter();

  const handleViewGrantee = (grantee: GranteeTableRow) => {
    const href = grantee.detailsHref;
    if (!href || isViewingGrantee) return;

    setPendingGranteeId(grantee.id);
    startViewTransition(() => router.push(href));
  };

  const emptyMessage = query.trim()
    ? `No active grantees match “${query.trim()}”.`
    : "No active grantees found.";

  return (
    <div className="mt-4 flex h-fit flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-white p-4 sm:flex-row sm:p-5">
        <label className="relative block w-full sm:w-80">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            aria-label="Search all active grantees"
            title="Search all active grantees by name, email, contact number, school, or year"
            placeholder="Search name, email, contact, school..."
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 transition-colors focus:border-cyan-500"
          />
        </label>
      </div>

      <div className="relative w-full" aria-busy={isLoading}>
        {isLoading ? (
          <span role="status" aria-live="polite" className="sr-only">
            Searching active grantees
          </span>
        ) : null}
        <div className="flex flex-col gap-3 p-3 md:hidden">
          {isLoading ? <GranteeMobileSkeletonCards /> : grantees.map((grantee) => (
            <article key={grantee.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-cyan-900 text-xs font-bold text-cyan-100">
                    {grantee.fullName
                      .split(" ")
                      .filter(Boolean)
                      .slice(0, 2)
                      .map((part) => part[0]?.toUpperCase())
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-bold leading-tight text-slate-900" title={grantee.fullName}>
                      {grantee.fullName}
                    </h2>
                    <p className="truncate text-xs text-slate-500" title={grantee.email}>
                      {grantee.email}
                    </p>
                  </div>
                </div>
                <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
                  grantee.status === "ACTIVE" || grantee.status === "PROBATIONARY"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : STATUS_CLASSES[grantee.status]
                }`}>
                  {STATUS_LABELS[grantee.status]}
                </span>
              </div>

              <dl className="grid grid-cols-1 gap-x-3 gap-y-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                <div className="min-w-0">
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">School &amp; year</dt>
                  <dd className="mt-0.5 truncate font-semibold text-slate-800" title={normalizeSkeapSchoolName(grantee.school)}>
                    {normalizeSkeapSchoolName(grantee.school)}
                  </dd>
                  <dd className="text-[11px] text-slate-500">{grantee.yearLevel}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Contact number</dt>
                  <dd className="mt-0.5 truncate font-semibold text-slate-800">
                    {grantee.contactNumber ? (
                      <a href={`tel:${grantee.contactNumber}`} className="hover:text-cyan-800">
                        {grantee.contactNumber}
                      </a>
                    ) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Semester progress</dt>
                  <dd className="mt-0.5 font-semibold text-slate-800">
                    Semester {grantee.currentJourneySemesterIndex + 1}
                  </dd>
                  <dd className="text-[11px] text-slate-500">
                    {grantee.validatedJourneySemesterIndexes.length} validated
                  </dd>
                </div>
              </dl>

              <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                <span className="text-[11px] text-slate-500">
                  Enrolled {formatDate(grantee.dateEnrolled)}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {grantee.detailsHref ? (
                    <button
                      type="button"
                      onClick={() => handleViewGrantee(grantee)}
                      disabled={isViewingGrantee}
                      aria-busy={isViewingGrantee && pendingGranteeId === grantee.id}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-cyan-50 px-3 text-xs font-semibold text-cyan-800 transition-colors hover:bg-cyan-100 disabled:cursor-wait disabled:opacity-60"
                    >
                      {isViewingGrantee && pendingGranteeId === grantee.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      )}
                      View Profile
                    </button>
                  ) : null}
                  {grantee.status !== "GRADUATED" ? (
                    <button
                      type="button"
                      onClick={() => onEndScholarship?.(grantee)}
                      aria-label={`End scholarship for ${grantee.fullName}`}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {!isLoading && grantees.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center text-sm text-slate-500">
              {emptyMessage}
            </div>
          ) : null}
        </div>

        <div
          className="hidden w-full overflow-x-auto whitespace-nowrap scrollbar-thin md:block"
          style={{ touchAction: "pan-x", WebkitOverflowScrolling: "touch" }}
        >
        <table className="w-full min-w-[760px] table-fixed border-collapse text-left text-sm md:min-w-0">
          <thead className="relative z-30 bg-gradient-to-r from-slate-900 to-cyan-900">
            <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-cyan-50">
              <th className="w-[22%] px-3 py-4 sm:px-4">Name</th>
              <th className="w-[26%] px-3 py-4 sm:px-4">School / Year</th>
              <th className="w-[12%] px-3 py-4 sm:px-4">Status</th>
              <th className="w-[16%] px-3 py-4 sm:px-4">Contact number</th>
              <th className="w-[14%] px-3 py-4 sm:px-4">Enrolled</th>
              <th className="w-[10%] px-3 py-4 text-center sm:px-4">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white text-sm" aria-busy={isLoading}>
            {isLoading ? <GranteeTableSkeletonRows /> : grantees.map((grantee) => (
                  <tr key={grantee.id} className="transition-colors hover:bg-slate-50/50">
                    <td className="min-w-0 px-3 py-4 sm:px-4">
                      <div className="group/journey relative flex items-center gap-3">
                        <AcademicJourneyHoverCard
                          fullName={grantee.fullName}
                          currentSemesterIndex={grantee.currentJourneySemesterIndex}
                          validatedSemesterIndexes={grantee.validatedJourneySemesterIndexes}
                        />
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
                    <td className="min-w-0 px-3 py-4 sm:px-4">
                      <div className="truncate font-medium text-slate-900" title={normalizeSkeapSchoolName(grantee.school)}>
                        {normalizeSkeapSchoolName(grantee.school)}
                      </div>
                      <div className="truncate text-xs text-slate-500">{grantee.yearLevel}</div>
                    </td>
                    <td className="px-3 py-4 sm:px-4">
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${STATUS_CLASSES[grantee.status]}`}>
                        {STATUS_LABELS[grantee.status]}
                      </span>
                    </td>
                    <td className="truncate px-3 py-4 sm:px-4" title={grantee.contactNumber ?? undefined}>
                      {grantee.contactNumber ? (
                        <a href={`tel:${grantee.contactNumber}`} className="text-slate-700 hover:text-cyan-800">
                          {grantee.contactNumber}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-slate-500 sm:px-4">
                      {formatDate(grantee.dateEnrolled)}
                    </td>
                    <td className="px-3 py-4 text-center sm:px-4">
                      <div className="inline-flex items-center justify-center gap-2">
                        {grantee.detailsHref ? (
                          <button
                            type="button"
                            onClick={() => handleViewGrantee(grantee)}
                            disabled={isViewingGrantee}
                            aria-busy={isViewingGrantee && pendingGranteeId === grantee.id}
                            title={
                              isViewingGrantee && pendingGranteeId === grantee.id
                                ? "Loading grantee details"
                                : grantee.status === "GRADUATED"
                                  ? "View archived grantee record"
                                  : "View grantee details"
                            }
                            aria-label={grantee.status === "GRADUATED" ? "View archived grantee record" : "View grantee details"}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 transition-all hover:bg-slate-100 hover:text-slate-900 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                          >
                            {isViewingGrantee && pendingGranteeId === grantee.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                            ) : (
                              <Eye className="h-4 w-4" aria-hidden="true" />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="Grantee details unavailable"
                            aria-label="Grantee details unavailable"
                            className="inline-flex h-9 w-9 cursor-not-allowed items-center justify-center rounded-full bg-slate-50 text-slate-400"
                          >
                            <Eye className="h-4 w-4" aria-hidden="true" />
                          </button>
                        )}
                        {grantee.status !== "GRADUATED" ? (
                          <button
                            type="button"
                            onClick={() => onEndScholarship?.(grantee)}
                            title="End scholarship"
                            aria-label="End scholarship"
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200 hover:text-slate-900"
                          >
                            <Archive className="h-4 w-4" aria-hidden="true" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
            ))}
          </tbody>
        </table>
        {!isLoading && grantees.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-500">
            {emptyMessage}
          </div>
        ) : null}
        </div>
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
