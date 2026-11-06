"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArchiveRestore, FileText } from "lucide-react";
import { AdminKKProfilingFormView } from "../../kk-profiling/AdminKKProfilingFormView";
import type { KKProfilingRegistration } from "../../kk-profiling/types";

export function ArchivedMemberRowActions({
  registration,
}: {
  registration: KKProfilingRegistration;
}) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const restoreProfile = async () => {
    if (isRestoring) return;
    setIsRestoring(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/members/${registration.id}/restore`, {
        method: "PATCH",
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to restore profile");
      }
      router.refresh();
    } catch (restoreError) {
      setError(restoreError instanceof Error ? restoreError.message : "Failed to restore profile");
    } finally {
      setIsRestoring(false);
    }
  };

  return (
    <>
      <div className="flex items-center justify-end gap-1.5">
        <button
          type="button"
          onClick={() => setShowDetails(true)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          title="View details"
          aria-label={`View ${registration.fullName} details`}
        >
          <FileText className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={restoreProfile}
          disabled={isRestoring}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
          title="Restore profile"
          aria-label={`Restore ${registration.fullName} profile`}
        >
          <ArchiveRestore className={`h-3.5 w-3.5 ${isRestoring ? "animate-pulse" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {error ? (
        <p role="alert" className="mt-1 text-right text-xs text-rose-700">{error}</p>
      ) : null}
      {showDetails ? (
        <AdminKKProfilingFormView
          registration={registration}
          onClose={() => setShowDetails(false)}
        />
      ) : null}
    </>
  );
}
