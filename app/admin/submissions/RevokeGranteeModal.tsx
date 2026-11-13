"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";
import { SKEAP_REVOCATION_REASONS } from "@/lib/skeap-revocation";

interface RevokeGranteeModalProps {
  granteeName: string;
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string, additionalNotes: string) => void;
}

export default function RevokeGranteeModal({
  granteeName,
  open,
  submitting,
  onClose,
  onConfirm,
}: RevokeGranteeModalProps) {
  const [reason, setReason] = useState("");
  const [additionalNotes, setAdditionalNotes] = useState("");

  if (!open) return null;

  const close = () => {
    if (!submitting) {
      setReason("");
      setAdditionalNotes("");
      onClose();
    }
  };

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
        className="w-full max-w-lg space-y-5 rounded-2xl border border-rose-200/80 bg-white p-6 shadow-2xl"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-start justify-between gap-3">
              <h2 id="revoke-grantee-title" className="text-base font-bold tracking-tight text-slate-900">
                Revoke Grantee
              </h2>
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
              Are you sure you want to revoke this scholarship? This action will tag {granteeName} as Removed,
              transfer their record to the Past Grantees archive, and automatically notify them via email.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-col gap-3">
          <label htmlFor="revoke-grantee-reason" className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Reason for Revocation
            </span>
            <select
              id="revoke-grantee-reason"
              value={reason}
              onChange={(event) => setReason(event.currentTarget.value)}
              disabled={submitting}
              required
              className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-transparent focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:bg-slate-50"
            >
              <option value="">Select a reason</option>
              {SKEAP_REVOCATION_REASONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>
          <label htmlFor="revoke-grantee-additional-notes" className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Additional Notes <span className="font-medium normal-case text-slate-400">(Optional)</span>
            </span>
            <input
              id="revoke-grantee-additional-notes"
              type="text"
              value={additionalNotes}
              onChange={(event) => setAdditionalNotes(event.currentTarget.value)}
              disabled={submitting}
              maxLength={1000}
              placeholder="Add context, such as the other scholarship agency"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-500 focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:bg-slate-50"
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
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(reason, additionalNotes.trim())}
            disabled={submitting || !reason.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? "Revoking..." : "Confirm Revocation"}
          </button>
        </div>
      </section>
    </div>
  );
}
