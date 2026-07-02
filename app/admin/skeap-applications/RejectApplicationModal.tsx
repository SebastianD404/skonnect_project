"use client";

interface RejectApplicationModalProps {
  applicantName: string;
  rejectionReason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  error?: string | null;
}

export default function RejectApplicationModal({
  applicantName,
  rejectionReason,
  onReasonChange,
  onClose,
  onConfirm,
  submitting,
  error,
}: RejectApplicationModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl">
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-rose-500">Reject application</p>
              <h2 className="mt-3 text-3xl font-bold text-slate-950">Reject Application for {applicantName}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This will permanently reject the application. The applicant will be notified with your reasons immediately.
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
            >
              ×
            </button>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-semibold text-slate-900" htmlFor="rejection-reason">
              Rejection reason
            </label>
            <textarea
              id="rejection-reason"
              rows={4}
              value={rejectionReason}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Specify the exact reason(s) for rejection (e.g., income threshold exceeded, document falsification)..."
              className="w-full p-3 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-rose-500"
            />
            {error ? <p className="text-sm text-rose-600">{error}</p> : null}
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex w-full items-center justify-center rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 sm:w-auto"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!rejectionReason.trim() || submitting}
              className={`inline-flex w-full items-center justify-center rounded-3xl px-4 py-3 text-sm font-semibold text-white transition sm:w-auto ${
                !rejectionReason.trim() || submitting
                  ? "bg-rose-200 text-white cursor-not-allowed"
                  : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              Confirm Rejection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
