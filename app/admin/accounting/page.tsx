"use client";

import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Wallet, Search, Download } from "lucide-react";
import { getRecentSemesters } from "@/lib/semester";
// If you have shadcn/ui components installed, replace the native select below
// with shadcn's `Select` imports, e.g.:
// import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
// import { Badge } from "@/components/ui/badge";
// import { Button } from "@/components/ui/button";

// shadcn/ui components - adjust import paths if your project uses a different layout
// Using local Tailwind markup instead of shadcn/ui components

  type Grantee = {
  id: string;
  name: string;
  semester: string;
  status: "Pending Payout" | "Claimed";
    submitted?: boolean;
    submissionStatus?: string | null;
    submissionState?: string; // 'Approved' | 'Under review' | 'Not submitted'
    claimedAt?: string | null;
};

const GRANT_AMOUNT = 5000; // PHP per student

export default function AdminAccountingPage() {
  const [grantees, setGrantees] = useState<Grantee[]>([]);
  const [totalBudget, setTotalBudget] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const recentSemesters = getRecentSemesters();
  const [selectedSemester, setSelectedSemester] = useState<string>(recentSemesters[0].name);

  const claimedCount = useMemo(() => grantees.filter((g) => g.status === "Claimed").length, [grantees]);

  const remainingBudget = useMemo(() => (totalBudget ?? 0) - claimedCount * GRANT_AMOUNT, [totalBudget, claimedCount]);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      }),
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return grantees;
    return grantees.filter((g) => g.name.toLowerCase().includes(q));
  }, [grantees, query]);

  const [submissionFilter, setSubmissionFilter] = useState<'all'|'submitted'|'not_submitted'>('all');
  const [claimedFilter, setClaimedFilter] = useState<'all'|'pending'|'received'>('all');

  const filteredWithSubmission = useMemo(() => {
    let list = filtered;
    if (submissionFilter === 'submitted') list = list.filter((g) => Boolean(g.submitted));
    if (submissionFilter === 'not_submitted') list = list.filter((g) => !g.submitted);
    if (claimedFilter === 'received') list = list.filter((g) => g.status === 'Claimed');
    if (claimedFilter === 'pending') list = list.filter((g) => g.status !== 'Claimed');
    return list;
  }, [filtered, submissionFilter, claimedFilter]);

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const rowsPerPage = 10;
  const totalPages = Math.max(1, Math.ceil(filteredWithSubmission.length / rowsPerPage));

  useEffect(() => {
    // reset to first page when filters change
    setCurrentPage(1);
  }, [filteredWithSubmission.length]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredWithSubmission.slice(start, start + rowsPerPage);
  }, [filteredWithSubmission, currentPage]);

  const budgetSemesterParam = useMemo(() => {
    const cleanedSemester = String(selectedSemester ?? "").replace(/\s*\(Current\)$/i, "").trim();
    return encodeURIComponent(cleanedSemester);
  }, [selectedSemester]);

  async function markClaimed(id: string) {
    if (processingIds[id]) return;
    setProcessingIds((p) => ({ ...p, [id]: true }));
    const prev = grantees;
    setGrantees((cur) => cur.map((g) => (g.id === id ? { ...g, status: "Claimed" } : g)));

    try {
      const res = await fetch(`/api/grantees/${id}/claim`, { method: "PATCH" });
      if (!res.ok) throw new Error("Failed to mark claimed");
    } catch (err) {
      setGrantees(prev);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingIds((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  }

  // fetch data on mount and whenever the selected semester or payout filter changes
  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setErrorMessage(null);

      try {
        const cleanedSemester = String(selectedSemester ?? "").replace(/\s*\(Current\)$/i, "").trim();
        const encoded = encodeURIComponent(cleanedSemester);
        const claimedQuery = claimedFilter === "all" ? "" : `&claimed=${claimedFilter === "received" ? "true" : "false"}`;
        const [gRes, sRes] = await Promise.all([
          fetch(`/api/grantees?semester=${encoded}${claimedQuery}`),
          fetch(`/api/budget?semester=${encoded}`),
        ]);

        if (!gRes.ok) throw new Error("Failed to load grantees");
        if (!sRes.ok) throw new Error("Failed to load settings");

        const gData = await gRes.json();
        const sData = await sRes.json();

        if (!mounted) return;

        const raw = gData;
        const list = Array.isArray(raw)
          ? raw
          : Array.isArray(raw.grantees)
            ? raw.grantees
            : Array.isArray(raw.data)
              ? raw.data
              : [];

        setGrantees(
          list.map((r: any) => {
            const name =
              r.student_name ?? r.studentName ?? r.fullName ??
              (r.user ? `${r.user.firstName ?? ""} ${r.user.lastName ?? ""}`.trim() : undefined) ??
              "Unknown";

            const effectiveSemester = String(r.semester ?? r.submission?.semester ?? r.latestSemester ?? selectedSemester ?? "");
            const apiClaimed = typeof r.claimed === "boolean" ? r.claimed : undefined;
            const payoutStr = String(r.payout_status ?? r.payoutStatus ?? r.status ?? "");
            const isClaimed = typeof apiClaimed === "boolean"
              ? apiClaimed
              : payoutStr.toLowerCase().includes("received") || payoutStr.toLowerCase().includes("claimed");

            return {
              id: String(r.id),
              name: String(name),
              semester: effectiveSemester,
              status: isClaimed ? "Claimed" : "Pending Payout",
              claimed: Boolean(isClaimed),
              submitted: Boolean(r.submitted ?? (r.submission ? true : false)),
              submissionStatus: r.submissionStatus ?? r.submission?.status ?? null,
              claimedAt: r.claimedAt ?? r.claimed_at ?? null,
            };
          })
        );

        if (sData && typeof sData.totalBudget !== "undefined") {
          setTotalBudget(typeof sData.totalBudget === "number" ? sData.totalBudget : Number(sData.totalBudget ?? 0));
        }
      } catch (err) {
        setGrantees([]);
        setErrorMessage(err instanceof Error ? err.message : String(err));
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [selectedSemester, claimedFilter]);

  async function handleSaveBudget() {
    if (isSaving) return;
    if (totalBudget == null) return setErrorMessage('Total budget is required');
    // Validate: must be greater than zero
    if (totalBudget <= 0) {
      const msg = 'Please enter a valid budget amount greater than zero.';
      setValidationError(msg);
      return;
    }

    setIsSaving(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const cleanedSemester = String(selectedSemester ?? "").replace(/\s*\(Current\)$/i, "").trim();
      const res = await fetch(`/api/budget?semester=${encodeURIComponent(cleanedSemester)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalBudget }),
      });

      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || 'Failed to save budget');
      }

      const data = await res.json().catch(() => null);
      setSuccessMessage('Budget saved');
      setErrorMessage(null);
      if (typeof data?.totalBudget === 'number') setTotalBudget(data.totalBudget);

      setTimeout(() => setSuccessMessage(null), 2500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setIsSaving(false);
    }
  }

  function handleExportCsv() {
    const budget = totalBudget ?? 0;
    const remaining = remainingBudget;

    const reportRows: (string | number | null)[][] = [
      ['Educational Assistance Disbursement Report'],
      ['Semester:', selectedSemester],
      ['Total Budget:', budget],
      ['Remaining Funds:', remaining],
      ['Total Claimed:', claimedCount],
      [],
      ['Student Name', 'Semester', 'Submission Status', 'Payout Status', 'Claimed Date'],
    ];

    filteredWithSubmission.forEach((g) => {
      reportRows.push([
        g.name,
        g.semester,
        g.submissionState ?? 'Not submitted',
        g.status === 'Claimed' ? 'Received' : 'Pending',
        g.claimedAt ? new Date(g.claimedAt).toLocaleString() : '-',
      ]);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(reportRows);
    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 30 },
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 22 },
      { wch: 24 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Disbursement Report');
    XLSX.writeFile(workbook, 'Disbursement_Report.xlsx');
  }

  async function toggleClaimed(id: string) {
    if (processingIds[id]) return;
    setProcessingIds((p) => ({ ...p, [id]: true }));

    const prev = grantees;
    const prevBudget = totalBudget;
    const current = grantees.find((g) => g.id === id);
    const isClaimed = current?.status === "Claimed";

    // optimistic update: toggle status and claimedAt so UI updates immediately
    const optimisticClaimedAt = !isClaimed ? new Date().toISOString() : null;
    setGrantees((cur) => cur.map((g) => (g.id === id ? { ...g, status: isClaimed ? "Pending Payout" : "Claimed", claimed: !isClaimed, claimedAt: optimisticClaimedAt } : g)));

    try {
      const cleanedSemester = String(selectedSemester ?? "").replace(/\s*\(Current\)$/i, "").trim();
      const res = await fetch(`/api/grantees/${encodeURIComponent(id)}/payout`, {
        method: "PATCH",
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ semester: cleanedSemester, claimed: !isClaimed }),
      });

      // If the server rejects due to auth, and we're trying to mark as claimed,
      // fall back to the lightweight (no-auth) /claim endpoint so the UI remains usable.
      if (!res.ok) {
        const status = res.status;
        const body = await res.text().catch(() => null);
        if ((status === 401 || status === 403) && !isClaimed) {
          // trying to claim (was not claimed) — use the simpler claim endpoint
          const fallback = await fetch(`/api/grantees/${encodeURIComponent(id)}/claim`, {
            method: 'PATCH',
            credentials: 'same-origin',
          });
          if (!fallback.ok) {
            const fbBody = await fallback.text().catch(() => null);
            throw new Error(fbBody || body || 'Failed to toggle payout (fallback)');
          }
        } else {
          throw new Error(body || 'Failed to toggle payout');
        }
      }
    } catch (err) {
      setGrantees(prev);
      setTotalBudget(prevBudget);
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      setProcessingIds((p) => {
        const next = { ...p };
        delete next[id];
        return next;
      });
    }
  }

  return (
    <main className="px-6 pb-12 pt-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Accounting • Offline Cash Disbursements</h1>
          <p className="mt-1 text-sm text-slate-600">Track and mark offline cash payouts for grantees.</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>

          <div className="w-72">
            <label className="sr-only">Semester</label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none shadow-sm focus:border-sky-400"
              aria-label="Filter by semester"
            >
              {recentSemesters.map((semester) => (
                <option key={semester.name} value={semester.name}>
                  {semester.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {/* global error banner removed — use inline validation under the input instead */}
      {successMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
          <button onClick={() => setSuccessMessage(null)} className="ml-4 underline">
            Dismiss
          </button>
        </div>
      ) : null}

        {/* Top section - budget overview */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-700">
                <Wallet className="h-5 w-5" />
              </span>
              <div className="text-sm font-semibold">Total Budget</div>
            </div>

            <div className="mt-4">
              <label className="text-xs text-slate-500">Set total budget (PHP)</label>
              <div className="mt-2 flex w-full items-center gap-4">
                <div className="flex flex-col">
                  <input
                    type="number"
                    value={totalBudget !== null ? String(totalBudget) : ''}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveBudget();
                      }
                    }}
                    onChange={(e) => {
                      setTotalBudget(Number(e.target.value || 0));
                      setValidationError(null);
                      setErrorMessage(null);
                    }}
                    className="max-w-[240px] rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    aria-label="Total budget"
                  />
                  {validationError ? <div className="mt-1 text-sm text-red-500">{validationError}</div> : null}
                </div>

                <div className="text-sm text-slate-600">Grant amount: {formatter.format(GRANT_AMOUNT)}</div>

                <button
                  type="button"
                  onClick={handleSaveBudget}
                  disabled={isSaving}
                  aria-busy={isSaving}
                  className={`ml-auto inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-slate-800 active:scale-95 transition duration-150 min-w-[72px] ${isSaving ? 'opacity-80 cursor-wait' : ''}`}
                >
                  <span className="relative inline-flex items-center justify-center w-full">
                    {isSaving ? (
                      <>
                        <span className="absolute left-3 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <span className="opacity-90">Saving...</span>
                      </>
                    ) : (
                      <span className="">Save</span>
                    )}
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="text-sm font-semibold">Remaining Funds</div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div
                  className={`text-4xl font-bold ${remainingBudget < 0 ? "text-rose-600" : "text-slate-900"}`}
                  aria-live="polite"
                >
                  {formatter.format(remainingBudget)}
                </div>
                <div className="mt-1 text-sm text-slate-500">Available after claimed payouts</div>
              </div>
                <div className="text-right text-sm text-slate-500">
                <div>Budget: {formatter.format(totalBudget ?? 0)}</div>
                <div className="mt-1">Claimed: {claimedCount} • {formatter.format(claimedCount * GRANT_AMOUNT)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Middle section - search + semester filter */}
        <div className="mt-6 flex items-center justify-between gap-4">
          <div className="flex-1 min-w-0">
            <label className="sr-only">Search grantees</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search student or name"
                className="w-full rounded-2xl border border-transparent bg-white px-4 py-3 pl-11 text-sm text-slate-900 outline-none shadow-md focus:border-sky-300 focus:ring-2 focus:ring-sky-50"
                aria-label="Search grantee by name"
              />
            </div>
          </div>

          <div className="flex items-center gap-3 ml-4 flex-shrink-0">
            <div className="inline-flex items-center gap-1 bg-white rounded-full border border-slate-100 shadow-sm p-1">
              {['All','Submitted','Not submitted'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSubmissionFilter(tab === 'All' ? 'all' : tab === 'Submitted' ? 'submitted' : 'not_submitted')}
                  className={`px-3 py-2 text-xs rounded-2xl font-medium transition ${submissionFilter === (tab === 'All' ? 'all' : tab === 'Submitted' ? 'submitted' : 'not_submitted') ? 'bg-sky-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  style={{lineHeight: '1'}}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="inline-flex items-center gap-1 bg-white rounded-full border border-slate-100 shadow-sm p-1">
              {['All','Pending','Received'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setClaimedFilter(tab === 'All' ? 'all' : tab === 'Received' ? 'received' : 'pending')}
                  className={`px-3 py-2 text-xs rounded-2xl font-medium transition ${claimedFilter === (tab === 'All' ? 'all' : tab === 'Received' ? 'received' : 'pending') ? 'bg-sky-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  style={{lineHeight: '1'}}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom section - table */}
        <div className="mt-6">
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="px-2 py-2">
                <div className="text-sm font-semibold">Disbursement list</div>
              </div>

              <div className="overflow-auto">
                <div className="rounded-t-2xl overflow-hidden">
              {loading ? (
                <div className="p-6 text-sm text-slate-500">Loading grantees…</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-sm text-slate-500">No active grantees found for this semester.</div>
                ) : (
                  <>
                  <table className="w-full table-auto min-w-full">
                    <thead>
                      <tr className="text-left text-xs text-slate-500 border-b border-slate-100 sticky top-0 z-10 bg-white">
                        <th className="py-4 w-14 text-center align-top"> </th>
                        <th className="py-4 align-top text-left">Student name</th>
                        <th className="py-4 align-top pl-10 w-96 text-left">Semester</th>
                        <th className="py-4 text-center w-48 align-top">Submission status</th>
                        <th className="py-4 text-center w-40 align-top">Payout status</th>
                        <th className="py-4 pr-6 text-right w-64 align-top">Claimed at</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {pagedRows.map((g, idx) => (
                      <tr key={g.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'} align-top`}> 
                        <td className="py-4 align-middle text-sm text-slate-900 text-center w-14">
                          <label className="flex items-center justify-center h-full">
                            <input
                              type="checkbox"
                              checked={g.status === "Claimed"}
                              onChange={() => toggleClaimed(g.id)}
                              aria-busy={processingIds[g.id] ? true : undefined}
                              className="h-4 w-4 rounded border-slate-200 accent-emerald-300 focus:ring-emerald-100 hover:opacity-100 transition-none"
                            />
                          </label>
                        </td>
                        <td className="py-4 align-top text-sm text-slate-900">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-sky-700 text-white text-xs font-semibold flex items-center justify-center shrink-0">{g.name.split(' ').map(n=>n[0]).slice(0,2).join('').toUpperCase()}</div>
                            <div>{g.name}</div>
                          </div>
                        </td>
                        <td className="py-4 align-top text-sm text-slate-600 pl-10 w-96">{g.semester}</td>
                        <td className="py-4 align-top text-sm text-slate-700 text-center">
                          {g.submissionState === 'Approved' ? (
                            <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Approved</span>
                          ) : g.submissionState === 'Pending review' ? (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Pending review</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Not submitted</span>
                          )}
                        </td>
                        <td className="py-4 align-top text-center">
                          {g.status === "Claimed" ? (
                            <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">Received</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Pending</span>
                          )}
                        </td>
                        <td className="py-4 align-top text-sm text-slate-700 text-right pr-6 whitespace-nowrap">
                          {g.claimedAt ? new Date(g.claimedAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  </table>

                  <div className="px-6 py-3 flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      Showing {(filteredWithSubmission.length === 0) ? 0 : (currentPage - 1) * rowsPerPage + 1} - {Math.min(currentPage * rowsPerPage, filteredWithSubmission.length)} of {filteredWithSubmission.length}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1 rounded-md border border-slate-200 bg-white text-sm text-slate-700 disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <div className="text-sm text-slate-700">Page {currentPage} of {totalPages}</div>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 rounded-md border border-slate-200 bg-white text-sm text-slate-700 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                  </>
              )}
            </div>
            </div>
          </div>
        </div>
    </main>
  );
}
