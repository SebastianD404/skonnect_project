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
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
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
      setShowRestoreConfirm(false);
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
          onClick={() => setShowRestoreConfirm(true)}
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
      {showRestoreConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            aria-label="Cancel restoring profile"
            onClick={() => setShowRestoreConfirm(false)}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`restore-profile-title-${registration.id}`}
            className="relative flex w-full max-w-sm flex-col items-center gap-3 overflow-hidden rounded-2xl border border-t-4 border-slate-200 border-t-emerald-500 bg-white p-5 text-center shadow-xl ring-1 ring-slate-900/5"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <ArchiveRestore className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id={`restore-profile-title-${registration.id}`} className="text-base font-bold tracking-tight text-slate-900">
                Restore profile?
              </h2>
              <p className="mt-1.5 text-sm leading-5 text-slate-600">
                <span className="font-semibold text-slate-900">{registration.fullName}</span> will be returned to the active member records.
              </p>
            </div>
            <div className="mt-1 flex w-full justify-center gap-2">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                disabled={isRestoring}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void restoreProfile()}
                disabled={isRestoring}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-wait disabled:opacity-60"
              >
                {isRestoring ? <ArchiveRestore className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" /> : null}
                {isRestoring ? "Restoring..." : "Restore profile"}
              </button>
            </div>
          </section>
        </div>
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
