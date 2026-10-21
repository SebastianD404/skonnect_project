"use client";

import { useEffect, useRef } from "react";
import { AlertCircle, CheckCircle2 } from "lucide-react";

type FloatingFeedbackProps = {
  message: string;
  type: "success" | "error";
  onDismiss: () => void;
  autoDismissMs?: number;
};

export default function FloatingFeedback({
  message,
  type,
  onDismiss,
  autoDismissMs = type === "success" ? 4500 : 0,
}: FloatingFeedbackProps) {
  const onDismissRef = useRef(onDismiss);

  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (autoDismissMs <= 0) return;
    const timer = window.setTimeout(() => onDismissRef.current(), autoDismissMs);
    return () => window.clearTimeout(timer);
  }, [autoDismissMs, message]);

  const isSuccess = type === "success";

  return (
    <div
      role={isSuccess ? "status" : "alert"}
      aria-live={isSuccess ? "polite" : "assertive"}
      className={`fixed bottom-6 right-6 z-[100] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-slate-200 border-l-4 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg sm:max-w-md ${
        isSuccess ? "border-l-emerald-500" : "border-l-rose-500"
      }`}
    >
      {isSuccess ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
      ) : (
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-500" aria-hidden="true" />
      )}
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={() => onDismissRef.current()}
        aria-label={`Dismiss ${type} notification`}
        className="ml-1 text-slate-400 transition hover:text-slate-700"
      >
        ×
      </button>
    </div>
  );
}
