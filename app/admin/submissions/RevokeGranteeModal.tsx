"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown, Loader2, X } from "lucide-react";
import {
  isSkeapRevocationReason,
  SKEAP_REVOCATION_REASONS,
  type SkeapRevocationReason,
} from "@/lib/skeap-revocation";

type RevocationNotificationStatus = "NOT_REQUIRED" | "PENDING" | "SENDING" | "FAILED" | "SENT";

interface RevokeGranteeModalProps {
  granteeId: string;
  granteeName: string;
  open: boolean;
  submitting: boolean;
  error?: string | null;
  notice?: string | null;
  notificationStatus?: RevocationNotificationStatus | null;
  revocationSaved?: boolean;
  archiveRefreshFailed?: boolean;
  onClose: () => void;
  onConfirm: (granteeId: string, reason: SkeapRevocationReason, additionalNotes: string) => void;
}

export default function RevokeGranteeModal({
  granteeId,
  granteeName,
  open,
  submitting,
  error,
  notice,
  notificationStatus,
  revocationSaved = false,
  archiveRefreshFailed = false,
  onClose,
  onConfirm,
}: RevokeGranteeModalProps) {
  const [reason, setReason] = useState<SkeapRevocationReason | "">("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  if (!open) return null;

  const close = () => {
    if (!submitting) {
      setReason("");
      setAdditionalNotes("");
      onClose();
    }
  };
  const actionLabel = !revocationSaved
    ? "Confirm Revocation"
    : archiveRefreshFailed && notificationStatus === "SENT"
      ? "Retry Archive Refresh"
      : notificationStatus === "FAILED"
        ? "Retry Notification"
        : "Check Notification";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="revoke-grantee-title"
        aria-describedby="revoke-grantee-description"
        className="w-full max-w-lg space-y-5 rounded-2xl border border-rose-200/80 bg-white px-6 py-4 shadow-2xl"
      >
        <div className="space-y-2">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 id="revoke-grantee-title" className="text-base font-bold tracking-tight text-slate-900">
                Revoke Grantee
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              aria-label="Close revoke grantee dialog"
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p id="revoke-grantee-description" className="text-sm leading-relaxed text-slate-600">
            {revocationSaved
              ? `${granteeName}'s scholarship is revoked. Retry the notification or close this dialog; the revocation will not be repeated.`
              : `Are you sure you want to revoke this scholarship? This action will tag ${granteeName} as Revoked, transfer their record to Revoked Grantees, and automatically notify them via email.`}
          </p>
        </div>

        {error && !revocationSaved ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {notice}
          </div>
        ) : null}

        <div className="mb-4 flex flex-col gap-3">
          <label htmlFor="revoke-grantee-reason" className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Reason for Revocation
            </span>
            <div className="relative">
              <select
                id="revoke-grantee-reason"
                value={reason}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setReason(isSkeapRevocationReason(value) ? value : "");
                }}
                disabled={submitting || revocationSaved}
                required
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">Select a reason</option>
                {SKEAP_REVOCATION_REASONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
            </div>
          </label>
          <label htmlFor="revoke-grantee-additional-notes" className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Additional Notes <span className="font-medium normal-case text-slate-400">(Optional)</span>
            </span>
            <textarea
              id="revoke-grantee-additional-notes"
              rows={3}
              value={additionalNotes}
              onChange={(event) => setAdditionalNotes(event.currentTarget.value)}
              disabled={submitting || revocationSaved}
              maxLength={1000}
              placeholder="Add context, such as the other scholarship agency"
              className="w-full min-h-24 max-h-40 resize-y overflow-y-auto rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {revocationSaved ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (isSkeapRevocationReason(reason)) {
                onConfirm(granteeId, reason, additionalNotes.trim());
              }
            }}
            disabled={
              submitting ||
              !isSkeapRevocationReason(reason) ||
              (revocationSaved &&
                (notificationStatus === "SENT" || notificationStatus === "NOT_REQUIRED") &&
                !archiveRefreshFailed)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? (revocationSaved ? "Retrying..." : "Revoking...") : actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
