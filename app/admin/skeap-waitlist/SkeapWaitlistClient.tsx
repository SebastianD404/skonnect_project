"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, LoaderCircle, Plus, Search, Trash2, X } from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import type { SkeapWaitlistApplication, SkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";

type CapacityState = {
  activeCount: number;
  maxSlots: number;
};

const PAGE_SIZES = [10, 20, 50] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) return {} as Record<string, unknown>;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return { error: text.slice(0, 300) };
  }
}

export default function SkeapWaitlistClient({ initialData }: { initialData: SkeapWaitlistSnapshot }) {
  const [applications, setApplications] = useState<SkeapWaitlistApplication[]>(initialData.applications);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<SkeapWaitlistApplication | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState("");
  const [candidateApplications, setCandidateApplications] = useState<SkeapWaitlistApplication[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<SkeapWaitlistApplication | null>(null);
  const [isLoadingCandidates, setIsLoadingCandidates] = useState(false);
  const [pendingRemoval, setPendingRemoval] = useState<SkeapWaitlistApplication | null>(null);
  const [waitlistActionId, setWaitlistActionId] = useState<string | null>(null);
  const [capacityWarning, setCapacityWarning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<CapacityState>({
    activeCount: initialData.activeCount,
    maxSlots: initialData.maxSlots,
  });
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [slotLimitDraft, setSlotLimitDraft] = useState(String(initialData.maxSlots));
  const [savingCapacity, setSavingCapacity] = useState(false);
  const isCapacityExceeded = capacityWarning || capacity.activeCount >= capacity.maxSlots;
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZES[0]);
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const filteredApplications = applications.filter((application) =>
    [application.applicantName, application.emailAddress]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearchQuery)
  );
  const totalPages = Math.max(1, Math.ceil(filteredApplications.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstVisibleIndex = (currentPage - 1) * pageSize;
  const visibleApplications = filteredApplications.slice(firstVisibleIndex, firstVisibleIndex + pageSize);

  const loadWaitlist = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/admin/skeap-applications/waitlist", { cache: "no-store" });
      const body = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(body.error || "Unable to load the waitlist."));
      setApplications(Array.isArray(body.applications) ? body.applications as unknown as SkeapWaitlistApplication[] : []);
      const activeCount = typeof body.activeCount === "number" ? body.activeCount : 0;
      const maxSlots = typeof body.maxSlots === "number" ? body.maxSlots : 55;
      setCapacity({ activeCount, maxSlots });
      setCapacityWarning(false);
      if (!editingCapacity) setSlotLimitDraft(String(maxSlots));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load the waitlist.");
    }
  }, [editingCapacity]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void loadWaitlist();
    };
    const interval = window.setInterval(refreshWhenVisible, 15_000);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    window.addEventListener("focus", refreshWhenVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      window.removeEventListener("focus", refreshWhenVisible);
    };
  }, [loadWaitlist]);

  useEffect(() => {
    if (!isAddModalOpen || candidateQuery.trim().length < 2) {
      return;
    }

    let isCurrentRequest = true;
    const timeout = window.setTimeout(async () => {
      setIsLoadingCandidates(true);
      try {
        const params = new URLSearchParams({ mode: "candidates", query: candidateQuery.trim() });
        const response = await fetch(`/api/admin/skeap-applications/waitlist?${params}`, { cache: "no-store" });
        const body = await readJsonResponse(response);
        if (!response.ok) throw new Error(String(body.error || "Unable to search pending applications."));
        if (isCurrentRequest) {
          setCandidateApplications(
            Array.isArray(body.applications) ? body.applications as unknown as SkeapWaitlistApplication[] : []
          );
        }
      } catch (candidateError) {
        if (isCurrentRequest) {
          setActionError(candidateError instanceof Error ? candidateError.message : "Unable to search pending applications.");
        }
      } finally {
        if (isCurrentRequest) setIsLoadingCandidates(false);
      }
    }, 250);

    return () => {
      isCurrentRequest = false;
      window.clearTimeout(timeout);
    };
  }, [candidateQuery, isAddModalOpen]);

  async function saveCapacity() {
    setSavingCapacity(true);
    setToastMessage(null);
    setError(null);
    setActionError(null);
    try {
      const response = await fetch("/api/admin/settings/slots", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: Number(slotLimitDraft) }),
      });
      const body = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(body.error || "Unable to update the slot limit."));
      const maxSlots = Number(body.value);
      setCapacity((current) => ({ ...current, maxSlots }));
      setCapacityWarning(false);
      setSlotLimitDraft(String(maxSlots));
      setEditingCapacity(false);
      setToastMessage("SKEAP slot limit updated successfully.");
    } catch (saveError) {
      setActionError(saveError instanceof Error ? saveError.message : "Unable to update the slot limit.");
    } finally {
      setSavingCapacity(false);
    }
  }

  async function promoteApplication(application: SkeapWaitlistApplication) {
    setPromotingId(application.id);
    setToastMessage(null);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/applications/${application.id}/promote`, { method: "POST" });
      const body = await readJsonResponse(response);
      if (!response.ok) {
        const message = String(body.error || "Unable to promote applicant.");
        if (response.status === 409 && message.toLowerCase().includes("slots are currently filled")) {
          setCapacityWarning(true);
          await loadWaitlist();
          return;
        }
        throw new Error(message);
      }
      setIsPromoteModalOpen(false);
      setSelectedApplicant(null);
      setToastMessage(`${application.applicantName} was promoted to an active grantee.`);
      await loadWaitlist();
    } catch (promoteError) {
      setIsPromoteModalOpen(false);
      setSelectedApplicant(null);
      setActionError(promoteError instanceof Error ? promoteError.message : "Unable to promote applicant.");
    } finally {
      setPromotingId(null);
    }
  }

  function openPromotionModal(application: SkeapWaitlistApplication) {
    setSelectedApplicant(application);
    setIsPromoteModalOpen(true);
  }

  async function handleConfirmPromotion() {
    if (!selectedApplicant) return;
    if (capacity.activeCount >= capacity.maxSlots || capacityWarning) {
      setCapacityWarning(true);
      return;
    }
    await promoteApplication(selectedApplicant);
  }

  async function addToWaitlist(application: SkeapWaitlistApplication) {
    setWaitlistActionId(application.id);
    setActionError(null);
    setToastMessage(null);
    try {
      const response = await fetch("/api/admin/skeap-applications/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId: application.id }),
      });
      const body = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(body.error || "Unable to add applicant to the waitlist."));
      setIsAddModalOpen(false);
      setSelectedCandidate(null);
      setCandidateQuery("");
      setToastMessage(`${application.applicantName} was added to the waitlist.`);
      await loadWaitlist();
    } catch (addError) {
      setActionError(addError instanceof Error ? addError.message : "Unable to add applicant to the waitlist.");
    } finally {
      setWaitlistActionId(null);
    }
  }

  async function removeFromWaitlist(application: SkeapWaitlistApplication) {
    setWaitlistActionId(application.id);
    setActionError(null);
    setToastMessage(null);
    try {
      const response = await fetch(`/api/admin/skeap-applications/waitlist/${application.id}`, { method: "DELETE" });
      const body = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(body.error || "Unable to remove applicant from the waitlist."));
      setPendingRemoval(null);
      setToastMessage(`${application.applicantName} was removed from the waitlist and returned to pending review.`);
      await loadWaitlist();
    } catch (removeError) {
      setActionError(removeError instanceof Error ? removeError.message : "Unable to remove applicant from the waitlist.");
    } finally {
      setWaitlistActionId(null);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 pb-12">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="max-w-2xl">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">SKEAP Capacity Management</span>
          <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Scholarship waitlist</h1>
          <p className="text-sm leading-relaxed text-slate-500">
            Applicants are ordered by the time they joined the queue. Promote the next applicant when an active scholarship slot becomes available.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-2.5 shadow-sm">
          <div className="flex items-baseline gap-1.5 whitespace-nowrap">
            <span className="text-xl font-black leading-none text-cyan-700">{capacity.activeCount}</span>
            <span className="text-xl font-black leading-none text-slate-300">/</span>
            <span className="text-xl font-black leading-none text-slate-900">{capacity.maxSlots}</span>
            <span className="ml-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Active Slots</span>
          </div>
          <div className="mx-1 h-6 w-px bg-slate-200" />
          {!editingCapacity ? (
            <button type="button" onClick={() => setEditingCapacity(true)} className="whitespace-nowrap text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900">
              Edit Slot Limit
            </button>
          ) : (
            <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-2">
              <input
                type="number"
                min={1}
                max={100000}
                value={slotLimitDraft}
                onChange={(event) => setSlotLimitDraft(event.target.value)}
                className="h-9 w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                aria-label="Maximum SKEAP slots"
              />
              <button type="button" onClick={() => void saveCapacity()} disabled={savingCapacity} className="h-9 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                {savingCapacity ? "Saving..." : "Save Changes"}
              </button>
              <button type="button" onClick={() => { setEditingCapacity(false); setSlotLimitDraft(String(capacity.maxSlots)); }} disabled={savingCapacity} className="h-9 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                Cancel
              </button>
            </div>
          )}
        </div>
      </header>

      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">{error}</div> : null}
      {actionError ? (
        <FloatingFeedback message={actionError} type="error" onDismiss={() => setActionError(null)} />
      ) : toastMessage ? (
        <FloatingFeedback message={toastMessage} type="success" autoDismissMs={3000} onDismiss={() => setToastMessage(null)} />
      ) : null}

      <section className="flex flex-col overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Filter waitlist by name or email..."
              aria-label="Filter waitlist by name or email"
              className="w-full rounded-full border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs text-slate-700 shadow-sm outline-none placeholder:text-slate-400 focus:border-cyan-500"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setCandidateQuery("");
              setSelectedCandidate(null);
              setActionError(null);
              setIsAddModalOpen(true);
            }}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-cyan-800 sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Add applicant</span>
          </button>
        </div>

        {applications.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-sm text-slate-500">No applicants are currently waitlisted.</div>
        ) : filteredApplications.length === 0 ? (
          <div className="flex items-center justify-center px-6 py-12 text-center text-sm text-slate-500">No applicants match your search.</div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full border-collapse whitespace-nowrap text-left text-sm">
              <thead className="bg-gradient-to-r from-slate-900 to-cyan-900">
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-cyan-50">
                  <th className="px-6 py-4">Position</th>
                  <th className="px-6 py-4">Applicant</th>
                  <th className="px-6 py-4">Program Details</th>
                  <th className="px-6 py-4">Submitted</th>
                  <th className="px-6 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {visibleApplications.map((application) => (
                  <tr key={application.id} className="group align-top transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <span className="text-lg font-black text-slate-900">#{application.waitlistPosition ?? "-"}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-0.5">
                        <p className="font-semibold text-slate-900">{application.applicantName}</p>
                        <p className="text-xs text-slate-500">{application.emailAddress}</p>
                        {application.contactNumber ? <p className="text-xs text-slate-400">{application.contactNumber}</p> : null}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-700">
                      <div className="flex flex-col gap-0.5">
                        <p>{normalizeSkeapSchoolName(application.school)}</p>
                        <p className="text-xs font-medium text-slate-500">
                          {[
                            application.educationLevel,
                            application.currentCourse === "N/A" ? undefined : application.currentCourse,
                            application.yearLevel,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{formatDate(application.submittedAt)}</td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openPromotionModal(application)}
                          disabled={isCapacityExceeded || promotingId !== null || waitlistActionId !== null}
                          title={isCapacityExceeded ? "Capacity full. Increase slot limit to promote." : "Promote applicant"}
                          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Promote to Grantee
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingRemoval(application)}
                          disabled={waitlistActionId !== null}
                          aria-label={`Remove ${application.applicantName} from the waitlist`}
                          title="Remove from waitlist and return to pending review"
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-white text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 bg-slate-50/50 px-6 py-3.5 sm:flex-row">
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-xs font-medium text-slate-500">
              {filteredApplications.length === 0 ? (
                <span>No records found</span>
              ) : (
                <span className="font-bold text-slate-700">
                  {filteredApplications.length} result{filteredApplications.length === 1 ? "" : "s"}
                </span>
              )}
            </span>
            <label className="flex items-center gap-1.5 border-l border-slate-200 pl-4">
              <span className="text-[11px] font-medium text-slate-400">Show</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 shadow-sm outline-none transition-all focus:ring-2 focus:ring-cyan-600"
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size} rows</option>)}
              </select>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1 || filteredApplications.length === 0}
              onClick={() => setPage(currentPage - 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-1 text-xs font-medium text-slate-500">
              Page <span className="font-bold text-slate-700">{currentPage}</span> of <span className="font-bold text-slate-700">{totalPages}</span>
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages || filteredApplications.length === 0}
              onClick={() => setPage(currentPage + 1)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      </section>

      {isPromoteModalOpen && selectedApplicant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            aria-hidden="true"
            onClick={() => {
              setIsPromoteModalOpen(false);
              setSelectedApplicant(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="promote-modal-title"
            className={`relative flex w-full max-w-sm flex-col items-center gap-3 overflow-hidden rounded-2xl border border-t-4 border-slate-200 bg-white p-5 text-center shadow-xl ring-1 ring-slate-900/5 animate-in zoom-in-95 fade-in duration-200 ${isCapacityExceeded ? "border-t-amber-500" : "border-t-emerald-500"}`}
          >
            {isCapacityExceeded ? (
              <>
                <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-50/50">
                  <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 id="promote-modal-title" className="text-[17px] font-black leading-none text-slate-900">
                    Capacity limit reached
                  </h3>
                  <p className="px-2 text-[13px] leading-snug text-slate-500">
                    You currently have <span className="font-bold text-slate-900">{capacity.activeCount} / {capacity.maxSlots} active slots</span> filled. Increase the slot limit before promoting new grantees.
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPromoteModalOpen(false);
                      setSelectedApplicant(null);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsPromoteModalOpen(false);
                      setSelectedApplicant(null);
                      setSlotLimitDraft(String(capacity.maxSlots));
                      setEditingCapacity(true);
                    }}
                    className="w-full rounded-xl border border-slate-900 bg-slate-900 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                  >
                    Edit Slots
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50 ring-4 ring-emerald-50/50">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 id="promote-modal-title" className="text-[17px] font-black leading-none text-slate-900">
                    Promote to grantee?
                  </h3>
                  <p className="px-2 text-[13px] leading-snug text-slate-500">
                    You&apos;re promoting <span className="font-bold text-slate-900">{selectedApplicant.applicantName}</span>. This uses <span className="font-bold text-slate-900">1 slot</span> and sends an automated email.
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsPromoteModalOpen(false);
                      setSelectedApplicant(null);
                    }}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleConfirmPromotion()}
                    disabled={promotingId !== null}
                    className="w-full rounded-xl border border-emerald-600 bg-emerald-600 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {promotingId === selectedApplicant.id ? "Promoting..." : "Confirm"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      {isAddModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            aria-label="Close add applicant dialog"
            onClick={() => {
              setIsAddModalOpen(false);
              setSelectedCandidate(null);
            }}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-waitlist-title"
            className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="add-waitlist-title" className="text-base font-bold text-slate-900">Add applicant to waitlist</h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Search pending SKEAP applications. Adding one approves it and places it at the end of the queue.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSelectedCandidate(null);
                }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="relative p-5 pb-3">
              <Search className="absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
              <input
                autoFocus
                value={candidateQuery}
                onChange={(event) => {
                  setCandidateQuery(event.target.value);
                  setSelectedCandidate(null);
                }}
                placeholder="Search applicant name or email..."
                aria-label="Search pending applications"
                className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
              />
            </div>
            <div className="min-h-32 flex-1 overflow-y-auto px-5 pb-4">
              {candidateQuery.trim().length < 2 ? (
                <p className="py-8 text-center text-sm text-slate-500">Search by applicant name or email to find pending applications.</p>
              ) : isLoadingCandidates ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
                  <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Searching applications...
                </div>
              ) : candidateApplications.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">No pending applications match that search.</p>
              ) : (
                <ul className="divide-y divide-slate-100 rounded-xl border border-slate-100">
                  {candidateApplications.map((candidate) => (
                    <li key={candidate.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedCandidate(candidate)}
                        aria-pressed={selectedCandidate?.id === candidate.id}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-3 text-left transition-colors ${selectedCandidate?.id === candidate.id ? "bg-cyan-50" : "hover:bg-slate-50"}`}
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-semibold text-slate-900">{candidate.applicantName}</span>
                          <span className="block truncate text-xs text-slate-500">{candidate.emailAddress} · {candidate.school}</span>
                        </span>
                        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${selectedCandidate?.id === candidate.id ? "bg-cyan-700 text-white" : "bg-slate-100 text-slate-600"}`}>
                          {selectedCandidate?.id === candidate.id ? "Selected" : "Select"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <footer className="flex flex-col gap-3 border-t border-slate-100 bg-slate-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-relaxed text-slate-500">
                {selectedCandidate
                  ? `This approves ${selectedCandidate.applicantName} and assigns the next queue position.`
                  : "Select a pending application to continue."}
              </p>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setSelectedCandidate(null);
                  }}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => selectedCandidate && void addToWaitlist(selectedCandidate)}
                  disabled={!selectedCandidate || waitlistActionId !== null}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-700 px-3 py-2 text-xs font-semibold text-white hover:bg-cyan-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {waitlistActionId === selectedCandidate?.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                  Add to waitlist
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}

      {pendingRemoval ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            aria-label="Cancel removing applicant"
            onClick={() => setPendingRemoval(null)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="remove-waitlist-title"
            className="relative w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
          >
            <h2 id="remove-waitlist-title" className="text-base font-bold text-slate-900">Remove from waitlist?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              <span className="font-semibold text-slate-900">{pendingRemoval.applicantName}</span> will be removed from the queue and returned to pending application review. Their application and uploaded documents will not be deleted.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                disabled={waitlistActionId !== null}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Keep on waitlist
              </button>
              <button
                type="button"
                onClick={() => void removeFromWaitlist(pendingRemoval)}
                disabled={waitlistActionId !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {waitlistActionId === pendingRemoval.id ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                Remove applicant
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}