"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type NotificationContextValue = {
  readNotificationIds: Set<string>;
  unreadCount: number;
  markNotificationAsRead: (notificationId: string) => Promise<void>;
  markAllNotificationsAsRead: (notificationIds: string[]) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [serverUnreadCount, setServerUnreadCount] = useState<number | null>(null);
  const mutationVersion = useRef(0);

  const refresh = async () => {
    const requestVersion = mutationVersion.current;
    try {
      const [readResponse, countResponse] = await Promise.all([
        fetch("/api/my/notifications/read", { cache: "no-store" }),
        fetch("/api/my/notifications/unread-count", { cache: "no-store" }),
      ]);
      const readData = readResponse.ok ? await readResponse.json() : null;
      const countData = countResponse.ok ? await countResponse.json() : null;
      if (requestVersion !== mutationVersion.current) return;
      if (Array.isArray(readData?.notificationIds)) {
        setReadNotificationIds(new Set(readData.notificationIds));
      }
      if (typeof countData?.count === "number") {
        setServerUnreadCount(countData.count);
      }
    } catch {
      // Keep the last known notification state when polling is unavailable.
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function startPollingIfAuthenticated() {
      try {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        if (!sessionResponse.ok) return;
        const sessionData = await sessionResponse.json();
        if (cancelled || !sessionData.user) return;

        await refresh();
        if (cancelled) return;
        timer = window.setInterval(refresh, 30000);
        window.addEventListener("focus", refresh);
      } catch {
        // Keep notification polling disabled when session lookup is unavailable.
      }
    }

    void startPollingIfAuthenticated();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    mutationVersion.current += 1;
    setReadNotificationIds((current) => new Set(current).add(notificationId));
    setServerUnreadCount((current) => current === null ? 0 : Math.max(0, current - 1));
    try {
      await fetch("/api/my/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationId }),
      });
    } catch {
      // Keep the optimistic state when the background update is unavailable.
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async (notificationIds: string[]) => {
    mutationVersion.current += 1;
    setReadNotificationIds((current) => new Set([...current, ...notificationIds]));
    setServerUnreadCount(0);
    try {
      await fetch("/api/my/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notificationIds }),
      });
    } catch {
      // Keep the optimistic state when the background update is unavailable.
    }
  }, []);

  const value = useMemo<NotificationContextValue>(() => ({
    readNotificationIds,
    unreadCount: serverUnreadCount ?? 0,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  }), [readNotificationIds, serverUnreadCount, markNotificationAsRead, markAllNotificationsAsRead]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationState() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotificationState must be used within NotificationProvider");
  return context;
}
