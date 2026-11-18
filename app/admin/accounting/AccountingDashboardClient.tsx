"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, Wallet, Search, SearchX, Inbox, Download, LoaderCircle, ChevronDown, RefreshCw, X } from "lucide-react";
import type { AccountingTermOption } from "@/lib/accounting-term";
import { formatDate } from "@/lib/utils";
import {
  type AccountingSubmissionState,
  getAccountingSubmissionState,
} from "@/lib/accounting-submission";
import { matchesAccountingNameQuery } from "@/lib/accounting-name-search";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { createBrowserClient } from "@/lib/supabase/browser";
import { ADMIN_TABLE_PAGE_SIZES } from "@/lib/admin-pagination";
import AdminPaginationControls from "../AdminPaginationControls";
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
  email: string | null;
  accountName: string | null;
  semester: string;
  status: "Pending Payout" | "Awaiting Confirmation" | "Confirmed";
  submissionStatus: AccountingSubmissionState;
  submissionState: AccountingSubmissionState;
  claimedAt?: string | null;
  disbursedAt?: string | null;
  disbursementEmailSentAt?: string | null;
};

const GRANT_AMOUNT = 5000; // PHP per student

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function SubmissionStatusBadge({
  state,
  compact = false,
}: {
  state: AccountingSubmissionState;
  compact?: boolean;
}) {
  const classes: Record<AccountingSubmissionState, string> = {
    Approved: "bg-emerald-50 text-emerald-700",
    "For Physical CTC": "bg-amber-50 text-amber-800",
    "Pending Review": "bg-sky-50 text-sky-700",
    Returned: "bg-rose-50 text-rose-700",
    "Not submitted": "bg-slate-100 text-slate-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full ${compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1 text-xs"} font-semibold ${classes[state]}`}>
      {state}
    </span>
  );
}

export default function AdminAccountingClient() {
  const [grantees, setGrantees] = useState<Grantee[]>([]);
  const [totalBudget, setTotalBudget] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [recentSemesters, setRecentSemesters] = useState<AccountingTermOption[]>([]);
  const [selectedSemester, setSelectedSemester] = useState("");

  const claimedCount = useMemo(
    () => grantees.filter((g) => g.status !== "Pending Payout").length,
    [grantees],
  );

  const remainingBudget = useMemo(() => (totalBudget ?? 0) - claimedCount * GRANT_AMOUNT, [totalBudget, claimedCount]);

  const [loading, setLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [recentlyConfirmedIds, setRecentlyConfirmedIds] = useState<Set<string>>(new Set());
  const [confirmedPayoutToast, setConfirmedPayoutToast] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const savedTimeoutRef = useRef<number | null>(null);
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [processingIds, setProcessingIds] = useState<Record<string, boolean>>({});
  const [disbursementCandidate, setDisbursementCandidate] = useState<Grantee | null>(null);
  const isEditingBudgetRef = useRef(false);
  const isBudgetDirtyRef = useRef(false);
  const savedTotalBudgetRef = useRef<number | null>(null);
  const isSavingBudgetRef = useRef(false);
  const disbursementDialogOpenRef = useRef(false);
  const deferredAccountingRefreshRef = useRef(false);
  const accountingRequestVersionRef = useRef(0);
  const accountingFetchControllerRef = useRef<AbortController | null>(null);
  const previousPayoutStatusesRef = useRef<Map<string, Grantee["status"]> | null>(null);
  const highlightedRowTimersRef = useRef(new Map<string, number>());
  const confirmedToastTimerRef = useRef<number | null>(null);
  const liveRefreshDebounceRef = useRef<number | null>(null);
  const disbursementDialogRef = useRef<HTMLElement>(null);
  const cancelDisbursementButtonRef = useRef<HTMLButtonElement>(null);
  const disbursementTriggerRef = useRef<HTMLInputElement | null>(null);
  const restoreDisbursementFocusRef = useRef(true);
  const accountingHeadingRef = useRef<HTMLHeadingElement>(null);
  const closeDisbursementDialog = useCallback(() => {
    disbursementDialogOpenRef.current = false;
    setDisbursementCandidate(null);
  }, []);
  const formatter = useMemo(
    () =>
      new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        maximumFractionDigits: 0,
      }),
    []
  );

  useEffect(() => () => {
    if (savedTimeoutRef.current !== null) window.clearTimeout(savedTimeoutRef.current);
    if (confirmedToastTimerRef.current !== null) {
      window.clearTimeout(confirmedToastTimerRef.current);
    }
    for (const timer of highlightedRowTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadTermOptions() {
      try {
        const response = await fetch("/api/admin/accounting/terms", { cache: "no-store" });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok || !isRecord(payload)) {
          throw new Error(
            isRecord(payload) && typeof payload.error === "string"
              ? payload.error
              : "Unable to load accounting terms.",
          );
        }

        const terms = Array.isArray(payload.terms)
          ? payload.terms.flatMap((value): AccountingTermOption[] => {
              if (
                !isRecord(value) ||
                typeof value.name !== "string" ||
                typeof value.label !== "string" ||
                typeof value.isCurrent !== "boolean"
              ) return [];
              return [{ name: value.name, label: value.label, isCurrent: value.isCurrent }];
            })
          : [];
        const defaultSemester =
          typeof payload.defaultSemester === "string" ? payload.defaultSemester : "";
        if (!terms.length || !terms.some((term) => term.name === defaultSemester)) {
          throw new Error("No valid accounting term is available.");
        }
        if (!mounted) return;
        setRecentSemesters(terms);
        setSelectedSemester((current) => current || defaultSemester);
      } catch (error) {
        if (!mounted) return;
        setLoadError(error instanceof Error ? error.message : "Unable to load accounting terms.");
        setLoading(false);
      }
    }

    void loadTermOptions();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!disbursementCandidate) {
      if (restoreDisbursementFocusRef.current) {
        disbursementTriggerRef.current?.focus();
      } else {
        accountingHeadingRef.current?.focus();
      }
      disbursementTriggerRef.current = null;
      restoreDisbursementFocusRef.current = true;
      return;
    }

    cancelDisbursementButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeDisbursementDialog();
        return;
      }
      if (event.key !== "Tab") return;

      const focusableElements = disbursementDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusableElements?.length) return;
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [closeDisbursementDialog, disbursementCandidate]);

  useEffect(() => {
    if (!isExportMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !exportMenuRef.current?.contains(event.target)) {
        setIsExportMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsExportMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isExportMenuOpen]);

  const filtered = useMemo(() => {
    return grantees.filter((grantee) =>
      matchesAccountingNameQuery(query, [
        grantee.name,
        grantee.email ?? "",
        grantee.accountName ?? "",
      ]),
    );
  }, [grantees, query]);

  const submissionCounts = useMemo(() => {
    const submitted = filtered.filter((grantee) => grantee.submissionStatus !== "Not submitted").length;
    return {
      all: filtered.length,
      submitted,
      notSubmitted: filtered.length - submitted,
    };
  }, [filtered]);

  const [submissionFilter, setSubmissionFilter] = useState<'all'|'submitted'|'not_submitted'>('all');
  const [claimedFilter, setClaimedFilter] = useState<'all'|'pending'|'received'>('all');

  const filteredWithSubmission = useMemo(() => {
    let list = filtered;
    if (submissionFilter === 'submitted') {
      list = list.filter((g) => g.submissionStatus !== "Not submitted");
    }
    if (submissionFilter === 'not_submitted') {
      list = list.filter((g) => g.submissionStatus === "Not submitted");
    }
    if (claimedFilter === 'received') list = list.filter((g) => g.status !== "Pending Payout");
    if (claimedFilter === 'pending') list = list.filter((g) => g.status === "Pending Payout");
    return list;
  }, [filtered, submissionFilter, claimedFilter]);
  const hasActiveFilters =
    query.trim().length > 0 || submissionFilter !== "all" || claimedFilter !== "all";

  // Pagination
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [rowsPerPage, setRowsPerPage] = useState<number>(10);
  const totalPages = Math.max(1, Math.ceil(filteredWithSubmission.length / rowsPerPage));
  const displayPage = Math.min(currentPage, totalPages);

  const pagedRows = useMemo(() => {
    const start = (displayPage - 1) * rowsPerPage;
    return filteredWithSubmission.slice(start, start + rowsPerPage);
  }, [filteredWithSubmission, displayPage, rowsPerPage]);

  const fetchAccountingSnapshot = useCallback(async (showLoading: boolean) => {
    if (!selectedSemester) return;
    if (showLoading) previousPayoutStatusesRef.current = null;
    if (
      !showLoading &&
      (isEditingBudgetRef.current || isSavingBudgetRef.current || disbursementDialogOpenRef.current)
    ) {
      deferredAccountingRefreshRef.current = true;
      return;
    }

    const requestVersion = ++accountingRequestVersionRef.current;
    accountingFetchControllerRef.current?.abort();
    const controller = new AbortController();
    accountingFetchControllerRef.current = controller;
    if (showLoading) {
      setLoading(true);
      setIsRevalidating(false);
    } else {
      setIsRevalidating(true);
    }
    setLoadError(null);

    try {
      const cleanedSemester = String(selectedSemester).replace(/\s*\(Current\)$/i, "").trim();
      const encoded = encodeURIComponent(cleanedSemester);
      const fetchOptions = { cache: "no-store" as const, signal: controller.signal };
      const [granteesResponse, budgetResponse] = await Promise.all([
        fetch(`/api/grantees?semester=${encoded}`, fetchOptions),
        fetch(`/api/budget?semester=${encoded}`, fetchOptions),
      ]);

      if (!granteesResponse.ok) throw new Error("Failed to load grantees");
      if (!budgetResponse.ok) throw new Error("Failed to load settings");

      const granteeData: unknown = await granteesResponse.json();
      const budgetData: unknown = await budgetResponse.json();
      if (requestVersion !== accountingRequestVersionRef.current || controller.signal.aborted) return;
      if (
        !showLoading &&
        (isEditingBudgetRef.current || isSavingBudgetRef.current || disbursementDialogOpenRef.current)
      ) {
        deferredAccountingRefreshRef.current = true;
        return;
      }

      const list = isRecord(granteeData) && Array.isArray(granteeData.grantees)
        ? granteeData.grantees
        : [];
      const mappedGrantees = list.flatMap((value): Grantee[] => {
        if (!isRecord(value) || typeof value.id !== "string") return [];

        const payoutStatus = typeof value.payoutStatus === "string" ? value.payoutStatus : "";
        const isConfirmed = payoutStatus === "CONFIRMED";
        const isDisbursed =
          isConfirmed ||
          payoutStatus === "DISBURSED_UNCONFIRMED" ||
          value.claimed === true;
        const submissionStatus = getAccountingSubmissionState(
          typeof value.submissionStatus === "string" ? value.submissionStatus : null,
        );

        return [{
          id: value.id,
          name: typeof value.student_name === "string" ? value.student_name : "Unknown",
          email: typeof value.email === "string" ? value.email : null,
          accountName: typeof value.accountName === "string" ? value.accountName : null,
          semester: typeof value.semester === "string" ? value.semester : selectedSemester,
          status: isConfirmed
            ? "Confirmed"
            : isDisbursed
              ? "Awaiting Confirmation"
              : "Pending Payout",
          submissionStatus,
          submissionState: submissionStatus,
          claimedAt: typeof value.claimedAt === "string" ? value.claimedAt : null,
          disbursedAt: typeof value.disbursedAt === "string" ? value.disbursedAt : null,
          disbursementEmailSentAt:
            typeof value.disbursementEmailSentAt === "string"
              ? value.disbursementEmailSentAt
              : null,
        }];
      });

      const previousStatuses = previousPayoutStatusesRef.current;
      const confirmedGrantees = previousStatuses
        ? mappedGrantees.filter((grantee) =>
            previousStatuses.get(grantee.id) === "Awaiting Confirmation" &&
            grantee.status === "Confirmed"
          )
        : [];
      previousPayoutStatusesRef.current = new Map(
        mappedGrantees.map((grantee) => [grantee.id, grantee.status]),
      );
      setGrantees(mappedGrantees);

      if (isRecord(budgetData) && typeof budgetData.totalBudget !== "undefined") {
        const freshBudget =
          typeof budgetData.totalBudget === "number"
            ? budgetData.totalBudget
            : Number(budgetData.totalBudget ?? 0);
        if (showLoading || !isBudgetDirtyRef.current) {
          setTotalBudget(freshBudget);
          savedTotalBudgetRef.current = freshBudget;
          if (showLoading) isBudgetDirtyRef.current = false;
        }
      }

      for (const grantee of confirmedGrantees) {
        const previousTimer = highlightedRowTimersRef.current.get(grantee.id);
        if (previousTimer !== undefined) window.clearTimeout(previousTimer);
        setRecentlyConfirmedIds((current) => new Set(current).add(grantee.id));
        highlightedRowTimersRef.current.set(
          grantee.id,
          window.setTimeout(() => {
            setRecentlyConfirmedIds((current) => {
              const next = new Set(current);
              next.delete(grantee.id);
              return next;
            });
            highlightedRowTimersRef.current.delete(grantee.id);
          }, 3000),
        );
      }

      if (confirmedGrantees.length > 0) {
        if (confirmedToastTimerRef.current !== null) {
          window.clearTimeout(confirmedToastTimerRef.current);
        }
        setConfirmedPayoutToast(
          `${confirmedGrantees[0].name} confirmed payout receipt`,
        );
        confirmedToastTimerRef.current = window.setTimeout(() => {
          setConfirmedPayoutToast(null);
          confirmedToastTimerRef.current = null;
        }, 5000);
      }
    } catch (error) {
      if (requestVersion === accountingRequestVersionRef.current && !controller.signal.aborted) {
        setLoadError(error instanceof Error ? error.message : "Unable to refresh accounting data.");
        if (showLoading) setGrantees([]);
      }
    } finally {
      if (requestVersion === accountingRequestVersionRef.current) {
        if (showLoading) setLoading(false);
        setIsRevalidating(false);
        if (accountingFetchControllerRef.current === controller) {
          accountingFetchControllerRef.current = null;
        }
      }
    }
  }, [selectedSemester]);

  useEffect(() => {
    async function loadAccountingSnapshot() {
      await fetchAccountingSnapshot(true);
    }

    void loadAccountingSnapshot();
    return () => {
      accountingRequestVersionRef.current += 1;
      accountingFetchControllerRef.current?.abort();
    };
  }, [fetchAccountingSnapshot]);

  useEffect(() => {
    if (
      isEditingBudget ||
      isSaving ||
      disbursementCandidate ||
      !deferredAccountingRefreshRef.current
    ) return;
    deferredAccountingRefreshRef.current = false;
    void fetchAccountingSnapshot(false);
  }, [disbursementCandidate, fetchAccountingSnapshot, isEditingBudget, isSaving]);

  useEffect(() => {
    const refreshImmediately = () => {
      if (document.visibilityState !== "visible") return;
      if (liveRefreshDebounceRef.current !== null) {
        window.clearTimeout(liveRefreshDebounceRef.current);
        liveRefreshDebounceRef.current = null;
      }
      void fetchAccountingSnapshot(false);
    };
    const scheduleDebouncedRefresh = () => {
      if (document.visibilityState !== "visible") return;
      if (
        isEditingBudgetRef.current ||
        isSavingBudgetRef.current ||
        disbursementDialogOpenRef.current
      ) {
        deferredAccountingRefreshRef.current = true;
        return;
      }
      if (liveRefreshDebounceRef.current !== null) {
        window.clearTimeout(liveRefreshDebounceRef.current);
      }
      liveRefreshDebounceRef.current = window.setTimeout(() => {
        liveRefreshDebounceRef.current = null;
        void fetchAccountingSnapshot(false);
      }, 500);
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") refreshImmediately();
    };
    const interval = window.setInterval(refreshWhenVisible, 10000);
    window.addEventListener("focus", refreshImmediately);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    let realtimeClient: ReturnType<typeof createBrowserClient> | null = null;
    let realtimeChannel: ReturnType<ReturnType<typeof createBrowserClient>["channel"]> | null = null;
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      realtimeClient = createBrowserClient();
      realtimeChannel = realtimeClient
        .channel("admin-accounting-live")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "accounting_payouts" },
          scheduleDebouncedRefresh,
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "submissions" },
          scheduleDebouncedRefresh,
        )
        .subscribe();
    }

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshImmediately);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      if (liveRefreshDebounceRef.current !== null) {
        window.clearTimeout(liveRefreshDebounceRef.current);
        liveRefreshDebounceRef.current = null;
      }
      if (realtimeClient && realtimeChannel) {
        void realtimeClient.removeChannel(realtimeChannel);
      }
    };
  }, [fetchAccountingSnapshot]);

  async function handleSaveBudget() {
    if (isSaving) return;
    if (totalBudget == null) return setValidationError('Total budget is required');
    // Validate: must be greater than zero
    if (totalBudget <= 0) {
      const msg = 'Please enter a valid budget amount greater than zero.';
      setValidationError(msg);
      return;
    }

    isSavingBudgetRef.current = true;
    setIsSaving(true);
    setErrorMessage(null);
    setIsSaved(false);
    if (savedTimeoutRef.current !== null) window.clearTimeout(savedTimeoutRef.current);

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
      setErrorMessage(null);
      if (typeof data?.totalBudget === "number") {
        setTotalBudget(data.totalBudget);
        savedTotalBudgetRef.current = data.totalBudget;
        isBudgetDirtyRef.current = false;
      }
      setIsSaved(true);
      savedTimeoutRef.current = window.setTimeout(() => setIsSaved(false), 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : String(err));
    } finally {
      isSavingBudgetRef.current = false;
      setIsSaving(false);
    }
  }

  async function handleExportReport(
    reportLabel: string,
    reportType: "current_view" | "master_payroll" | "pending_payouts" | "received_payouts",
  ) {
    if (isExporting) return;

    const currentSemester = String(selectedSemester ?? "")
      .replace(/\s*\(Current\)$/i, "")
      .trim();
    setIsExporting(true);
    setErrorMessage(null);

    try {
      const params = new URLSearchParams({ semesterId: currentSemester, reportType });
      if (reportType === "current_view") {
        if (query.trim()) params.set("search", query.trim());
        if (submissionFilter !== "all") params.set("submissionStatus", submissionFilter);
        if (claimedFilter !== "all") {
          params.set("payoutStatus", claimedFilter === "received" ? "received" : "pending");
        }
      } else if (reportType === "pending_payouts") {
        params.set("payoutStatus", "pending");
      } else if (reportType === "received_payouts") {
        params.set("payoutStatus", "received");
      }

      const response = await fetch(`/api/admin/accounting/export?${params.toString()}`, {
        credentials: "same-origin",
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || `Unable to export ${reportLabel.toLowerCase()}.`);
      }

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition");
      const filename = disposition?.match(/filename="([^"]+)"/i)?.[1]
        ?? `SKEAP-PAYROLL-${currentSemester.replace(/[<>:"/\\|?*]/g, "_")}.xlsx`;
      link.href = objectUrl;
      link.download = filename;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(objectUrl), 1000);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export payroll.");
    } finally {
      setIsExporting(false);
    }
  }

  async function dispatchPayoutToGrantee(id: string, retryEmail = false) {
    if (processingIds[id]) return;
    const current = grantees.find((grantee) => grantee.id === id);
    if (
      !current ||
      (current.status !== "Pending Payout" &&
        !(retryEmail && current.status === "Awaiting Confirmation" && !current.disbursementEmailSentAt))
    ) return;

    setProcessingIds((p) => ({ ...p, [id]: true }));

    const prev = grantees;
    const prevBudget = totalBudget;
    const optimisticDisbursedAt = new Date().toISOString();
    if (current.status === "Pending Payout") {
      setGrantees((cur) => cur.map((grantee) => (
        grantee.id === id
          ? { ...grantee, status: "Awaiting Confirmation", disbursedAt: optimisticDisbursedAt }
          : grantee
      )));
    }

    try {
      const cleanedSemester = String(selectedSemester ?? "").replace(/\s*\(Current\)$/i, "").trim();
      const res = await fetch(`/api/grantees/${encodeURIComponent(id)}/payout`, {
        method: "PATCH",
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ semester: cleanedSemester, claimed: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error || "Failed to disburse payout.");
      if (body?.emailStatus === "failed") {
        setErrorMessage(`Payout disbursed, but the notification email failed: ${body.emailError}`);
      } else if (body?.emailStatus === "sent") {
        setGrantees((cur) => cur.map((grantee) => (
          grantee.id === id
            ? { ...grantee, disbursementEmailSentAt: new Date().toISOString() }
            : grantee
        )));
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

  function requestPayoutDisbursement(grantee: Grantee, trigger: HTMLInputElement) {
    if (grantee.status !== "Pending Payout") return;
    disbursementDialogOpenRef.current = true;
    disbursementTriggerRef.current = trigger;
    restoreDisbursementFocusRef.current = true;
    setDisbursementCandidate(grantee);
  }

  function confirmPayoutDisbursement() {
    if (!disbursementCandidate) return;
    const granteeId = disbursementCandidate.id;
    restoreDisbursementFocusRef.current = false;
    closeDisbursementDialog();
    void dispatchPayoutToGrantee(granteeId);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-12 pt-8 sm:gap-8 sm:px-6">
      {loadError ? <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div> : null}
      {errorMessage ? <FloatingFeedback message={errorMessage} type="error" onDismiss={() => setErrorMessage(null)} /> : null}
      <div className="flex w-full flex-col justify-between gap-4 sm:flex-row sm:items-start sm:gap-6">
        <div>
          <h1 ref={accountingHeadingRef} tabIndex={-1} className="text-2xl font-semibold text-slate-900">Accounting • Cash Disbursements</h1>
          <p className="mt-1 text-sm text-slate-600">Track and mark offline cash payouts for grantees.</p>
        </div>

        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <div ref={exportMenuRef} className="relative w-full shrink-0 sm:w-auto">
            <button
              type="button"
              aria-expanded={isExportMenuOpen}
              aria-controls="accounting-export-menu"
              disabled={isExporting}
              onClick={() => setIsExportMenuOpen((open) => !open)}
              aria-busy={isExporting}
              className="flex w-full shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] disabled:cursor-wait disabled:opacity-70 sm:min-h-[38px] sm:w-auto sm:px-3 sm:py-2 sm:text-sm"
            >
              {isExporting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              <span>{isExporting ? "Exporting..." : "Export Payroll"}</span>
              <ChevronDown className={`h-4 w-4 text-slate-400 transition ${isExportMenuOpen && !isExporting ? "rotate-180" : ""} ${isExporting ? "invisible" : ""}`} />
            </button>
            {isExportMenuOpen ? <div id="accounting-export-menu" role="group" aria-label="Export reports" className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  setIsExportMenuOpen(false);
                  void handleExportReport("current view", "current_view");
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Export Current View
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  setIsExportMenuOpen(false);
                  void handleExportReport("master payroll", "master_payroll");
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Master Payroll (All)
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  setIsExportMenuOpen(false);
                  void handleExportReport("pending payouts report", "pending_payouts");
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Pending Payouts
              </button>
              <button
                type="button"
                disabled={isExporting}
                onClick={() => {
                  setIsExportMenuOpen(false);
                  void handleExportReport("disbursed payouts report", "received_payouts");
                }}
                className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Disbursed Payouts
              </button>
            </div> : null}
          </div>

          <div className="w-full shrink-0 sm:w-auto">
            <label className="sr-only">Semester</label>
            <select
              value={selectedSemester}
              disabled={!recentSemesters.length}
              onChange={(e) => {
                setSelectedSemester(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full min-w-[295px] rounded-2xl border border-slate-200 bg-white py-2 pl-3 pr-9 text-sm text-slate-700 outline-none shadow-sm focus:border-sky-400 sm:min-w-[320px]"
              aria-label="Filter by semester"
            >
              {!recentSemesters.length ? <option value="">Loading terms…</option> : null}
              {recentSemesters.map((semester) => (
                <option key={semester.name} value={semester.name}>
                  {semester.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
        {/* Top section - budget overview */}
        {loading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2" aria-busy="true" aria-label="Loading accounting summary">
            <div className="min-h-[168px] animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <div className="h-9 w-9 rounded-lg bg-slate-100" />
                <div className="h-4 w-28 rounded bg-slate-100" />
              </div>
              <div className="mt-4 h-3 w-32 rounded bg-slate-100" />
              <div className="mt-2 flex items-center gap-4">
                <div className="h-9 w-40 rounded-xl bg-slate-100" />
                <div className="h-4 w-28 rounded bg-slate-100" />
                <div className="ml-auto h-8 w-20 rounded-xl bg-slate-200" />
              </div>
            </div>
            <div className="min-h-[168px] animate-pulse rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="h-4 w-28 rounded bg-slate-100" />
              <div className="mt-4 flex items-center justify-between gap-4">
                <div>
                  <div className="h-10 w-36 rounded bg-slate-100" />
                  <div className="mt-2 h-3 w-44 rounded bg-slate-100" />
                </div>
                <div className="space-y-2">
                  <div className="h-3 w-28 rounded bg-slate-100" />
                  <div className="h-3 w-32 rounded bg-slate-100" />
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-700">
                <Wallet className="h-5 w-5" />
              </span>
              <div className="text-sm font-semibold">Total Budget</div>
            </div>

            <div className="mt-4">
              <label className="text-xs text-slate-500">Set total budget (PHP)</label>
              <div className="mt-3 flex w-full flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                <div className="flex flex-col">
                  <input
                    type="number"
                    step={GRANT_AMOUNT}
                    value={totalBudget !== null ? String(totalBudget) : ''}
                    onFocus={() => {
                      isEditingBudgetRef.current = true;
                      setIsEditingBudget(true);
                    }}
                    onBlur={() => {
                      isEditingBudgetRef.current = false;
                      setIsEditingBudget(false);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSaveBudget();
                      }
                    }}
                    onChange={(e) => {
                      const nextBudget = Number(e.target.value || 0);
                      isBudgetDirtyRef.current = nextBudget !== savedTotalBudgetRef.current;
                      setTotalBudget(nextBudget);
                      setValidationError(null);
                      setErrorMessage(null);
                    }}
                    className="w-full max-w-[240px] rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                    aria-label="Total budget"
                  />
                  {validationError ? <div className="mt-1 text-sm text-red-500">{validationError}</div> : null}
                </div>

                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:flex-1">
                  <div className="text-xs text-slate-600 sm:text-sm">Grant amount: <span className="font-semibold text-slate-900">{formatter.format(GRANT_AMOUNT)}</span></div>

                  <button
                    type="button"
                    onClick={handleSaveBudget}
                    disabled={isSaving}
                    aria-busy={isSaving}
                    className={`inline-flex min-h-10 min-w-[104px] shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white shadow-sm transition duration-150 active:scale-95 ${isSaved ? "bg-emerald-600 hover:bg-emerald-700" : "bg-slate-900 hover:bg-slate-800"} ${isSaving ? "cursor-wait opacity-80" : ""}`}
                  >
                    <span className="relative inline-flex w-full items-center justify-center">
                      {isSaving ? (
                        <>
                          <span className="absolute left-3 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                          <span className="opacity-90">Saving...</span>
                        </>
                      ) : isSaved ? (
                        <>
                          <Check className="h-4 w-4" aria-hidden="true" />
                          <span>Saved</span>
                        </>
                      ) : (
                        <span>Save</span>
                      )}
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="group relative w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
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
                <div className="mt-1">Disbursed: {claimedCount} • {formatter.format(claimedCount * GRANT_AMOUNT)}</div>
              </div>
            </div>
          </div>
        </div>
        )}

        {/* Middle section - search + semester filter */}
        <div className="mt-6 flex w-full flex-col gap-3">
          <div className="w-full min-w-0">
            <label className="sr-only">Search grantees</label>
            <div className="relative">
              <div className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="h-4 w-4" />
              </div>
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search name, email, or account name"
                className="w-full rounded-2xl border border-transparent bg-white px-4 py-3 pl-11 text-sm text-slate-900 outline-none shadow-md focus:border-sky-300 focus:ring-2 focus:ring-sky-50"
                aria-label="Search grantees by name, email, or account name"
              />
            </div>
          </div>

          <div className="w-full">
            <div className="flex flex-col gap-2 sm:hidden">
              <label>
                <span className="sr-only">Filter by submission status</span>
                <select
                  value={submissionFilter}
                  onChange={(event) => {
                    setSubmissionFilter(event.target.value as typeof submissionFilter);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="all">Submission status: All ({submissionCounts.all})</option>
                  <option value="submitted">Submitted ({submissionCounts.submitted})</option>
                  <option value="not_submitted">Not submitted ({submissionCounts.notSubmitted})</option>
                </select>
              </label>
              <label>
                <span className="sr-only">Filter by payout status</span>
                <select
                  value={claimedFilter}
                  onChange={(event) => {
                    setClaimedFilter(event.target.value as typeof claimedFilter);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
                >
                  <option value="all">Payout status: All</option>
                  <option value="pending">Pending</option>
                  <option value="received">Disbursed</option>
                </select>
              </label>
            </div>

            <div className="hidden flex-wrap items-center gap-3 sm:flex">
            <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-slate-100 bg-white p-1 shadow-sm">
              {[
                { label: "All", value: "all", count: submissionCounts.all },
                { label: "Submitted", value: "submitted", count: submissionCounts.submitted },
                { label: "Not submitted", value: "not_submitted", count: submissionCounts.notSubmitted },
              ].map(({ label, value, count }) => (
                <button
                  key={value}
                  onClick={() => {
                    setSubmissionFilter(value as typeof submissionFilter);
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-2 text-xs rounded-2xl font-medium transition ${submissionFilter === value ? 'bg-sky-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  style={{lineHeight: '1'}}
                >
                  {label} ({count})
                </button>
              ))}
            </div>

            <div className="inline-flex max-w-full flex-wrap items-center gap-1 rounded-full border border-slate-100 bg-white p-1 shadow-sm">
              {['All','Pending','Disbursed'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setClaimedFilter(tab === 'All' ? 'all' : tab === 'Disbursed' ? 'received' : 'pending');
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-2 text-xs rounded-2xl font-medium transition ${claimedFilter === (tab === 'All' ? 'all' : tab === 'Disbursed' ? 'received' : 'pending') ? 'bg-sky-900 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
                  style={{lineHeight: '1'}}
                >
                  {tab}
                </button>
              ))}
            </div>
            </div>
          </div>
        </div>

        {/* Bottom section - table */}
        <div className="mt-6">
            <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-4 px-2 py-2">
                <div className="text-sm font-semibold">Disbursement list</div>
                <div className="inline-flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" aria-hidden="true" />
                    Live sync
                  </span>
                  <button
                    type="button"
                    onClick={() => void fetchAccountingSnapshot(false)}
                    disabled={isRevalidating}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-wait disabled:opacity-60"
                    aria-label="Refresh accounting data"
                    title="Refresh now"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isRevalidating ? "animate-spin" : ""}`} aria-hidden="true" />
                  </button>
                </div>
              </div>

              <div className="w-full overflow-x-auto whitespace-nowrap">
                <div className="rounded-t-2xl overflow-hidden">
              {loading ? (
                <div className="p-6 text-sm text-slate-500">Loading grantees…</div>
              ) : (
                <>
                  <div className="flex flex-col gap-3 p-1 md:hidden">
                    {pagedRows.length > 0 ? pagedRows.map((g) => (
                      <article
                        key={g.id}
                        className={`flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 shadow-sm transition-colors duration-1000 ${recentlyConfirmedIds.has(g.id) ? "bg-emerald-50/70" : "bg-white"}`}
                      >
                        <div className="flex min-w-0 items-center gap-3 border-b border-slate-100 pb-3">
                          <label className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center">
                            <input
                              type="checkbox"
                              checked={g.status !== "Pending Payout"}
                              disabled={g.status !== "Pending Payout" || Boolean(processingIds[g.id])}
                              onChange={(event) => requestPayoutDisbursement(g, event.currentTarget)}
                              aria-label={g.status === "Pending Payout" ? `Disburse payout to ${g.name}` : `Payout for ${g.name} has been disbursed`}
                              aria-busy={processingIds[g.id] ? true : undefined}
                              className="h-4 w-4 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                          </label>
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                            {g.name.split(" ").map((namePart) => namePart[0]).slice(0, 2).join("").toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-xs font-bold uppercase text-slate-900">{g.name}</h3>
                            <p className={`truncate text-xs ${g.email ? "text-slate-600" : "text-slate-400"}`}>
                              {g.email || "No email on file"}
                            </p>
                            {g.accountName ? (
                              <p className="truncate text-[11px] text-slate-400">
                                Account: {g.accountName}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
                          <div className="min-w-0">
                            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-400">Semester</span>
                            <span className="block truncate font-medium text-slate-700">
                              <span className="sm:hidden">{g.semester.replace(/First Semester/i, "1st Sem")}</span>
                              <span className="hidden sm:inline">{g.semester}</span>
                            </span>
                          </div>
                          <div className="min-w-0">
                            <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-400">Disbursed / Confirmed</span>
                            <span className={`block break-words font-medium ${g.claimedAt || g.disbursedAt ? "text-slate-700" : "text-slate-400"}`}>
                              {g.claimedAt || g.disbursedAt ? formatDate(g.claimedAt ?? g.disbursedAt) : "—"}
                            </span>
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">Submission</span>
                            <SubmissionStatusBadge state={g.submissionState} compact />
                          </div>
                          <div>
                            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-slate-400">Payout</span>
                            {g.status === "Confirmed" ? (
                              <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">Confirmed</span>
                            ) : g.status === "Awaiting Confirmation" ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="inline-flex rounded-full bg-cyan-50 px-2.5 py-1 text-[10px] font-semibold text-cyan-700">Awaiting Confirmation</span>
                                {!g.disbursementEmailSentAt ? (
                                  <button
                                    type="button"
                                    onClick={() => void dispatchPayoutToGrantee(g.id, true)}
                                    disabled={Boolean(processingIds[g.id])}
                                    className="text-[10px] font-semibold text-cyan-800 underline underline-offset-2 disabled:opacity-50"
                                  >
                                    Retry email
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">Pending</span>
                            )}
                          </div>
                        </div>
                      </article>
                    )) : (
                      <div className="rounded-xl border border-slate-100 px-4 py-10 text-center">
                        <h2 className="text-sm font-semibold text-slate-900">
                          {hasActiveFilters ? "No matching disbursements" : "No disbursements recorded"}
                        </h2>
                        <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                          {hasActiveFilters
                            ? "No grantee records match your active search query or filter criteria."
                            : "There are no grantee payout records for this semester yet."}
                        </p>
                        {hasActiveFilters ? (
                          <button
                            type="button"
                            onClick={() => {
                              setQuery("");
                              setSubmissionFilter("all");
                              setClaimedFilter("all");
                              setCurrentPage(1);
                            }}
                            className="mt-4 rounded-lg border border-emerald-200/60 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                          >
                            Clear filters
                          </button>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <div className="hidden w-full overflow-x-auto whitespace-nowrap md:block">
                  <table aria-label="Disbursement list" className="w-full min-w-[960px] border-collapse">
                    <thead className="sticky top-0 z-10 border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left">Student name</th>
                        <th scope="col" className="px-6 py-3 text-left">Semester</th>
                        <th scope="col" className="px-6 py-3 text-left">Submission status</th>
                        <th scope="col" className="px-6 py-3 text-left">Payout status</th>
                        <th scope="col" className="px-6 py-3 text-left">Disbursed / confirmed at</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredWithSubmission.length > 0 ? pagedRows.map((g, idx) => (
                        <tr
                          key={g.id}
                          className={`text-xs text-slate-700 transition-colors duration-1000 hover:bg-slate-50/50 ${recentlyConfirmedIds.has(g.id) ? "bg-emerald-50/70" : idx % 2 === 0 ? "bg-white" : "bg-slate-50"}`}
                        >
                          <td className="px-6 py-4">
                            <div className="flex w-full min-w-0 items-center gap-3 overflow-hidden pr-2">
                              <input
                                type="checkbox"
                                checked={g.status !== "Pending Payout"}
                                disabled={g.status !== "Pending Payout" || Boolean(processingIds[g.id])}
                                onChange={(event) => requestPayoutDisbursement(g, event.currentTarget)}
                                aria-label={g.status === "Pending Payout" ? `Disburse payout to ${g.name}` : `Payout for ${g.name} has been disbursed`}
                                aria-busy={processingIds[g.id] ? true : undefined}
                                className="h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                              />
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                                {g.name.split(" ").map((namePart) => namePart[0]).slice(0, 2).join("").toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <span className="block truncate text-xs font-bold uppercase text-slate-900">{g.name}</span>
                                <span className={`block truncate text-xs ${g.email ? "text-slate-600" : "text-slate-400"}`}>
                                  {g.email || "No email on file"}
                                </span>
                                {g.accountName ? (
                                  <span className="block truncate text-[11px] text-slate-400">
                                    Account: {g.accountName}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="truncate px-6 py-4 pr-2 text-slate-600">{g.semester}</td>
                          <td className="px-6 py-4">
                            <SubmissionStatusBadge state={g.submissionState} />
                          </td>
                          <td className="px-6 py-4">
                            {g.status === "Confirmed" ? (
                              <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">Confirmed</span>
                            ) : g.status === "Awaiting Confirmation" ? (
                              <div className="flex flex-col items-start gap-1">
                                <span className="inline-flex items-center rounded-full bg-cyan-50 px-3 py-1 text-xs font-semibold text-cyan-700">Awaiting Confirmation</span>
                                {!g.disbursementEmailSentAt ? (
                                  <button
                                    type="button"
                                    onClick={() => void dispatchPayoutToGrantee(g.id, true)}
                                    disabled={Boolean(processingIds[g.id])}
                                    className="text-[10px] font-semibold text-cyan-800 underline underline-offset-2 disabled:opacity-50"
                                  >
                                    Retry email
                                  </button>
                                ) : null}
                              </div>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Pending</span>
                            )}
                          </td>
                          <td className="whitespace-nowrap px-6 py-4 font-medium text-slate-500">
                            {formatDate(g.claimedAt ?? g.disbursedAt)}
                          </td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={5} className="py-16 text-center">
                            {hasActiveFilters ? (
                              <>
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                  <SearchX className="h-6 w-6" aria-hidden="true" />
                                </div>
                                <h2 className="text-sm font-semibold text-slate-900">No matching disbursements</h2>
                                <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                                  No grantee records match your active search query or filter criteria.
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setQuery("");
                                    setSubmissionFilter("all");
                                    setClaimedFilter("all");
                                    setCurrentPage(1);
                                  }}
                                  className="mt-4 rounded-lg border border-emerald-200/60 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100"
                                >
                                  Clear filters
                                </button>
                              </>
                            ) : (
                              <>
                                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                                  <Inbox className="h-6 w-6" aria-hidden="true" />
                                </div>
                                <h2 className="text-sm font-semibold text-slate-900">No disbursements recorded</h2>
                                <p className="mx-auto mt-1 max-w-xs text-xs text-slate-500">
                                  There are no grantee payout records for this semester yet.
                                </p>
                              </>
                            )}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                  </div>

                  {filteredWithSubmission.length > 0 ? (
                    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-200/80 px-5 py-3.5">
                      <p className="inline-flex h-8 items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                        <span>Showing</span>
                        <span className="font-semibold text-slate-900">
                          {(displayPage - 1) * rowsPerPage + 1}–{Math.min(displayPage * rowsPerPage, filteredWithSubmission.length)}
                        </span>
                        <span>of</span>
                        <span className="font-semibold text-slate-900">{filteredWithSubmission.length.toLocaleString()}</span>
                      </p>
                      <div className="flex flex-wrap items-center gap-4">
                        <label className="inline-flex h-8 items-center gap-2 border-l border-slate-200 pl-4">
                          <span className="text-xs font-medium text-slate-500">Rows per page</span>
                          <select
                            aria-label="Rows per page"
                            value={rowsPerPage}
                            onChange={(event) => {
                              setRowsPerPage(Number(event.target.value));
                              setCurrentPage(1);
                            }}
                            className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-400"
                          >
                            {ADMIN_TABLE_PAGE_SIZES.map((size) => (
                              <option key={size} value={size}>{size} rows</option>
                            ))}
                          </select>
                        </label>
                        <AdminPaginationControls
                          page={displayPage}
                          totalPages={totalPages}
                          onPageChange={setCurrentPage}
                        />
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </div>
            </div>
          </div>
        </div>
        {disbursementCandidate ? (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeDisbursementDialog();
            }}
          >
            <section
              ref={disbursementDialogRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="payout-disbursement-title"
              aria-describedby="payout-disbursement-description"
              className="w-full max-w-md rounded-2xl border border-amber-200 bg-white p-6 shadow-2xl"
            >
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-amber-200">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <h2 id="payout-disbursement-title" className="text-lg font-bold tracking-tight text-slate-900">
                    Confirm cash disbursement
                  </h2>
                  <p id="payout-disbursement-description" className="mt-2 text-sm leading-relaxed text-slate-600">
                    Confirm only if the cash has already been handed to this grantee. This records the payout as disbursed and notifies them to confirm receipt. It cannot be undone from this screen.
                  </p>
                </div>
              </div>

              <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-4 text-sm">
                <dt className="text-slate-500">Grantee</dt>
                <dd className="text-right">
                  <span className="block font-semibold text-slate-900">{disbursementCandidate.name}</span>
                  <span className={`block text-xs ${disbursementCandidate.email ? "text-slate-600" : "text-slate-400"}`}>
                    {disbursementCandidate.email || "No email on file"}
                  </span>
                  {disbursementCandidate.accountName ? (
                    <span className="block text-[11px] text-slate-400">
                      Account: {disbursementCandidate.accountName}
                    </span>
                  ) : null}
                </dd>
                <dt className="text-slate-500">Semester</dt>
                <dd className="text-right font-medium text-slate-900">
                  {String(selectedSemester ?? "").replace(/\s*\(Current\)$/i, "").trim()}
                </dd>
                <dt className="text-slate-500">Cash amount</dt>
                <dd className="text-right font-semibold text-slate-900">{formatter.format(GRANT_AMOUNT)}</dd>
              </dl>

              <div className="mt-6 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  ref={cancelDisbursementButtonRef}
                  type="button"
                  onClick={closeDisbursementDialog}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmPayoutDisbursement}
                  className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
                >
                  Confirm disbursement
                </button>
              </div>
            </section>
          </div>
        ) : null}
        {confirmedPayoutToast ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed right-4 top-20 z-[90] flex max-w-sm items-center gap-3 rounded-xl border border-emerald-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-lg"
          >
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="flex-1">{confirmedPayoutToast}</span>
            <button
              type="button"
              onClick={() => {
                setConfirmedPayoutToast(null);
                if (confirmedToastTimerRef.current !== null) {
                  window.clearTimeout(confirmedToastTimerRef.current);
                  confirmedToastTimerRef.current = null;
                }
              }}
              className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss confirmation notice"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        ) : null}
    </main>
  );
}
