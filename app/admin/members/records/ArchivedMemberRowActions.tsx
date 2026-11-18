"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArchiveRestore, FileText, LoaderCircle, X } from "lucide-react";
import { getExactAge } from "@/lib/skeap-age";
import { formatDate } from "@/lib/utils";
import { AdminKKProfilingFormView } from "../../kk-profiling/AdminKKProfilingFormView";
import type { KKProfilingRegistration } from "../../kk-profiling/types";

export function ArchivedMemberRowActions({
  registration,
  onRestored,
}: {
  registration: KKProfilingRegistration;
  onRestored: (fullName: string) => void;
}) {
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const memberName = registration.user?.fullName || registration.fullName;
  const birthDate = registration.birthDate instanceof Date
    ? registration.birthDate
    : new Date(registration.birthDate);
  const currentAge = getExactAge(birthDate);
  const isAgeOut = currentAge !== null && currentAge >= 31;
  const cannotVerifyAge = currentAge === null;

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
      onRestored(memberName);
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
          onClick={() => {
            setError(null);
            setShowRestoreConfirm(true);
          }}
          disabled={isRestoring}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-wait disabled:opacity-60"
          title="Restore profile"
          aria-label={`Restore ${registration.fullName} profile`}
        >
          <ArchiveRestore className={`h-3.5 w-3.5 ${isRestoring ? "animate-pulse" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {error && !showRestoreConfirm ? (
        <p role="alert" className="mt-1 text-right text-xs text-rose-700">{error}</p>
      ) : null}
      {showRestoreConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-sm"
            aria-label="Cancel restoring profile"
            disabled={isRestoring}
            onClick={() => {
              if (!isRestoring) setShowRestoreConfirm(false);
            }}
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby={`restore-profile-title-${registration.id}`}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border-t-4 border-emerald-600 bg-white p-6 text-left shadow-xl"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className="inline-flex shrink-0 items-center justify-center rounded-xl bg-emerald-50 p-2.5 text-emerald-600">
                  <ArchiveRestore className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="text-xs font-semibold tracking-wider text-emerald-700">
                  MEMBER RECORD
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                disabled={isRestoring}
                aria-label="Close restore confirmation"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <h2 id={`restore-profile-title-${registration.id}`} className="mt-3 text-lg font-bold text-slate-900">
              Restore this profile?
            </h2>
            <p className="mt-2 whitespace-normal break-words text-sm leading-6 text-slate-600">
              <span className="font-semibold text-slate-900">{memberName}</span>&apos;s profile will be returned to the active Katipunan ng Kabataan (KK) registry and included in active barangay reports.
            </p>
            <p className="mt-2 whitespace-normal break-words text-xs leading-5 text-slate-500">
              Previously archived: {registration.archivedReason?.trim() || "Reason not recorded"}
              {registration.archivedAt ? ` · ${formatDate(registration.archivedAt)}` : ""}
            </p>
            {isAgeOut ? (
              <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <p className="whitespace-normal break-words">
                  Cannot restore profile: This resident is 31+ years old and exceeds the Katipunan ng Kabataan age bracket (15–30 under RA 10742).
                </p>
              </div>
            ) : cannotVerifyAge ? (
              <div role="alert" className="mt-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
                <p className="whitespace-normal break-words">
                  This resident&apos;s age could not be verified. The profile cannot be restored until the date of birth is corrected.
                </p>
              </div>
            ) : null}
            {error ? (
              <p role="alert" className="mt-3 whitespace-normal break-words text-sm text-rose-700">{error}</p>
            ) : null}
            <div className="mt-6 flex w-full justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRestoreConfirm(false)}
                disabled={isRestoring}
                className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void restoreProfile()}
                disabled={isRestoring || isAgeOut || cannotVerifyAge}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRestoring ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
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
