"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, FileCheck, Info, LoaderCircle, Mail, MoreHorizontal, Plus, Search, Send, Trash2, UserCheck, X } from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import type { SkeapWaitlistApplication, SkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { DEFAULT_SKEAP_MAX_SLOTS } from "@/lib/skeap-capacity-constants";
import { ADMIN_TABLE_PAGE_SIZES, DEFAULT_ADMIN_TABLE_PAGE_SIZE } from "@/lib/admin-pagination";
import AdminPaginationControls from "../AdminPaginationControls";

type CapacityState = {
  activeCount: number;
  maxSlots: number;
};

const PHT_OFFSET_MS = 8 * 60 * 60 * 1000;

function formatDate(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function getDefaultOfferDeadlineInput() {
  const manilaDate = new Date(Date.now() + PHT_OFFSET_MS);
  manilaDate.setUTCDate(manilaDate.getUTCDate() + 7);
  manilaDate.setUTCHours(17, 0, 0, 0);
  return manilaDate.toISOString().slice(0, 16);
}

function toManilaDateTimeInput(value: string) {
  return new Date(Date.parse(value) + PHT_OFFSET_MS).toISOString().slice(0, 16);
}

function manilaDateTimeInputToIso(value: string) {
  return new Date(`${value}:00+08:00`).toISOString();
}

function formatManilaDateTimeInput(value: string) {
  return new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "long",
    timeStyle: "short",
  }).format(new Date(manilaDateTimeInputToIso(value)));
}

function getDefaultOfferMessage(
  application: SkeapWaitlistApplication,
  deadlineInput: string,
) {
  return `Dear ${application.applicantName},

A SKEAP scholarship slot is now available for you (Queue Position #${application.waitlistPosition ?? "—"}).

Please present your original / Certified True Copy (CTC) documents at the Barangay Pico Hall on or before ${formatManilaDateTimeInput(deadlineInput)} PHT to complete your physical verification.

Sangguniang Kabataan of Barangay Pico`;
}

