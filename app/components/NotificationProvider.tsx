"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

type NotificationContextValue = {
  readNotificationIds: Set<string>;
  unreadCount: number;
  refreshNotifications: () => Promise<void>;
  markNotificationAsRead: (notificationId: string) => Promise<boolean>;
  markAllNotificationsAsRead: () => Promise<boolean>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [readNotificationIds, setReadNotificationIds] = useState<Set<string>>(new Set());
  const [serverUnreadCount, setServerUnreadCount] = useState<number | null>(null);
  const mutationVersion = useRef(0);
  const pendingReadIds = useRef(new Set<string>());

  const refreshNotifications = useCallback(async () => {
    if (
      (typeof document !== "undefined" && document.visibilityState !== "visible") ||
      pendingReadIds.current.size > 0
    ) return;
    const requestVersion = mutationVersion.current;
    try {
      const response = await fetch("/api/my/notifications", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json();
      if (requestVersion !== mutationVersion.current || pendingReadIds.current.size > 0) return;
      if (Array.isArray(data.readIds)) {
        setReadNotificationIds(new Set(
          data.readIds.filter((value: unknown): value is string => typeof value === "string"),
        ));
      }
      if (typeof data.unreadCount === "number") {
        setServerUnreadCount(data.unreadCount);
      }
    } catch {
      // Keep the last known notification state when polling is unavailable.
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshNotifications();
    };

    async function startPollingIfAuthenticated() {
      try {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        if (!sessionResponse.ok) return;
        const sessionData = await sessionResponse.json();
        if (cancelled || !sessionData.user) return;

        await refreshNotifications();
        if (cancelled) return;
        timer = window.setInterval(refreshWhenVisible, 5000);
        window.addEventListener("focus", refreshWhenVisible);
        document.addEventListener("visibilitychange", refreshWhenVisible);
      } catch {
        // Keep notification polling disabled when session lookup is unavailable.
      }
    }

    void startPollingIfAuthenticated();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [refreshNotifications]);

  const markNotificationAsRead = useCallback(async (notificationId: string) => {
    if (pendingReadIds.current.has(notificationId)) return true;
    pendingReadIds.current.add(notificationId);
    const mutationId = ++mutationVersion.current;
    let confirmedUnreadCount: number | null = null;
    setReadNotificationIds((current) => new Set(current).add(notificationId));
    if (!notificationId.startsWith("inquiry-reply:")) {
      setServerUnreadCount((current) => current === null ? null : Math.max(0, current - 1));
    }
    try {
      const response = await fetch("/api/my/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: notificationId }),
      });
      if (!response.ok) throw new Error("Unable to mark notification as read.");
      const payload: unknown = await response.json();
      if (typeof payload === "object" && payload !== null) {
        if ("unreadCount" in payload && typeof payload.unreadCount === "number") {
          confirmedUnreadCount = payload.unreadCount;
        }
        if ("readIds" in payload && Array.isArray(payload.readIds)) {
          const readIds = payload.readIds.filter(
            (value): value is string => typeof value === "string",
          );
          setReadNotificationIds((current) => new Set([...current, ...readIds]));
        }
      }
      return true;
    } catch {
      setReadNotificationIds((current) => {
        const next = new Set(current);
        next.delete(notificationId);
        return next;
      });
      if (!notificationId.startsWith("inquiry-reply:")) {
        setServerUnreadCount((current) => current === null ? null : current + 1);
      }
      return false;
    } finally {
      pendingReadIds.current.delete(notificationId);
      if (
        pendingReadIds.current.size === 0 &&
        mutationId === mutationVersion.current &&
        confirmedUnreadCount !== null
      ) {
        setServerUnreadCount(confirmedUnreadCount);
      }
      if (pendingReadIds.current.size === 0) void refreshNotifications();
    }
  }, [refreshNotifications]);

  const markAllNotificationsAsRead = useCallback(async () => {
    if (pendingReadIds.current.has("*")) return true;
    const previousUnreadCount = serverUnreadCount;
    const mutationId = ++mutationVersion.current;
    pendingReadIds.current.add("*");
    setServerUnreadCount(0);
    try {
      const response = await fetch("/api/my/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      });
      if (!response.ok) throw new Error("Unable to mark notifications as read.");
      const payload: unknown = await response.json();
      if (
        mutationId === mutationVersion.current &&
        typeof payload === "object" &&
        payload !== null &&
        "unreadCount" in payload &&
        typeof payload.unreadCount === "number"
      ) {
        setServerUnreadCount(payload.unreadCount);
      }
      return true;
    } catch {
      if (mutationId === mutationVersion.current) {
        setServerUnreadCount(previousUnreadCount);
      }
      return false;
    } finally {
      pendingReadIds.current.delete("*");
      if (mutationId === mutationVersion.current) void refreshNotifications();
    }
  }, [serverUnreadCount, refreshNotifications]);

  const value = useMemo<NotificationContextValue>(() => ({
    readNotificationIds,
    unreadCount: serverUnreadCount ?? 0,
    refreshNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  }), [readNotificationIds, serverUnreadCount, refreshNotifications, markNotificationAsRead, markAllNotificationsAsRead]);

  return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotificationState() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotificationState must be used within NotificationProvider");
  return context;
}
