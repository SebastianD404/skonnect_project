"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, RefreshCw } from "lucide-react";

type SyncFeedback = {
  message: string;
  type: "success" | "error";
};

export default function SystemAdminDashboardActions() {
  const router = useRouter();
  const [isSyncing, setIsSyncing] = useState(false);
  const [feedback, setFeedback] = useState<SyncFeedback | null>(null);

  function handleExportLogs() {
    window.location.assign("/api/system-admin/audit/export");
  }

  async function handleSystemSync() {
    setIsSyncing(true);
    setFeedback(null);

    try {
      const response = await fetch("/api/system-admin/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply: true }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { applied?: boolean; error?: string; summary?: { errors?: number } }
        | null;

      if (!response.ok || !payload?.applied) {
        throw new Error(payload?.error || "System sync could not be completed.");
      }

      const errors = payload.summary?.errors ?? 0;
      if (errors > 0) {
        setFeedback({
          message: `Sync completed with ${errors} reconciliation error${errors === 1 ? "" : "s"}. Review the reconciliation details.`,
          type: "error",
        });
        return;
      }

      router.refresh();
      setFeedback({
        message: "Supabase Auth users and database entities have been reconciled successfully.",
        type: "success",
      });
    } catch (error) {
      setFeedback({
        message: error instanceof Error ? error.message : "System sync could not be completed.",
        type: "error",
      });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleExportLogs}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
        >
          <Download className="h-3.5 w-3.5" />
          Export Logs
        </button>
        <button
          type="button"
          onClick={handleSystemSync}
          disabled={isSyncing}
          className="flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
          {isSyncing ? "Syncing..." : "System Sync"}
        </button>
      </div>
      {feedback ? (
        <p
          role={feedback.type === "error" ? "alert" : "status"}
          className={`max-w-sm text-xs sm:text-right ${feedback.type === "error" ? "text-rose-700" : "text-emerald-700"}`}
        >
          {feedback.message}
        </p>
      ) : null}
    </div>
  );
}