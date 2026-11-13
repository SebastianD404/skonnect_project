"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, FileCheck, LoaderCircle, Plus, Search, Trash2, UserCheck, X } from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import type { SkeapWaitlistApplication, SkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { DEFAULT_SKEAP_MAX_SLOTS } from "@/lib/skeap-capacity-constants";
import { ADMIN_TABLE_PAGE_SIZES, DEFAULT_ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-pagination";

type CapacityState = {
  activeCount: number;
  maxSlots: number;
};

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
    return { error: "The server returned an unexpected response. Please try again." };
  }
}

export default function SkeapWaitlistClient({ initialData }: { initialData: SkeapWaitlistSnapshot }) {
  const [applications, setApplications] = useState<SkeapWaitlistApplication[]>(initialData.applications);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [isPromoteModalOpen, setIsPromoteModalOpen] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<SkeapWaitlistApplication | null>(null);
  const [physicalVerificationConfirmed, setPhysicalVerificationConfirmed] = useState(false);
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
  const isPromotionBlockedByCapacity = selectedApplicant !== null && isCapacityExceeded;
  const isOverConfiguredCapacity = capacity.activeCount > capacity.maxSlots;
  const isOverHardCapacity = capacity.activeCount > DEFAULT_SKEAP_MAX_SLOTS;
  const remainingSlots = Math.max(0, capacity.maxSlots - capacity.activeCount);
  const remainingSlotsLabel = isOverConfiguredCapacity
    ? `${capacity.activeCount - capacity.maxSlots} over capacity`
    : `${remainingSlots} remaining ${remainingSlots === 1 ? "slot" : "slots"}`;
  const canIncreaseConfiguredCapacity =
    capacity.maxSlots < DEFAULT_SKEAP_MAX_SLOTS &&
    capacity.activeCount <= DEFAULT_SKEAP_MAX_SLOTS;
  const capacityTooltip = isOverHardCapacity
    ? "The hard 55-slot limit is exceeded. Review active records before promoting."
    : canIncreaseConfiguredCapacity
      ? "All configured slots are filled. The limit can be raised up to 55."
      : "All 55 slots are filled. A slot must be freed before promotion.";
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_ADMIN_TABLE_PAGE_SIZE);
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

  function closePromotionModal() {
    setIsPromoteModalOpen(false);
    setSelectedApplicant(null);
    setPhysicalVerificationConfirmed(false);
  }

  async function promoteApplication(application: SkeapWaitlistApplication, confirmPhysicalVerification: boolean) {
    setPromotingId(application.id);
    setToastMessage(null);
    setActionError(null);
    try {
      const response = await fetch(`/api/admin/applications/${application.id}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmPhysicalVerification }),
      });
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
      closePromotionModal();
      setToastMessage(`${application.applicantName} was promoted to an active grantee.`);
      await loadWaitlist();
    } catch (promoteError) {
      closePromotionModal();
      setActionError(promoteError instanceof Error ? promoteError.message : "Unable to promote applicant.");
    } finally {
      setPromotingId(null);
    }
  }

  function openPromotionModal(application: SkeapWaitlistApplication) {
    setSelectedApplicant(application);
    setPhysicalVerificationConfirmed(false);
    setIsPromoteModalOpen(true);
  }

  async function handleConfirmPromotion() {
    if (!selectedApplicant) return;
    if (isCapacityExceeded) {
      setCapacityWarning(true);
      return;
    }
    const confirmed = selectedApplicant.physicalDocumentsConfirmed || physicalVerificationConfirmed;
    if (!confirmed) return;
    await promoteApplication(selectedApplicant, confirmed);
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
        <div className="flex shrink-0">
          <div
            className={`group relative flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-4 py-2.5 shadow-sm transition-colors hover:shadow-md ${isOverConfiguredCapacity ? "border-rose-200 bg-rose-50 hover:border-rose-300" : "border-slate-200/80 bg-white hover:border-cyan-300"}`}
          >
            <div
              tabIndex={0}
              className="min-w-0 whitespace-nowrap"
              aria-describedby="remaining-slots-tooltip"
              aria-label={isOverConfiguredCapacity
                ? `${capacity.activeCount} active records, ${capacity.maxSlots} slot limit, ${capacity.activeCount - capacity.maxSlots} over capacity`
                : `${capacity.activeCount} of ${capacity.maxSlots} active slots; ${remainingSlots} slots remaining`}
            >
              <span className="flex items-baseline">
                <span className={`text-xl font-bold leading-none ${isOverConfiguredCapacity ? "text-rose-700" : "text-[#086b7d]"}`}>{capacity.activeCount}</span>
                <span className="mx-1 text-xl font-bold leading-none text-slate-800">/</span>
                <span className="mr-2 text-xl font-bold leading-none text-slate-900">{capacity.maxSlots}</span>
                <span className="text-[10px] font-semibold uppercase leading-none tracking-wider text-slate-400 sm:text-xs">
                  Active Slots
                </span>
              </span>
            </div>
            {canIncreaseConfiguredCapacity ? (
              <>
                <div className="mx-1 h-6 border-l border-slate-200" />
                {!editingCapacity ? (
                  <button type="button" onClick={() => setEditingCapacity(true)} className="whitespace-nowrap text-xs font-semibold text-slate-600 transition-colors hover:text-slate-900">
                    Edit Slot Limit
                  </button>
                ) : (
                  <div className="flex min-w-0 max-w-full flex-nowrap items-center gap-2">
                    <input
                      type="number"
                      min={1}
                      max={DEFAULT_SKEAP_MAX_SLOTS}
                      value={slotLimitDraft}
                      onChange={(event) => setSlotLimitDraft(event.target.value)}
                      className="h-9 w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                      aria-label={`Maximum SKEAP slots, hard limit ${DEFAULT_SKEAP_MAX_SLOTS}`}
                    />
                    <button type="button" onClick={() => void saveCapacity()} disabled={savingCapacity} className="h-9 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50">
                      {savingCapacity ? "Saving..." : "Save Changes"}
                    </button>
                    <button type="button" onClick={() => { setEditingCapacity(false); setSlotLimitDraft(String(capacity.maxSlots)); }} disabled={savingCapacity} className="h-9 whitespace-nowrap rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                      Cancel
                    </button>
                  </div>
                )}
              </>
            ) : null}
            <span
              id="remaining-slots-tooltip"
              role="tooltip"
              className="pointer-events-none absolute right-3 top-full z-30 mt-2 translate-y-1 whitespace-nowrap rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white opacity-0 shadow-lg transition duration-150 group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:translate-y-0 group-focus-within:opacity-100"
            >
              {remainingSlotsLabel}
            </span>
          </div>
        </div>
      </header>

      {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-800">{error}</div> : null}
      {isOverConfiguredCapacity ? (
        <div role="alert" className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold text-rose-900">
                {isOverHardCapacity ? "SKEAP is over its hard capacity" : "SKEAP is over its configured capacity"}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-rose-800">
                {capacity.activeCount} active records exceed the {capacity.maxSlots}-slot limit by {capacity.activeCount - capacity.maxSlots}. New promotions are blocked. Existing grants will not be changed automatically; review the active records to reconcile the count.
              </p>
            </div>
          </div>
          <Link href="/admin/skeap/active" className="shrink-0 rounded-lg border border-rose-300 bg-white px-3 py-2 text-center text-xs font-semibold text-rose-800 transition hover:bg-rose-100">
            Review active grantees
          </Link>
        </div>
      ) : null}
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
          <>
            <div className="flex flex-col gap-3 p-4 md:hidden">
              {visibleApplications.map((application) => (
                <article key={application.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex min-w-0 items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-lg font-black text-white shadow-sm">
                      #{application.waitlistPosition ?? "-"}
                    </div>
                    <div className="flex min-w-0 flex-col">
                      <h3 className="truncate text-sm font-bold leading-tight text-slate-900">{application.applicantName}</h3>
                      <p className="mt-0.5 break-all text-xs text-slate-500">{application.emailAddress}</p>
                      <p className="text-xs text-slate-500">{application.contactNumber || "No phone number"}</p>
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs">
                    <p className="truncate font-semibold text-slate-800">{normalizeSkeapSchoolName(application.school)}</p>
                    <p className="mt-0.5 break-words text-slate-500">
                      {[
                        application.educationLevel,
                        application.currentCourse === "N/A" ? undefined : application.currentCourse,
                        application.yearLevel,
                      ].filter(Boolean).join(" · ") || "Program details unavailable"}
                    </p>
                    <p className="mt-1 text-slate-500">Submitted: {formatDate(application.submittedAt)}</p>
                  </div>

                  <div className="flex items-center gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => openPromotionModal(application)}
                      disabled={isCapacityExceeded || promotingId !== null || waitlistActionId !== null}
                      title={isCapacityExceeded ? capacityTooltip : application.physicalDocumentsConfirmed ? "Promote to active Grantee" : "Verify documents and promote to Grantee"}
                      className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <UserCheck className="h-4 w-4" aria-hidden="true" />
                      {application.physicalDocumentsConfirmed ? "Promote" : "Verify & Promote"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPendingRemoval(application)}
                      disabled={waitlistActionId !== null}
                      aria-label={`Remove ${application.applicantName} from the waitlist`}
                      title="Remove from waitlist and return to pending review"
                      className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden w-full overflow-x-auto whitespace-nowrap md:block">
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
                          aria-label={application.physicalDocumentsConfirmed ? "Promote to Grantee" : "Verify documents and promote to Grantee"}
                          title={isCapacityExceeded ? capacityTooltip : application.physicalDocumentsConfirmed ? "Promote to active Grantee" : "Verify documents and promote to Grantee"}
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-600 transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <UserCheck className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingRemoval(application)}
                          disabled={waitlistActionId !== null}
                          aria-label={`Remove ${application.applicantName} from the waitlist`}
                          title="Remove from waitlist and return to pending review"
                          className="flex h-9 w-9 items-center justify-center rounded-full border border-rose-200 bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
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
          </>
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
                {ADMIN_TABLE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} rows</option>)}
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
            onClick={closePromotionModal}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="promote-modal-title"
            className={`relative flex w-full max-w-sm flex-col items-center gap-3 overflow-hidden rounded-2xl border border-t-4 border-slate-200 bg-white p-5 text-center shadow-xl ring-1 ring-slate-900/5 animate-in zoom-in-95 fade-in duration-200 ${isPromotionBlockedByCapacity || !selectedApplicant.physicalDocumentsConfirmed ? "border-t-amber-500" : "border-t-emerald-500"}`}
          >
            {isPromotionBlockedByCapacity ? (
              <>
                <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-50/50">
                  <AlertTriangle className="h-6 w-6 text-amber-600" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 id="promote-modal-title" className="text-[17px] font-black leading-none text-slate-900">
                    Capacity limit reached
                  </h3>
                  <p className="px-2 text-[13px] leading-snug text-slate-500">
                    {isOverHardCapacity ? (
                      <>
                        There are <span className="font-bold text-slate-900">{capacity.activeCount} active records</span>, which is {capacity.activeCount - DEFAULT_SKEAP_MAX_SLOTS} over the hard limit of {DEFAULT_SKEAP_MAX_SLOTS}. Promotions are blocked; existing grants need review and will not be changed automatically.
                      </>
                    ) : capacity.maxSlots < DEFAULT_SKEAP_MAX_SLOTS ? (
                      <>
                        {capacity.activeCount > capacity.maxSlots ? (
                          <>
                            There are <span className="font-bold text-slate-900">{capacity.activeCount} active records against a {capacity.maxSlots}-slot configured limit</span>. You may raise it, but never above the hard maximum of {DEFAULT_SKEAP_MAX_SLOTS}.
                          </>
                        ) : (
                          <>
                            All <span className="font-bold text-slate-900">{capacity.activeCount} / {capacity.maxSlots} configured slots</span> are occupied. You may raise the configured limit, but never above the hard maximum of {DEFAULT_SKEAP_MAX_SLOTS}.
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        All <span className="font-bold text-slate-900">{capacity.activeCount} / {DEFAULT_SKEAP_MAX_SLOTS} scholarship slots</span> are occupied. A slot must be formally freed before promoting another grantee.
                      </>
                    )}
                  </p>
                </div>
                <div className="grid w-full grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={closePromotionModal}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    Cancel
                  </button>
                  {canIncreaseConfiguredCapacity ? (
                    <button
                      type="button"
                      onClick={() => {
                        closePromotionModal();
                        setSlotLimitDraft(String(capacity.maxSlots));
                        setEditingCapacity(true);
                      }}
                      className="w-full rounded-xl border border-slate-900 bg-slate-900 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                    >
                      Edit Slots
                    </button>
                  ) : (
                    <Link
                      href="/admin/skeap/active"
                      className="w-full rounded-xl border border-slate-900 bg-slate-900 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-1"
                    >
                      Review Grantees
                    </Link>
                  )}
                </div>
              </>
            ) : !selectedApplicant.physicalDocumentsConfirmed ? (
              <>
                <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-amber-50 ring-4 ring-amber-50/50">
                  <FileCheck className="h-6 w-6 text-amber-600" aria-hidden="true" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <h3 id="promote-modal-title" className="text-[17px] font-black leading-tight text-slate-900">
                    Physical Verification Required
                  </h3>
                  <p className="px-2 text-[13px] leading-snug text-slate-500">
                    <span className="font-bold text-slate-900">{selectedApplicant.applicantName}</span> was waitlisted online but has not completed physical document verification. Have they presented their Certified True Copies (CTC) at the barangay hall?
                  </p>
                </div>
                <label className="flex w-full cursor-pointer items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-left text-xs leading-relaxed text-slate-700">
                  <input
                    type="checkbox"
                    required
                    checked={physicalVerificationConfirmed}
                    onChange={(event) => setPhysicalVerificationConfirmed(event.target.checked)}
                    className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>I confirm I have physically verified the original/CTC documents.</span>
                </label>
                <div className="flex w-full flex-col gap-2.5">
                  <button
                    type="button"
                    onClick={() => void handleConfirmPromotion()}
                    disabled={!physicalVerificationConfirmed || promotingId !== null}
                    className="w-full rounded-xl border border-indigo-600 bg-indigo-600 py-2.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {promotingId === selectedApplicant.id ? "Processing..." : "Verify & Promote to Grantee"}
                  </button>
                  <button
                    type="button"
                    onClick={closePromotionModal}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200"
                  >
                    Cancel
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
                    onClick={closePromotionModal}
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
                    {promotingId === selectedApplicant.id
                      ? "Processing..."
                      : "Confirm"}
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
            className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl"
          >
            <div className="flex items-start gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 id="remove-waitlist-title" className="text-base font-bold tracking-tight text-slate-900">Remove from waitlist?</h2>
                <p className="mt-1.5 text-sm leading-5 text-slate-600">
                  <span className="font-semibold text-slate-900">{pendingRemoval.applicantName}</span> will be removed from the queue and returned to pending application review. Their application and uploaded documents will not be deleted.
                </p>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setPendingRemoval(null)}
                disabled={waitlistActionId !== null}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Keep on waitlist
              </button>
              <button
                type="button"
                onClick={() => void removeFromWaitlist(pendingRemoval)}
                disabled={waitlistActionId !== null}
                className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
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