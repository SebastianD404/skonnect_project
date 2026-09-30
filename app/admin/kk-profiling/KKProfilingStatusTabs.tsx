"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

interface KKProfilingStatusTabsProps {
  currentStatus: string;
}

export default function KKProfilingStatusTabs({ currentStatus }: KKProfilingStatusTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransitionState] = useTransition();
  const statuses = ["pending", "returned", "resubmitted", "approved"] as const;

  const changeStatus = (newStatus: string) => {
    if (newStatus === currentStatus) return;

    startTransitionState(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("status", newStatus);
      params.set("page", "1");
      router.push(`/admin/kk-profiling?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <div className="inline-flex items-center rounded-lg bg-slate-100 p-1">
      {statuses.map((status) => {
        const isActive = currentStatus === status;
        const label = status.charAt(0).toUpperCase() + status.slice(1);

        return (
          <button
            key={status}
            type="button"
            onClick={() => changeStatus(status)}
            disabled={isPending || isActive}
            aria-pressed={isActive}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all duration-200 disabled:cursor-default ${
              isActive
                ? "bg-white text-slate-900 shadow-sm"
                : "bg-transparent text-slate-500 hover:bg-slate-200/50 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
