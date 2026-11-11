"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import { useKKProfilingTableSearch } from "./KKProfilingTableSearch";

interface KKProfilingStatusTabsProps {
  currentStatus: string;
}

export default function KKProfilingStatusTabs({ currentStatus }: KKProfilingStatusTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticStatus, setOptimisticStatus] = useOptimistic(currentStatus);
  const [newResubmissionCount, setNewResubmissionCount] = useState(0);
  const isRedirectingToResubmitted = useRef(false);
  const tableSearch = useKKProfilingTableSearch();
  const setIsNavigating = tableSearch?.setIsNavigating;
  const statuses = ["pending", "returned", "resubmitted", "approved"] as const;

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
    <div className="w-full min-w-0 overflow-x-auto scrollbar-hide sm:w-auto">
      <div className="inline-flex min-w-max items-center gap-1 rounded-lg bg-slate-100 p-1">
        {statuses.map((status) => {
          const isActive = optimisticStatus === status;
          const label = status.charAt(0).toUpperCase() + status.slice(1);
          const count = status === "resubmitted" ? newResubmissionCount : 0;

          return (
            <button
              key={status}
              type="button"
              onClick={() => changeStatus(status)}
              disabled={isPending || isActive}
              aria-pressed={isActive}
              className={`shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-all duration-200 sm:px-4 disabled:cursor-default ${
                isActive
                  ? "bg-white text-slate-900 shadow-sm"
                  : "bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
              }`}
            >
              {label}
              {status === "resubmitted" && count > 0 ? (
                <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-rose-700">
                  {count > 99 ? "99+" : count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
