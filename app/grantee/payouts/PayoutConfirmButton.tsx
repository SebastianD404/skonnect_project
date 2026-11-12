"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";

export function PayoutConfirmButton({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [isConfirming, setIsConfirming] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [toastIsError, setToastIsError] = useState(false);

  useEffect(() => {
    if (!toastMessage) return;
    const timeoutId = window.setTimeout(() => setToastMessage(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  async function confirmReceipt() {
    if (isConfirming) return;
    setIsConfirming(true);
    setToastMessage(null);

    try {
      const response = await fetch("/api/grantee/payouts/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Could not confirm payout receipt.");

      setToastIsError(false);
      setToastMessage("Cash receipt confirmed.");
      router.refresh();
    } catch (error) {
      setToastIsError(true);
      setToastMessage(error instanceof Error ? error.message : "Could not confirm payout receipt.");
    } finally {
      setIsConfirming(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => void confirmReceipt()}
        disabled={isConfirming}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-cyan-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-cyan-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-700 disabled:cursor-wait disabled:opacity-70"
      >
        {isConfirming ? (
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
        )}
        {isConfirming ? "Confirming..." : "Confirm Cash Receipt"}
      </button>
      {toastMessage ? (
        <div
          role={toastIsError ? "alert" : "status"}
          aria-live={toastIsError ? "assertive" : "polite"}
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${
            toastIsError
              ? "border-rose-200 bg-white text-rose-700"
              : "border-emerald-200 bg-white text-emerald-700"
          }`}
        >
          {!toastIsError ? <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
          {toastMessage}
        </div>
      ) : null}
    </>
  );
}
