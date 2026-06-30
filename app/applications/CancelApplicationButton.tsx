"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CancelApplicationButtonProps {
  applicationId: string;
  disabled?: boolean;
}

export default function CancelApplicationButton({ applicationId, disabled }: CancelApplicationButtonProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  async function handleCancel() {
    setIsCancelling(true);
    setMessage(null);

    if (!applicationId) {
      setMessage("Missing application id");
      setIsCancelling(false);
      console.error("CancelApplicationButton: missing applicationId prop");
      return;
    }

    try {
      const res = await fetch(`/api/applications/${encodeURIComponent(applicationId)}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Send id in body as a fallback in case route params are not provided by the environment
        body: JSON.stringify({ id: applicationId }),
        credentials: "same-origin",
      });

      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        let errMsg = "Unable to cancel application";
        try {
          if (contentType.includes("application/json")) {
            const body = await res.json();
            errMsg = body?.error || body?.message || errMsg;
          } else {
            const text = await res.text();
            // If HTML returned (server error page), avoid showing raw HTML
            if (text && !text.trim().startsWith("<")) {
              errMsg = text;
            }
          }
        } catch (e) {
          // ignore parse errors and fall back to generic message
        }

        throw new Error(errMsg);
      }

      setMessage("Application cancelled successfully.");
      setIsConfirmOpen(false);
      // Refresh server data and navigate away so the UI reflects the cancelled state
        // Wait 1s so user sees success message, then redirect to home
        setTimeout(() => {
          try {
            router.push("/");
          } catch (e) {
            try {
              router.refresh();
            } catch {}
          }
        }, 1000);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to cancel application");
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div className="relative inline-block text-left">
      <button
        type="button"
        disabled={!!disabled}
        onClick={() => setIsConfirmOpen(true)}
        className={`rounded-2xl px-4 py-2 text-sm font-semibold transition ${disabled ? "border border-slate-200 bg-slate-100 text-slate-400" : "border border-rose-200 bg-rose-600 text-white hover:bg-rose-700"}`}
      >
        Cancel application
      </button>

      {isConfirmOpen ? (
        <div className="absolute right-0 z-50 mt-2 w-[calc(100vw-2rem)] max-w-sm rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:w-96">
          <p className="text-sm font-semibold text-slate-900">Cancel your application?</p>
          <p className="mt-3 text-sm text-slate-600">Are you sure you want to cancel your application? This action cannot be undone.</p>
          {message ? <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-rose-700">{message}</p> : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isCancelling}
              className="rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCancelling ? "Cancelling..." : "Yes, cancel"}
            </button>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50"
            >
              Keep application
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
