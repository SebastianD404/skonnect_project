"use client";

import { useState } from "react";
import { FileText, GraduationCap, Search, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import AdminPaginationControls from "../AdminPaginationControls";
import GraduationAction from "../grantees/[id]/GraduationAction";

export interface ExitClearanceRow {
  id: string;
  fullName: string;
  email: string;
  school: string;
  yearLevel: string;
  exitClearanceStatus: "NONE" | "SUBMITTED" | "RETURNED" | "CLEARED" | null;
  exitClearanceUrl: string | null;
  exitClearanceFileName: string | null;
  exitClearanceSubmittedAt: string | null;
}

export default function ExitClearancesPageClient({
  grantees,
}: {
  grantees: ExitClearanceRow[];
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedGrantee, setSelectedGrantee] = useState<ExitClearanceRow | null>(null);
  const hasOnlineSubmission = (grantee: ExitClearanceRow) =>
    grantee.exitClearanceStatus === "SUBMITTED" || Boolean(grantee.exitClearanceUrl);
  const onlineSubmissions = grantees
    .filter(hasOnlineSubmission)
    .sort((a, b) => {
      const submittedAtDifference =
        (b.exitClearanceSubmittedAt ? Date.parse(b.exitClearanceSubmittedAt) : 0) -
        (a.exitClearanceSubmittedAt ? Date.parse(a.exitClearanceSubmittedAt) : 0);
      return submittedAtDifference || a.fullName.localeCompare(b.fullName);
    });
  const normalizedSearch = searchQuery.trim().toLowerCase();
  const searchTokens = normalizedSearch.split(/\s+/).filter(Boolean);
  const filteredGrantees = searchTokens.length
    ? onlineSubmissions.filter((grantee) =>
        searchTokens.every((token) =>
          [grantee.fullName, grantee.email, grantee.school, grantee.yearLevel]
            .join(" ")
            .toLowerCase()
            .includes(token),
        ),
      )
    : onlineSubmissions;
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredGrantees.length / pageSize));
  const displayedPage = Math.min(currentPage, totalPages);
  const visibleGrantees = filteredGrantees.slice(
    (displayedPage - 1) * pageSize,
    displayedPage * pageSize,
  );
  const changeSearch = (value: string) => {
    setSearchQuery(value);
    setCurrentPage(1);
  };

  return (
    <>
      <div className="flex w-full flex-col gap-6 pb-12">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              Graduation Offboarding
            </span>
            <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
              Exit Clearances
            </h1>
            <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
              Review submitted school exit clearances and verify scholar graduation.
            </p>
          </div>
        </header>

        <section className="mt-4 flex h-fit flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex flex-col items-start justify-between gap-4 border-b border-slate-100 bg-white p-4 sm:flex-row sm:items-center sm:p-5">
            <div className="relative block w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                type="search"
                aria-label="Search exit clearances"
                placeholder="Search name, email, or school..."
                value={searchQuery}
                onChange={(event) => changeSearch(event.target.value)}
                className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-10 text-sm text-slate-700 shadow-sm outline-none placeholder:text-slate-400 transition-colors focus:border-cyan-500"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => changeSearch("")}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[1120px] table-fixed border-collapse text-left text-sm">
              <thead className="bg-gradient-to-r from-slate-900 to-cyan-900">
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-cyan-50">
                  <th className="w-[19%] px-5 py-3.5">Name</th>
                  <th className="w-[17%] px-5 py-3.5">School / Year</th>
                  <th className="w-[20%] px-5 py-3.5">Clearance Document</th>
                  <th className="w-[14%] px-5 py-3.5">Submitted</th>
                  <th className="w-[18%] px-5 py-3.5">Status</th>
                  <th className="w-[12%] px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {visibleGrantees.map((grantee) => {
                  const documentName = grantee.exitClearanceFileName ||
                    (grantee.exitClearanceUrl
                      ? grantee.exitClearanceUrl.split("/").pop() || "Uploaded document"
                      : "No online file");
                  const nameParts = grantee.fullName.trim().split(/\s+/).filter(Boolean);
                  const initials = nameParts.length > 1
                    ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
                    : nameParts[0]?.slice(0, 2).toUpperCase() || "?";

                  return (
                    <tr key={grantee.id} className="h-[72px] transition-colors hover:bg-slate-50/50">
                      <td className="px-5 py-3.5">
                        <div className="flex min-w-0 items-center gap-3">
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#0C2D48] text-xs font-semibold text-white">
                            {initials}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900" title={grantee.fullName}>
                              {grantee.fullName}
                            </p>
                            <p className="truncate text-xs text-slate-500" title={grantee.email}>
                              {grantee.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="truncate font-medium text-slate-800" title={grantee.school}>
                          {grantee.school}
                        </p>
                        <p className="truncate text-xs text-slate-500">{grantee.yearLevel}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="inline-flex max-w-full items-center gap-2">
                          <FileText className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                          <span
                            className="max-w-[220px] truncate text-xs font-medium text-slate-700"
                            title={grantee.exitClearanceFileName || documentName}
                          >
                            {documentName}
                          </span>
                        </p>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-500">
                        {grantee.exitClearanceSubmittedAt
                          ? formatDate(grantee.exitClearanceSubmittedAt)
                          : "—"}
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex w-fit items-center gap-1.5 whitespace-nowrap rounded-full border border-teal-200 bg-teal-50/80 px-2.5 py-1 text-xs font-semibold text-teal-800">
                          <span className="h-1.5 w-1.5 rounded-full bg-teal-600" aria-hidden="true" />
                          Clearance Submitted
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedGrantee(grantee)}
                          title="Verify Exit Clearance & Graduate Scholar"
                          className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#0C2D48] shadow-2xs transition-colors hover:border-[#0C2D48] hover:bg-[#0C2D48] hover:text-white"
                        >
                          <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                          Review
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {filteredGrantees.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-sm text-slate-500">
                      {normalizedSearch
                        ? "No scholars match your search."
                        : "No exit clearances awaiting verification. Scholars can submit their clearance from their Grantee Dashboard."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 px-5 py-3.5">
            <p className="text-xs text-slate-500 tabular-nums">
              {filteredGrantees.length === 0
                ? "No records found"
                : `Showing ${(displayedPage - 1) * pageSize + 1}–${Math.min(
                    displayedPage * pageSize,
                    filteredGrantees.length,
                  )} of ${filteredGrantees.length}`}
            </p>
            <AdminPaginationControls
              page={displayedPage}
              totalPages={totalPages}
              onPageChange={setCurrentPage}
              disabled={filteredGrantees.length === 0}
            />
          </div>
        </section>
      </div>

      {selectedGrantee ? (
        <GraduationAction
          key={selectedGrantee.id}
          granteeId={selectedGrantee.id}
          granteeName={selectedGrantee.fullName}
          exitClearanceUrl={selectedGrantee.exitClearanceUrl}
          exitClearanceFileName={selectedGrantee.exitClearanceFileName}
          exitClearanceSubmittedAt={selectedGrantee.exitClearanceSubmittedAt}
          onlineReview
          initiallyOpen
          hideTrigger
          onClose={() => setSelectedGrantee(null)}
        />
      ) : null}
    </>
  );
}
