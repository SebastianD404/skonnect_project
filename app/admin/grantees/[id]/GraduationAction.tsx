"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";

export default function GraduationAction({
  granteeId,
  granteeName,
}: {
  granteeId: string;
  granteeName: string;
}) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmGraduation() {
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/grantees/${granteeId}/graduate`, { method: "PATCH" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to mark grantee as graduated.");
      }
      setIsOpen(false);
      router.refresh();
    } catch (graduationError) {
      setError(graduationError instanceof Error ? graduationError.message : "Unable to mark grantee as graduated.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setIsOpen(true);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900"
      >
        <GraduationCap className="h-4 w-4 text-cyan-600" aria-hidden="true" />
        Graduate Scholar
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            aria-hidden="true"
            onClick={() => {
              if (!isSubmitting) setIsOpen(false);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="graduation-modal-title"
            className="relative flex w-full max-w-sm flex-col items-center gap-3 overflow-hidden rounded-2xl border border-t-4 border-slate-200 border-t-cyan-600 bg-white p-5 text-center shadow-xl ring-1 ring-slate-900/5"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-cyan-50 ring-4 ring-cyan-50/50">
              <GraduationCap className="h-6 w-6 text-cyan-600" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-1.5">
              <h2 id="graduation-modal-title" className="text-[17px] font-black leading-none text-slate-900">
                Mark as graduated?
              </h2>
              <p className="px-2 text-[13px] leading-snug text-slate-500">
                This will archive <span className="font-bold text-slate-900">{granteeName}</span>&apos;s account, free up <span className="font-bold text-slate-900">1 active slot</span>, and notify the waitlist queue.
              </p>
            </div>
            {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
            <div className="grid w-full grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-slate-300 bg-white py-2 text-[13px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void confirmGraduation()}
                disabled={isSubmitting}
                className="w-full rounded-xl border border-cyan-600 bg-cyan-600 py-2 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-cyan-700 focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSubmitting ? "Updating..." : "Confirm Graduation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}