"use client";

import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { listenForSkeapApplyToasts } from "@/lib/skeap-application-guard";

type Toast = {
  title: string;
  description: string;
  variant: "warning" | "error" | "info";
};

export default function SkeapApplyToastViewport() {
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    let timeout: number | undefined;
    const unsubscribe = listenForSkeapApplyToasts((nextToast) => {
      setToast(nextToast);
      if (timeout !== undefined) window.clearTimeout(timeout);
      timeout = window.setTimeout(() => setToast(null), 6000);
    });

    return () => {
      unsubscribe();
      if (timeout !== undefined) window.clearTimeout(timeout);
    };
  }, []);

  if (!toast) return null;

  const isWarning = toast.variant === "warning";
  const isInfo = toast.variant === "info";
  return (
    <div
      role={isInfo ? "status" : "alert"}
      aria-live={isInfo ? "polite" : "assertive"}
      className={`fixed right-4 top-4 z-[100] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border p-4 shadow-xl ${
        isInfo
          ? "border-sky-200 bg-sky-50 text-sky-950"
          : isWarning
          ? "border-amber-200 bg-amber-50 text-amber-950"
          : "border-rose-200 bg-rose-50 text-rose-950"
      }`}
    >
      <p className="flex items-center gap-2 font-semibold">
        {isInfo ? <Info className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
        {toast.title}
      </p>
      <p className="mt-1 text-sm leading-5">{toast.description}</p>
    </div>
  );
}
