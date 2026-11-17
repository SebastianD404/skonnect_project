"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { Archive, Clock, FileCheck2, RefreshCw, Undo2, type LucideIcon } from "lucide-react";
import type { KkProfilingAdminViewCounts } from "@/lib/admin-application-views";
import { useKKProfilingTableSearch } from "./KKProfilingTableSearch";

interface KKProfilingStatusTabsProps {
  currentStatus: string;
  counts: KkProfilingAdminViewCounts;
}

const statuses: Array<{
  key: string;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  countKey: keyof KkProfilingAdminViewCounts;
}> = [
  { key: "pending", label: "Pending Review", subtitle: "in queue", icon: Clock, countKey: "pendingCount" },
  { key: "returned", label: "Returned for Edits", subtitle: "awaiting youth re-upload", icon: Undo2, countKey: "returnedCount" },
  { key: "resubmitted", label: "Resubmitted", subtitle: "updated digital files", icon: RefreshCw, countKey: "resubmittedCount" },
  { key: "physical-ctc", label: "For Physical CTC", subtitle: "awaiting in-person verification", icon: FileCheck2, countKey: "physicalCtcCount" },
  { key: "withdrawn", label: "Withdrawn", subtitle: "declined or withdrawn", icon: Archive, countKey: "withdrawnCount" },
];

export default function KKProfilingStatusTabs({ currentStatus, counts }: KKProfilingStatusTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus);
  const [newResubmissionCount, setNewResubmissionCount] = useState(0);
  const isRedirectingToResubmitted = useRef(false);
  const tableSearch = useKKProfilingTableSearch();
  const setIsNavigating = tableSearch?.setIsNavigating;

  const markResubmissionsViewed = useCallback(() => {
    const viewedAt = new Date().toISOString();
    document.cookie = `admin-kk-profiling-last-viewed=${encodeURIComponent(viewedAt)}; Path=/; Max-Age=31536000; SameSite=Lax`;
    setNewResubmissionCount(0);
    window.dispatchEvent(new Event("admin-kk-profiling-viewed"));
  }, []);

  const checkForResubmissions = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/sidebar-counts", { cache: "no-store" });
      if (!response.ok) {
        throw new Error(`Unable to check for resubmitted applications (${response.status}).`);
      }

      const data = (await response.json()) as { counts?: { resubmittedProfilingRegistrationCount?: number } };
      const count = data.counts?.resubmittedProfilingRegistrationCount;
      if (!Number.isInteger(count) || count === undefined) {
        throw new Error("The resubmitted application count was invalid.");
      }

      setNewResubmissionCount(count);
      if (count > 0 && currentStatus !== "resubmitted" && !isRedirectingToResubmitted.current) {
        isRedirectingToResubmitted.current = true;
        markResubmissionsViewed();
        const params = new URLSearchParams(searchParams.toString());
        params.set("status", "resubmitted");
        params.set("page", "1");
        params.delete("focus");
        router.replace(`/admin/kk-profiling?${params.toString()}`, { scroll: false });
      }
    } catch (error) {
      console.error("Failed to check for KK Profiling resubmissions:", error);
    }
  }, [currentStatus, markResubmissionsViewed, router, searchParams]);

  useEffect(() => {
    isRedirectingToResubmitted.current = false;
  }, [currentStatus]);

  useEffect(() => {
    if (currentStatus === "resubmitted") return;
    const initialCheck = window.setTimeout(() => void checkForResubmissions(), 0);
    const interval = window.setInterval(() => void checkForResubmissions(), 15_000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, [checkForResubmissions, currentStatus]);

  useEffect(() => {
    if (!isPending) setIsNavigating?.(false);
  }, [isPending, setIsNavigating]);

  useEffect(() => {
    setIsNavigating?.(false);
  }, [currentStatus, setIsNavigating]);

  const changeStatus = (newStatus: string) => {
    if (newStatus === optimisticStatus) return;

    if (newStatus === "resubmitted") markResubmissionsViewed();
    setIsNavigating?.(true);
    startTransition(() => {
      setOptimisticStatus(newStatus);
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", newStatus);
      params.set("page", "1");
      params.delete("focus");
      router.push(`/admin/kk-profiling?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {statuses.map(({ key, label, subtitle, icon: Icon, countKey }) => {
        const isActive = optimisticStatus === key;
        return (
          <button
            key={key}
            type="button"
            onClick={() => changeStatus(key)}
            disabled={isPending || isActive}
            aria-pressed={isActive}
            className={`group relative flex w-full flex-col gap-2 overflow-hidden rounded-2xl border bg-white p-4 text-left shadow-[0_6px_24px_-6px_rgba(14,116,144,0.09)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 disabled:cursor-default ${
              isActive
                ? "border-[1.5px] border-[#0a1f33]"
                : "border-slate-200/75 hover:border-slate-300"
            }`}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 58% 70% at 95% 5%, rgba(56, 189, 248, 0.16) 0%, rgba(103, 232, 249, 0.06) 42%, transparent 100%)",
              }}
            />
            <div className="relative z-10 flex min-w-0 items-center justify-between gap-2 sm:gap-3">
              <span className={`min-w-0 truncate text-[10px] font-bold uppercase tracking-widest ${isActive ? "text-[#0891b2]" : "text-slate-400"}`}>
                {label}
              </span>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-300 group-hover:scale-110 ${
                isActive
                  ? "bg-[#0891b2] text-white shadow-[0_0_0_5px_rgba(8,145,178,0.10)]"
                  : "border border-sky-100 bg-sky-50/90 text-cyan-600"
              }`}>
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              </div>
            </div>
            <div className="relative z-10">
              <h3 className="text-2xl font-extrabold tabular-nums leading-none tracking-tight text-slate-950">
                {counts[countKey]}
              </h3>
              <p className={`mt-1 text-[11px] font-medium ${isActive ? "text-slate-500" : "text-slate-400"}`}>
                {subtitle}
                {key === "resubmitted" && newResubmissionCount > 0 ? (
                  <span className="ml-1.5 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700">
                    {newResubmissionCount > 99 ? "99+" : newResubmissionCount} new
                  </span>
                ) : null}
              </p>
            </div>
          </button>
        );
      })}
    </div>
  );
}
