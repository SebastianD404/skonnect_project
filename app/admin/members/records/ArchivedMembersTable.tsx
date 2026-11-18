"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { getExactAge } from "@/lib/skeap-age";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import {
  isKKMemberArchiveReason,
  isKKMemberAgeOutReason,
} from "@/lib/kk-member-archive";
import type { KKProfilingRegistration } from "../../kk-profiling/types";
import { ArchivedMemberRowActions } from "./ArchivedMemberRowActions";

function toBirthDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

function formatBirthDate(value: Date | string) {
  const date = toBirthDate(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeZone: "Asia/Manila",
  }).format(date);
}

function ArchiveReasonStatus({ record }: { record: KKProfilingRegistration }) {
  const isAgedOut = isKKMemberAgeOutReason(record.archivedReason);
  const isDeceased = record.archivedReason?.trim().toLowerCase() === "deceased";
  const reasonLabel = isAgedOut
    ? "Aged Out (31+)"
    : isKKMemberArchiveReason(record.archivedReason)
      ? record.archivedReason
      : "Archived by Admin";
  const archivedDate = record.archivedAt ? `Archived ${formatDate(record.archivedAt)}` : null;
  return (
    <div className="flex min-w-0 flex-col items-start gap-0.5">
      <span
        title={reasonLabel}
        className={`inline-flex max-w-full items-center truncate whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${
          isAgedOut
            ? "border-amber-200 bg-amber-50 text-amber-700"
            : isDeceased
              ? "border-zinc-200 bg-zinc-100 text-zinc-700"
              : "border-slate-200 bg-slate-100 text-slate-700"
        }`}
      >
        {reasonLabel}
      </span>
      {archivedDate ? (
        <span className="whitespace-nowrap text-xs text-slate-500">{archivedDate}</span>
      ) : null}
    </div>
  );
}

function formatAgeGroup(record: KKProfilingRegistration) {
  const age = getExactAge(toBirthDate(record.birthDate));
  if (age === null) {
    if (record.youthAgeGroup?.trim().toLowerCase() === "aged out (31+)") return "Over 30";
    return record.youthAgeGroup || "—";
  }
  if (age > 30) return `Over 30 (${age} yrs)`;
  if (age >= 25) return "Young Adult (25–30)";
  if (age >= 18) return "Core Youth (18–24)";
  if (age >= 15) return "Child Youth (15–17)";
  return record.youthAgeGroup || "Below KK age range";
}

function BirthDateAge({ birthDate }: { birthDate: Date | string }) {
  const age = getExactAge(toBirthDate(birthDate));
  return (
    <div className="flex flex-col">
      <span>{formatBirthDate(birthDate)}</span>
      <span className="text-xs text-slate-500">{age === null ? "Age unavailable" : `${age} yrs`}</span>
    </div>
  );
}

