"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const REFRESH_INTERVAL_MS = 15_000;
const MIN_REFRESH_GAP_MS = 5_000;

export default function GranteeDataRefresh() {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  useEffect(() => {
    lastRefreshAt.current = Date.now();
    const refreshVisiblePage = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastRefreshAt.current < MIN_REFRESH_GAP_MS) return;
      lastRefreshAt.current = Date.now();
      router.refresh();
    };

    const timer = window.setInterval(refreshVisiblePage, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshVisiblePage);
    document.addEventListener("visibilitychange", refreshVisiblePage);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshVisiblePage);
      document.removeEventListener("visibilitychange", refreshVisiblePage);
    };
  }, [router]);

  return null;
}
