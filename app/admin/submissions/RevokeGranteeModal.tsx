"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, X } from "lucide-react";

const REVOCATION_TEMPLATES = [
  {
    label: "Academic Failure",
    content:
      "After a careful review of your submitted Grade Report, we regret to inform you that you have not met the academic requirements for the SKEAP scholarship due to failing grades. Consequently, your scholarship status has been revoked.",
  },
  {
    label: "Incomplete/Dropped",
    content:
      "Our records indicate that you have Incomplete (INC) or Dropped (DRP) subjects on your Grade Report. As per SKEAP guidelines, scholars must maintain a complete academic load. Therefore, your scholarship status has been revoked.",
  },
  {
    label: "Falsified Documents",
    content:
      "During the verification process, discrepancies were found in your submitted documents. Providing inaccurate or falsified information is a violation of SKEAP policies, resulting in the immediate revocation of your scholarship.",
  },
] as const;

interface RevokeGranteeModalProps {
  granteeName: string;
  open: boolean;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export default function RevokeGranteeModal({
  granteeName,
  open,
  submitting,
  onClose,
  onConfirm,
}: RevokeGranteeModalProps) {
  const [reason, setReason] = useState("");

  if (!open) return null;

  const close = () => {
    if (!submitting) {
      setReason("");
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

        <div className="mb-4 flex flex-col gap-2">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <label htmlFor="revoke-grantee-reason" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Reason for Revocation
              </label>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Insert Template
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {REVOCATION_TEMPLATES.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => setReason(template.content)}
                  disabled={submitting}
                  className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {template.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setReason("")}
                disabled={submitting}
                className="rounded px-2 py-1 text-[11px] font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Clear
              </button>
            </div>
          </div>
          <textarea
            id="revoke-grantee-reason"
            rows={5}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={submitting}
            placeholder="e.g., Failed 2 major subjects..."
            className="min-h-[120px] w-full resize-y rounded-lg border border-rose-300 bg-white p-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-transparent focus:ring-2 focus:ring-rose-500 disabled:cursor-not-allowed disabled:bg-slate-50"
          />
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
            onClick={() => onConfirm(reason.trim())}
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