export function ArchivedMembersTable({
  records,
  initialQuery,
  totalCount,
}: {
  records: KKProfilingRegistration[];
  initialQuery: string;
  totalCount: number;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const hasActiveSearch = Boolean(query.trim() || initialQuery.trim());
  const emptyState = records.length > 0
    ? null
    : totalCount > 0
      ? "Unable to load records for this page. Please refresh."
      : hasActiveSearch
        ? "No archived KK youth profiles match your search."
        : "No archived KK youth profiles yet.";

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
      {restoreSuccess ? (
        <FloatingFeedback
          message={restoreSuccess}
          type="success"
          onDismiss={() => setRestoreSuccess(null)}
        />
      ) : null}
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative block w-full sm:w-80">
          <span className="sr-only">Filter archived KK youth by name, email, classification, or archive reason</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, email, classification, or reason..."
            title="Filters archived KK youth profiles"
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
          />
        </label>
      </div>
      <div className="flex flex-col gap-3 p-3 xl:hidden">
        {records.map((record) => {
          const memberName = record.user?.fullName || record.fullName;
          const memberEmail = record.user?.email || record.email;
          return (
            <article key={record.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-semibold text-slate-900" title={memberName}>{memberName}</h3>
                  <p className="truncate text-xs text-slate-500" title={memberEmail}>{memberEmail}</p>
                </div>
                <ArchiveReasonStatus record={record} />
              </div>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-y border-slate-100 py-3">
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Birth date</dt>
                  <dd className="mt-0.5 text-xs font-medium text-slate-700">
                    <BirthDateAge birthDate={record.birthDate} />
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Age group</dt>
                  <dd className="mt-0.5 text-xs font-medium text-slate-700">{formatAgeGroup(record)}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Classification</dt>
                  <dd className="mt-0.5 text-xs font-medium text-slate-700">{record.youthClassification}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">SK voter</dt>
                  <dd className="mt-0.5 text-xs font-medium text-slate-700">{record.registeredSKVoter}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Submitted</dt>
                  <dd className="mt-0.5 text-xs font-medium text-slate-700">{formatDate(record.submittedAt)}</dd>
                </div>
              </dl>
              <div className="flex items-center justify-between gap-3">
                <ArchivedMemberRowActions
                  registration={record}
                  onRestored={(fullName) => setRestoreSuccess(`${fullName}'s profile has been restored to the active KK registry.`)}
                />
              </div>
            </article>
          );
        })}
        {emptyState ? (
          <div
            role={totalCount > 0 ? "alert" : undefined}
            className={`rounded-2xl border px-6 py-12 text-center text-sm ${
              totalCount > 0
                ? "border-amber-200 bg-amber-50 text-amber-900"
                : "border-slate-200 bg-white text-slate-500"
            }`}
          >
            {emptyState}
          </div>
        ) : null}
      </div>
      <div
        className="hidden w-full min-w-0 xl:block"
      >
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <colgroup>
            <col style={{ width: "18%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "13%" }} />
            <col style={{ width: "12%" }} />
            <col style={{ width: "8%" }} />
            <col style={{ width: "17%" }} />
            <col style={{ width: "10%" }} />
            <col style={{ width: "10%" }} />
          </colgroup>
          <thead className="bg-[#0f172a] text-white">
            <tr className="text-xs font-semibold tracking-wider">
              <th className="whitespace-nowrap px-3 py-3">NAME</th>
              <th className="whitespace-nowrap px-3 py-3">BIRTH DATE</th>
              <th className="whitespace-nowrap px-3 py-3">AGE GROUP</th>
              <th className="whitespace-nowrap px-3 py-3">CLASSIFICATION</th>
              <th className="whitespace-nowrap px-3 py-3 text-center">SK VOTER</th>
              <th className="whitespace-nowrap px-3 py-3">REASON / STATUS</th>
              <th className="whitespace-nowrap px-3 py-3">SUBMITTED</th>
              <th className="whitespace-nowrap px-2 py-3 text-right">ACTIONS</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {records.map((record) => {
              const memberName = record.user?.fullName || record.fullName;
              return (
                <tr key={record.id} className="transition-colors hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-3 py-3">
                    <div className="truncate font-semibold text-slate-900" title={memberName}>{memberName}</div>
                    <div className="block truncate text-xs text-slate-500" title={record.user?.email || record.email}>
                      {record.user?.email || record.email}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">
                    <BirthDateAge birthDate={record.birthDate} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3">{formatAgeGroup(record)}</td>
                  <td className="px-3 py-3">
                    <div className="truncate" title={record.youthClassification}>{record.youthClassification}</div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-center">{record.registeredSKVoter}</td>
                  <td className="min-w-0 px-3 py-3">
                    <ArchiveReasonStatus record={record} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{formatDate(record.submittedAt)}</td>
                  <td className="whitespace-nowrap px-2 py-3 text-right align-middle">
                    <ArchivedMemberRowActions
                      registration={record}
                      onRestored={(fullName) => setRestoreSuccess(`${fullName}'s profile has been restored to the active KK registry.`)}
                    />
                  </td>
                </tr>
              );
            })}
            {emptyState ? (
              <tr>
                <td
                  colSpan={8}
                  role={totalCount > 0 ? "alert" : undefined}
                  className={`whitespace-nowrap px-6 py-12 text-center text-sm ${
                    totalCount > 0
                      ? "bg-amber-50 text-amber-900"
                      : "text-slate-500"
                  }`}
                >
                  {emptyState}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