function OfferStatusBadge({
  application,
  now,
}: {
  application: SkeapWaitlistApplication;
  now: number | null;
}) {
  if (application.waitlistOfferMessage && application.waitlistOfferExpiresAt) {
    const deadline = new Date(application.waitlistOfferExpiresAt).getTime();
    const diffMs = now === null ? null : deadline - now;
    const isOverdue = diffMs !== null && diffMs <= 0;
    const isUrgent = diffMs !== null && diffMs > 0 && diffMs <= 48 * 60 * 60 * 1000;
    let countdownLabel = "Notice Sent";

    if (isOverdue) {
      countdownLabel = "Notice Sent · Overdue";
    } else if (diffMs !== null && diffMs <= 24 * 60 * 60 * 1000) {
      const totalMinutes = Math.ceil(diffMs / (60 * 1000));
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      countdownLabel = `Notice Sent · ${hours}h ${minutes}m left`;
    } else if (isUrgent && diffMs !== null) {
      countdownLabel = `Notice Sent · ${Math.floor(diffMs / (60 * 60 * 1000))}h left`;
    } else if (diffMs !== null) {
      const totalHours = Math.floor(diffMs / (60 * 60 * 1000));
      countdownLabel = `Notice Sent · ${Math.floor(totalHours / 24)}d ${totalHours % 24}h left`;
    }

    const badgeTone = isOverdue
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : isUrgent
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : "border-emerald-200 bg-emerald-50 text-emerald-700";
    return (
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${badgeTone}`}>
          {!isOverdue && !isUrgent ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : null}
          {countdownLabel}
        </span>
        <span className="text-xs text-slate-500">Due {formatDate(application.waitlistOfferExpiresAt)}</span>
      </div>
    );
  }

  if (application.waitlistOfferStatus === "EXPIRED") {
    return (
      <span className="mt-1 inline-flex w-fit items-center rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
        Offer Expired · Re-queued
      </span>
    );
  }

  return (
    <span className="mt-1 inline-flex w-fit items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
      Waiting in Queue
    </span>
  );
}

function hasActiveOffer(application: SkeapWaitlistApplication) {
  return (
    application.waitlistOfferStatus === "OFFERED" &&
    application.waitlistOfferExpiresAt !== null
  );
}

function getPromotionOfferGuidance(application: SkeapWaitlistApplication) {
  const expiresAt = application.waitlistOfferExpiresAt
    ? new Date(application.waitlistOfferExpiresAt)
    : null;
  if (application.waitlistOfferStatus === "OFFERED" && expiresAt) {
    if (expiresAt.getTime() <= Date.now()) {
      return `Notice deadline passed on ${formatDate(expiresAt.toISOString())}. The slot remains held until an SK Official decides how to proceed.`;
    }
    const offeredAt = application.waitlistOfferedAt
      ? new Date(application.waitlistOfferedAt)
      : null;
    const durationDays = offeredAt
      ? Math.max(1, Math.round((expiresAt.getTime() - offeredAt.getTime()) / (24 * 60 * 60 * 1000)))
      : 7;
    return `Active ${durationDays}-day slot offer expires ${formatDate(expiresAt.toISOString())}.`;
  }
  return "This applicant is being verified on-site without an active slot offer.";
}

type UpdatedWaitlistOffer = {
  waitlistOfferStatus: "OFFERED";
  waitlistOfferedAt: string;
  waitlistOfferExpiresAt: string;
  waitlistOfferMessage: string;
};

function isUpdatedWaitlistOffer(value: unknown): value is UpdatedWaitlistOffer {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const offer = value as Record<string, unknown>;
  return (
    offer.waitlistOfferStatus === "OFFERED" &&
    typeof offer.waitlistOfferedAt === "string" &&
    typeof offer.waitlistOfferExpiresAt === "string" &&
    typeof offer.waitlistOfferMessage === "string"
  );
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

export default function SkeapWaitlistClient({
  initialData,
  ageOutRemovedCount = 0,
}: {
  initialData: SkeapWaitlistSnapshot;
  ageOutRemovedCount?: number;
}) {
  const router = useRouter();
  const waitlistRefreshSequenceRef = useRef(0);
  const actionMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [countdownNow, setCountdownNow] = useState<number | null>(null);
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
  const [offerApplicant, setOfferApplicant] = useState<SkeapWaitlistApplication | null>(null);
  const [offerDeadline, setOfferDeadline] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [isCustomMessage, setIsCustomMessage] = useState(false);
  const displayedOfferMessage = offerApplicant && offerDeadline && !isCustomMessage
    ? getDefaultOfferMessage(offerApplicant, offerDeadline)
    : offerMessage;
  const [sendingOffer, setSendingOffer] = useState(false);
  const [openActionsMenuId, setOpenActionsMenuId] = useState<string | null>(null);
  const [actionsMenuPosition, setActionsMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [capacityWarning, setCapacityWarning] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isAgeOutBannerDismissed, setIsAgeOutBannerDismissed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [capacity, setCapacity] = useState<CapacityState>({
    activeCount: initialData.activeCount,
    maxSlots: initialData.maxSlots,
  });
  const [offeredCount, setOfferedCount] = useState(initialData.offeredCount);
  const [openSlotCount, setOpenSlotCount] = useState(initialData.openSlotCount);
  const [editingCapacity, setEditingCapacity] = useState(false);
  const [slotLimitDraft, setSlotLimitDraft] = useState(String(initialData.maxSlots));
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [isWaitlistClosed, setIsWaitlistClosed] = useState(initialData.isClosed);
  const [cycle, setCycle] = useState(initialData.cycle);
  const isCapacityExceeded = capacityWarning || capacity.activeCount >= capacity.maxSlots;
  const isPromotionBlockedByCapacity = selectedApplicant !== null && isCapacityExceeded;
  const isOverConfiguredCapacity = capacity.activeCount > capacity.maxSlots;
  const isOverHardCapacity = capacity.activeCount > DEFAULT_SKEAP_MAX_SLOTS;
  const remainingSlots = Math.max(0, capacity.maxSlots - capacity.activeCount);
  const isCapacityFull = capacity.activeCount >= capacity.maxSlots && offeredCount <= 0;
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
  const firstResult = filteredApplications.length === 0 ? 0 : firstVisibleIndex + 1;
  const lastResult = Math.min(currentPage * pageSize, filteredApplications.length);
  const visibleApplications = filteredApplications.slice(firstVisibleIndex, firstVisibleIndex + pageSize);

  const loadWaitlist = useCallback(async () => {
    const requestSequence = ++waitlistRefreshSequenceRef.current;
    setError(null);
    try {
      const response = await fetch("/api/admin/skeap-applications/waitlist", { cache: "no-store" });
      const body = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(body.error || "Unable to load the waitlist."));
      if (requestSequence !== waitlistRefreshSequenceRef.current) return;
      setApplications(Array.isArray(body.applications) ? body.applications as unknown as SkeapWaitlistApplication[] : []);
      const activeCount = typeof body.activeCount === "number" ? body.activeCount : 0;
      const maxSlots = typeof body.maxSlots === "number" ? body.maxSlots : 55;
      const offeredCount = typeof body.offeredCount === "number" ? body.offeredCount : 0;
      const openSlotCount = typeof body.openSlotCount === "number" ? body.openSlotCount : 0;
      setIsWaitlistClosed(body.isClosed === true);
      if (typeof body.cycle === "string") setCycle(body.cycle);
      setCapacity({ activeCount, maxSlots });
      setOfferedCount(offeredCount);
      setOpenSlotCount(openSlotCount);
      setCapacityWarning(false);
      if (!editingCapacity) setSlotLimitDraft(String(maxSlots));
    } catch (loadError) {
      if (requestSequence !== waitlistRefreshSequenceRef.current) return;
      setError(loadError instanceof Error ? loadError.message : "Unable to load the waitlist.");
    }
  }, [editingCapacity]);

  useEffect(() => {
    const updateCountdown = () => setCountdownNow(Date.now());
    updateCountdown();
    const interval = window.setInterval(updateCountdown, 60_000);
    return () => window.clearInterval(interval);
  }, []);

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
    if (!openActionsMenuId) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return;
      if (
        actionMenuRef.current?.contains(event.target) ||
        actionMenuTriggerRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpenActionsMenuId(null);
      setActionsMenuPosition(null);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenActionsMenuId(null);
        setActionsMenuPosition(null);
      }
    };

    document.addEventListener("pointerdown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [openActionsMenuId]);

  useEffect(() => {
    if (!openActionsMenuId) return;

    const updateMenuPosition = () => {
      const trigger = actionMenuTriggerRef.current;
      const menu = actionMenuRef.current;
      if (!trigger || !menu) return;

      const triggerRect = trigger.getBoundingClientRect();
      const menuRect = menu.getBoundingClientRect();
      const margin = 8;
      const left = Math.max(
        margin,
        Math.min(triggerRect.right - menuRect.width, window.innerWidth - menuRect.width - margin),
      );
      const fitsBelow = triggerRect.bottom + menuRect.height + margin <= window.innerHeight;
      const top = fitsBelow
        ? triggerRect.bottom + 4
        : Math.max(margin, triggerRect.top - menuRect.height - 4);

      setActionsMenuPosition({ top, left });
    };

    updateMenuPosition();
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);
    return () => {
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [openActionsMenuId]);

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

  function openOfferModal(application: SkeapWaitlistApplication) {
    const hasOffer = hasActiveOffer(application);
    const deadlineIsFuture = application.waitlistOfferExpiresAt !== null &&
      countdownNow !== null &&
      new Date(application.waitlistOfferExpiresAt).getTime() > countdownNow;
    const deadlineInput = hasOffer && deadlineIsFuture && application.waitlistOfferExpiresAt
      ? toManilaDateTimeInput(application.waitlistOfferExpiresAt)
      : getDefaultOfferDeadlineInput();
    setOfferApplicant(application);
    setOfferDeadline(deadlineInput);
    setOfferMessage(getDefaultOfferMessage(application, deadlineInput));
    setIsCustomMessage(false);
    setActionError(null);
  }

  function toggleActionsMenu(
    applicationId: string,
    trigger: HTMLButtonElement,
  ) {
    if (openActionsMenuId === applicationId) {
      setOpenActionsMenuId(null);
      setActionsMenuPosition(null);
      return;
    }

    actionMenuTriggerRef.current = trigger;
    setActionsMenuPosition(null);
    setOpenActionsMenuId(applicationId);
  }

  function closeActionsMenu() {
    setOpenActionsMenuId(null);
    setActionsMenuPosition(null);
  }

  function renderActionsTrigger(application: SkeapWaitlistApplication) {
    const isOpen = openActionsMenuId === application.id;
    return (
      <button
        type="button"
        onClick={(event) => toggleActionsMenu(application.id, event.currentTarget)}
        aria-label="Applicant actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? `waitlist-actions-${application.id}` : undefined}
        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/15 ${
          isOpen ? "bg-slate-100 text-slate-900" : ""
        }`}
      >
        <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
      </button>
    );
  }

  async function sendOffer() {
    if (!offerApplicant || !offerDeadline) return;
    const messageToSend = isCustomMessage
      ? offerMessage
      : getDefaultOfferMessage(offerApplicant, offerDeadline);
    setSendingOffer(true);
    setActionError(null);
    setToastMessage(null);
    try {
      const response = await fetch(`/api/admin/skeap-applications/waitlist/${offerApplicant.id}/offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deadline: manilaDateTimeInputToIso(offerDeadline),
          message: messageToSend,
        }),
      });
      const body = await readJsonResponse(response);
      if (!response.ok) throw new Error(String(body.error || "Unable to send the notice."));
      const updatedOffer = body.application;
      if (!isUpdatedWaitlistOffer(updatedOffer)) {
        throw new Error("The notice was sent, but the updated waitlist status was incomplete.");
      }
      const offeredApplicant = offerApplicant;
      const applicantName = offeredApplicant.applicantName;
      const wasAlreadyOffered = hasActiveOffer(offeredApplicant);
      setApplications((current) => current.map((application) =>
        application.id === offeredApplicant.id
          ? {
              ...application,
              waitlistOfferStatus: updatedOffer.waitlistOfferStatus,
              waitlistOfferedAt: updatedOffer.waitlistOfferedAt,
              waitlistOfferExpiresAt: updatedOffer.waitlistOfferExpiresAt,
              waitlistOfferMessage: updatedOffer.waitlistOfferMessage,
            }
          : application
      ));
      if (!wasAlreadyOffered) {
        setOfferedCount((count) => count + 1);
        setOpenSlotCount((count) => Math.max(0, count - 1));
      }
      setOfferApplicant(null);
      await loadWaitlist();
      const warnings = [
        typeof body.emailError === "string" ? body.emailError : null,
        body.emailSkipped === true
          ? "The offer and in-app notification were recorded, but no email address is on file."
          : null,
        typeof body.viewRefreshError === "string" ? body.viewRefreshError : null,
      ].filter((warning): warning is string => warning !== null);
      if (warnings.length > 0) {
        setActionError(warnings.join(" "));
      } else {
        setToastMessage(`${applicantName} was sent a SKEAP slot notice.`);
      }
      router.refresh();
    } catch (offerError) {
      setActionError(offerError instanceof Error ? offerError.message : "Unable to send the notice.");
    } finally {
      setSendingOffer(false);
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
      waitlistRefreshSequenceRef.current += 1;
      setApplications((current) =>
        current
          .filter((entry) => entry.id !== application.id)
          .map((entry, index) => ({ ...entry, waitlistPosition: index + 1 })),
      );
      if (
        typeof body.activeCount === "number" &&
        typeof body.maxSlots === "number" &&
        typeof body.offeredCount === "number" &&
        typeof body.openSlotCount === "number"
      ) {
        setCapacity({ activeCount: body.activeCount, maxSlots: body.maxSlots });
        setOfferedCount(body.offeredCount);
        setOpenSlotCount(body.openSlotCount);
        setCapacityWarning(false);
      }
      closePromotionModal();
      setToastMessage(`${application.applicantName} was promoted to Grantee.`);
      router.refresh();
      void loadWaitlist();
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
            Applicants are ordered by the time they joined the queue for the current cycle. Applicants who exceed the age limit are automatically removed and notified.
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:items-end">
          {isWaitlistClosed ? (
            <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600 sm:self-end">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              {cycle} cycle finalized
            </span>
          ) : null}
          <div
            className={`group relative flex flex-wrap items-center justify-between gap-4 rounded-2xl border px-4 py-2.5 shadow-sm transition-colors hover:shadow-md ${isOverConfiguredCapacity ? "border-rose-200 bg-rose-50 hover:border-rose-300" : "border-slate-200/80 bg-white hover:border-cyan-300"}`}
          >
            <div className="flex flex-wrap items-center gap-3">
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
              {isCapacityFull ? (
                <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                  Full
                </span>
              ) : null}
              <span className="inline-flex whitespace-nowrap rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold text-slate-600">
                {offeredCount} Offered · {openSlotCount} Open
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
      {ageOutRemovedCount > 0 && !isAgeOutBannerDismissed ? (
        <div role="status" className="flex items-start justify-between gap-3 rounded-xl border border-cyan-100 bg-cyan-50/70 px-4 py-3 text-sm text-cyan-900">
          <div className="flex items-start gap-2.5">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700" aria-hidden="true" />
            <p>
              {ageOutRemovedCount} waitlisted applicant{ageOutRemovedCount === 1 ? "" : "s"} exceeded the maximum eligible age and were automatically notified and removed.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAgeOutBannerDismissed(true)}
            aria-label="Dismiss age-out notice"
            className="shrink-0 rounded-md p-1 text-cyan-700 transition hover:bg-cyan-100 hover:text-cyan-950"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
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
        <div className="flex flex-col items-center justify-between gap-4 border-b border-slate-100 bg-slate-50/50 p-4 sm:flex-row sm:pr-6">
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
                      <OfferStatusBadge application={application} now={countdownNow} />
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs">
                    <p className="truncate font-semibold text-slate-800">{normalizeSkeapSchoolName(application.school)}</p>
                    <p className="mt-0.5 break-words text-slate-500">
                      {[
                      `${application.age ?? "—"} yrs`,
                        application.educationLevel,
                        application.currentCourse === "N/A" ? undefined : application.currentCourse,
                        application.yearLevel,
                      ].filter(Boolean).join(" · ") || "Program details unavailable"}
                    </p>
                    <p className="mt-1 text-slate-500">Submitted: {formatDate(application.submittedAt)}</p>
                  </div>

                  <div className="flex items-center justify-end border-t border-slate-100 pt-3">
                    {renderActionsTrigger(application)}
                  </div>
                </article>
              ))}
            </div>

            <div className="hidden w-full overflow-x-auto whitespace-nowrap md:block">
            <table className="w-full border-collapse whitespace-nowrap text-left text-sm">
              <thead className="bg-gradient-to-r from-slate-900 to-cyan-900">
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-widest text-cyan-50">
                  <th className="px-6 py-4 align-top">Position</th>
                  <th className="px-6 py-4 align-top">Applicant</th>
                  <th className="px-6 py-4 align-top">Program Details</th>
                  <th className="px-6 py-4 align-top">Submitted</th>
                  <th className="w-28 px-4 py-4 text-center align-top">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white text-sm">
                {visibleApplications.map((application) => (
                  <tr key={application.id} className="group align-top transition-colors hover:bg-slate-50/50">
                    <td className="px-6 py-4 align-top">
                      <span className="text-lg font-black text-slate-900">#{application.waitlistPosition ?? "-"}</span>
                    </td>
                    <td className="px-6 py-4 align-top">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{application.applicantName}</p>
                        <p className="truncate text-xs text-slate-500">
                          {application.emailAddress} · {application.contactNumber || "No phone number"}
                        </p>
                        <OfferStatusBadge application={application} now={countdownNow} />
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-slate-700">
                      <div className="flex flex-col gap-0.5">
                        <p>{normalizeSkeapSchoolName(application.school)}</p>
                        <p className="text-xs font-medium text-slate-500">
                          {[
                            `${application.age ?? "—"} yrs`,
                            application.educationLevel,
                            application.currentCourse === "N/A" ? undefined : application.currentCourse,
                            application.yearLevel,
                          ].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </td>
                    <td className="px-6 py-4 align-top text-slate-600">{formatDate(application.submittedAt)}</td>
                    <td className="w-28 px-4 py-4 text-center align-top">
                      <div className="relative inline-block">
                        {renderActionsTrigger(application)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 px-5 py-3.5">
          <div className="flex flex-wrap items-center gap-4">
            <p className="inline-flex h-8 items-center gap-1.5 text-xs text-slate-500 tabular-nums">
              {filteredApplications.length === 0 ? (
                <span>No records found</span>
              ) : (
                <>
                  <span>Showing</span>
                  <span className="font-semibold text-slate-900">{firstResult}–{lastResult}</span>
                  <span>of</span>
                  <span className="font-semibold text-slate-900">{filteredApplications.length.toLocaleString()}</span>
                </>
              )}
            </p>
            <label className="inline-flex h-8 items-center gap-2 border-l border-slate-200 pl-4">
              <span className="text-xs font-medium text-slate-500">Rows per page</span>
              <select
                aria-label="Rows per page"
                value={pageSize}
                onChange={(event) => {
                  setPageSize(Number(event.target.value));
                  setPage(1);
                }}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-400"
              >
                {ADMIN_TABLE_PAGE_SIZES.map((size) => <option key={size} value={size}>{size} rows</option>)}
              </select>
            </label>
          </div>
          <AdminPaginationControls
            page={currentPage}
            totalPages={totalPages}
            onPageChange={setPage}
            disabled={filteredApplications.length === 0}
          />
        </div>
      </section>

      {openActionsMenuId && typeof document !== "undefined"
        ? (() => {
            const application = applications.find((entry) => entry.id === openActionsMenuId);
            if (!application) return null;
            const offered = hasActiveOffer(application);
            return createPortal(
              <div
                ref={actionMenuRef}
                id={`waitlist-actions-${application.id}`}
                role="menu"
                aria-label={`${application.applicantName} actions`}
                className="fixed z-50 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
                style={{
                  top: actionsMenuPosition?.top ?? 0,
                  left: actionsMenuPosition?.left ?? 0,
                  visibility: actionsMenuPosition ? "visible" : "hidden",
                }}
              >
                {offered ? (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeActionsMenu();
                        openPromotionModal(application);
                      }}
                      disabled={isCapacityExceeded || promotingId !== null || waitlistActionId !== null}
                      title={isCapacityExceeded ? capacityTooltip : "Confirm physical CTCs and promote to Grantee"}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <UserCheck className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Promote to Grantee
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeActionsMenu();
                        openOfferModal(application);
                      }}
                      disabled={sendingOffer}
                      className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Mail className="h-4 w-4 shrink-0" aria-hidden="true" />
                      Send Updated Notice
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        closeActionsMenu();
                        openOfferModal(application);
                      }}
                      disabled={openSlotCount === 0 || sendingOffer || isWaitlistClosed}
                      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed ${
                        openSlotCount === 0 || isWaitlistClosed
                          ? "text-slate-400"
                          : "text-cyan-800 hover:bg-cyan-50"
                      }`}
                    >
                      <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>Send Notice</span>
                      {openSlotCount === 0 ? (
                        <span className="ml-auto text-[10px] text-slate-400">No open slots</span>
                      ) : null}
                    </button>
                    <div className="my-1 border-t border-slate-100" />
                  </>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    closeActionsMenu();
                    setPendingRemoval(application);
                  }}
                  disabled={waitlistActionId !== null}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  Remove from Waitlist
                </button>
              </div>,
              document.body,
            );
          })()
        : null}

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
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                    {getPromotionOfferGuidance(selectedApplicant)}
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
                    Promote to Grantee?
                  </h3>
                  <p className="px-2 text-[13px] leading-snug text-slate-500">
                    You&apos;re promoting <span className="font-bold text-slate-900">{selectedApplicant.applicantName}</span>. This uses <span className="font-bold text-slate-900">1 slot</span> and sends an automated email.
                  </p>
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-medium text-slate-600">
                    {getPromotionOfferGuidance(selectedApplicant)}
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

      {offerApplicant ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            aria-label="Close offer slot dialog"
            onClick={() => {
              if (!sendingOffer) setOfferApplicant(null);
            }}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="offer-slot-title"
            className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-start justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="offer-slot-title" className="text-base font-bold text-slate-900">
                  Send Slot Offer Notice
                </h2>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Review the deadline and customize the message before notifying this applicant.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOfferApplicant(null)}
                disabled={sendingOffer}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>
            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <dl className="grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Full Name</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">{offerApplicant.applicantName}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Queue Position</dt>
                  <dd className="mt-1 text-sm font-semibold text-slate-900">#{offerApplicant.waitlistPosition ?? "—"}</dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Email</dt>
                  <dd className="mt-1 break-all text-sm text-slate-700">{offerApplicant.emailAddress || "No email address on file"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Contact Number</dt>
                  <dd className="mt-1 text-sm text-slate-700">{offerApplicant.contactNumber || "No contact number on file"}</dd>
                </div>
              </dl>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Compliance Deadline <span className="text-xs font-medium text-slate-500">(Philippine Time)</span></span>
                <input
                  type="datetime-local"
                  value={offerDeadline}
                  onChange={(event) => {
                    const value = event.target.value;
                    setOfferDeadline(value);
                  }}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  required
                />
                <span className="mt-1 block text-xs text-slate-500">The deadline is stored and sent using Asia/Manila time.</span>
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-800">Notification Message</span>
                <textarea
                  value={displayedOfferMessage}
                  onChange={(event) => {
                    setOfferMessage(event.target.value);
                    setIsCustomMessage(true);
                  }}
                  rows={8}
                  maxLength={5000}
                  className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-100"
                  required
                />
                <span className="mt-1 block text-right text-xs text-slate-400">{displayedOfferMessage.length}/5000</span>
              </label>
            </div>
            <footer className="flex justify-end gap-2 border-t border-slate-100 bg-slate-50 px-5 py-4">
              <button
                type="button"
                onClick={() => setOfferApplicant(null)}
                disabled={sendingOffer}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void sendOffer()}
                disabled={sendingOffer || !offerDeadline || !displayedOfferMessage.trim()}
                className="inline-flex items-center gap-2 rounded-lg bg-cyan-800 px-3 py-2 text-xs font-semibold text-white transition hover:bg-cyan-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sendingOffer ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Send className="h-3.5 w-3.5" aria-hidden="true" />}
                {sendingOffer ? "Sending Notice..." : "Send Notice"}
              </button>
            </footer>
          </section>
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