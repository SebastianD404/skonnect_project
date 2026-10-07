"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

export function useAutoRefresh(intervalMs = 6_000) {
  const router = useRouter();
  const lastRefreshAtRef = useRef(0);

  useEffect(() => {
    const refreshIfVisible = () => {
      if (document.visibilityState !== "visible") return;

      const now = Date.now();
      if (now - lastRefreshAtRef.current < 1_000) return;

      lastRefreshAtRef.current = now;
      router.refresh();
    };

    const intervalId = window.setInterval(refreshIfVisible, intervalMs);
    document.addEventListener("visibilitychange", refreshIfVisible);
    window.addEventListener("focus", refreshIfVisible);

    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      window.removeEventListener("focus", refreshIfVisible);
    };
  }, [intervalMs, router]);
}
