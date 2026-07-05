"use client";

import { useRouter } from "next/navigation";
import { startTransition, useTransition } from "react";

interface KKProfilingStatusTabsProps {
  currentStatus: string;
}

export default function KKProfilingStatusTabs({ currentStatus }: KKProfilingStatusTabsProps) {
  const router = useRouter();
  const [isPending, startTransitionState] = useTransition();

  const changeStatus = (newStatus: string) => {
    if (newStatus === currentStatus) return;

    startTransitionState(() => {
      router.push(`/admin/kk-profiling?status=${newStatus}`);
    });
  };

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-slate-50 p-1">
      <button
        type="button"
        onClick={() => changeStatus("pending")}
        disabled={isPending || currentStatus === "pending"}
        className={`rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold transition disabled:cursor-default disabled:opacity-90 ${
          currentStatus === "pending"
            ? "bg-slate-950 text-white"
            : "bg-white text-slate-900 hover:bg-slate-100"
        }`}
      >
        Pending
      </button>
      <button
        type="button"
        onClick={() => changeStatus("returned")}
        disabled={isPending || currentStatus === "returned"}
        className={`rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold transition disabled:cursor-default disabled:opacity-90 ${
          currentStatus === "returned"
            ? "bg-slate-950 text-white"
            : "bg-white text-slate-900 hover:bg-slate-100"
        }`}
      >
        Returned
      </button>
      <button
        type="button"
        onClick={() => changeStatus("resubmitted")}
        disabled={isPending || currentStatus === "resubmitted"}
        className={`rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold transition disabled:cursor-default disabled:opacity-90 ${
          currentStatus === "resubmitted"
            ? "bg-slate-950 text-white"
            : "bg-white text-slate-900 hover:bg-slate-100"
        }`}
      >
        Resubmitted
      </button>
      <button
        type="button"
        onClick={() => changeStatus("approved")}
        disabled={isPending || currentStatus === "approved"}
        className={`rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold transition disabled:cursor-default disabled:opacity-90 ${
          currentStatus === "approved"
            ? "bg-slate-950 text-white"
            : "bg-white text-slate-900 hover:bg-slate-100"
        }`}
      >
        Approved
      </button>
    </div>
  );
}
