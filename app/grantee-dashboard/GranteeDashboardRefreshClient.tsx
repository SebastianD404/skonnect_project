"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GranteeDashboardRefreshClient() {
  const router = useRouter();

  useEffect(() => {
    const refreshDashboard = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshDashboard();
      }
    };

    const handleWindowFocus = () => {
      refreshDashboard();
    };

    const intervalId = window.setInterval(refreshDashboard, 20000);
    window.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [router]);

  return null;
}
