"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown, Inbox } from "lucide-react";
import { useNotificationState } from "./NotificationProvider";
import { useAuth } from "./AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { createBrowserClient } from "@/lib/supabase/browser";

interface DashboardHeaderActionsProps {
  notifications?: string[];
  messages?: string[];
  supportInboxPath?: string;
}

type NotificationItem = {
  id: string;
  title: string;
  message: string;
  createdAt?: string;
  readAt?: string;
  link?: string;
  isRead?: boolean;
};

type SupportThread = {
  id: string;
  subject: string;
  createdAt: string;
  response: string | null;
  respondedAt: string | null;
  isResolved: boolean;
};

const INITIAL_NOTIFICATION_COUNT = 5;
const NOTIFICATION_PAGE_SIZE = 10;

function splitNotificationText(text: string) {
  const [firstLine = "", ...remainingLines] = text.split(/\r?\n/);
  if (remainingLines.length > 0) {
    return {
      title: firstLine.trim() || "Notification",
      message: remainingLines.join("\n").trim(),
    };
  }

  const separator = firstLine.indexOf(": ");
  if (separator > 0) {
    return {
      title: firstLine.slice(0, separator).trim(),
      message: firstLine.slice(separator + 2).trim(),
    };
  }
  return { title: "Notification", message: text };
}

function getSupportReplyKey(inquiry: SupportThread) {
  if (inquiry.respondedAt) return `inquiry-reply:${inquiry.id}:${inquiry.respondedAt}`;
  let hash = 0;
  for (const character of inquiry.response ?? "") {
    hash = (Math.imul(hash, 31) + character.charCodeAt(0)) | 0;
  }
  return `inquiry-reply:${inquiry.id}:${hash.toString(36)}`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function getString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function hasSameAvatarResource(first: string, second: string) {
  if (!first || !second) return false;

  try {
    const baseUrl = "https://skonnect.invalid";
    const firstUrl = new URL(first, baseUrl);
    const secondUrl = new URL(second, baseUrl);
    return firstUrl.origin === secondUrl.origin && firstUrl.pathname === secondUrl.pathname;
  } catch {
    return first === second;
  }
}

export function DashboardHeaderActions({ notifications = [], supportInboxPath = "/grantee-dashboard/inquiries" }: DashboardHeaderActionsProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user: authUser } = useAuth();
  const {
    readNotificationIds,
    unreadCount: liveUnreadCount,
    syncNotificationSnapshot,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useNotificationState();
  const [openPanel, setOpenPanel] = useState<"none" | "notifications" | "settings">("none");
  const [serverRole, setServerRole] = useState<string | undefined>(authUser?.role);
  const [profileId, setProfileId] = useState<string | null>(authUser?.id ?? null);
  const [profileName, setProfileName] = useState(
    authUser?.fullName || authUser?.email || "Your account"
  );
  const [profileEmail, setProfileEmail] = useState(authUser?.email || "");
  const [profileAvatar, setProfileAvatar] = useState(authUser?.avatarUrl || "");
  const profileAvatarRef = useRef(profileAvatar);
  const profileAvatarUserIdRef = useRef(authUser?.id ?? null);
  const updateProfileAvatar = useCallback((avatarUrl: string) => {
    profileAvatarRef.current = avatarUrl;
    setProfileAvatar(avatarUrl);
  }, []);
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [broadcastNotifications, setBroadcastNotifications] = useState<NotificationItem[]>([]);
  const [inAppNotifications, setInAppNotifications] = useState<NotificationItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [visibleCount, setVisibleCount] = useState(INITIAL_NOTIFICATION_COUNT);
  const [relativeTimeNow, setRelativeTimeNow] = useState<number | null>(null);
  const [notificationActionError, setNotificationActionError] = useState<string | null>(null);
  const [pulseUnreadBadge, setPulseUnreadBadge] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const notificationRefreshInFlight = useRef(false);
  const notificationRefreshQueuedRef = useRef(false);
  const notificationFetchController = useRef<AbortController | null>(null);
  const pendingReadsRef = useRef(new Set<string>());
  const previousUnreadNotificationIdsRef = useRef<Set<string> | null>(null);
  const previousUnreadCountRef = useRef<number | null>(null);
  const badgePulseTimerRef = useRef<number | null>(null);
  const isSupportInboxActive =
    pathname === supportInboxPath || pathname.startsWith(`${supportInboxPath}/`);

  const formatRelativeTime = (createdAt?: string) => {
    if (!createdAt) return "";
    if (relativeTimeNow === null) return new Date(createdAt).toLocaleDateString();
    const elapsedSeconds = Math.max(0, Math.floor((relativeTimeNow - new Date(createdAt).getTime()) / 1000));
    if (elapsedSeconds < 60) return "Just now";
    const elapsedMinutes = Math.floor(elapsedSeconds / 60);
    if (elapsedMinutes < 60) return `${elapsedMinutes}m`;
    const elapsedHours = Math.floor(elapsedMinutes / 60);
    if (elapsedHours < 24) return `${elapsedHours}h`;
    const elapsedDays = Math.floor(elapsedHours / 24);
    if (elapsedDays < 7) return `${elapsedDays}d`;
    const elapsedWeeks = Math.floor(elapsedDays / 7);
    if (elapsedWeeks < 5) return `${elapsedWeeks}w`;
    return new Date(createdAt).toLocaleDateString();
  };

  const formatFullDateTime = (createdAt: string) =>
    new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(createdAt));

  const updateLocalReadState = (notificationId: string, isRead: boolean, readAt?: string) => {
    const update = (items: NotificationItem[]) => items.map((item) =>
      item.id === notificationId
        ? { ...item, isRead, readAt: isRead ? readAt : undefined }
        : item
    );
    setInAppNotifications(update);
    setBroadcastNotifications(update);
  };

  const markNotificationItemRead = (notification: NotificationItem) => {
    if (
      !notification.isRead &&
      !readNotificationIds.has(notification.id) &&
      !pendingReadsRef.current.has(notification.id)
    ) {
      const readAt = new Date().toISOString();
      pendingReadsRef.current.add(notification.id);
      notificationFetchController.current?.abort();
      updateLocalReadState(notification.id, true, readAt);
      setNotificationActionError(null);
      void markNotificationAsRead(notification.id).then((success) => {
        if (!success) {
          updateLocalReadState(notification.id, false);
          setNotificationActionError("Could not mark this notification as read. Please try again.");
        }
      }).finally(() => {
        pendingReadsRef.current.delete(notification.id);
      });
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    setExpandedId((current) => current === notification.id ? null : notification.id);
    markNotificationItemRead(notification);
  };

  const handleMarkAllNotificationsAsRead = () => {
    const readAt = new Date().toISOString();
    const unreadNotifications = displayedNotifications
      .filter((notification) => !notification.isRead && !readNotificationIds.has(notification.id));
    const unreadIds = new Set(unreadNotifications.map((notification) => notification.id));
    pendingReadsRef.current.add("*");
    notificationFetchController.current?.abort();
    const optimisticallyMarkRead = (current: NotificationItem[]) => current.map((notification) =>
      unreadIds.has(notification.id) ? { ...notification, isRead: true, readAt } : notification
    );
    setInAppNotifications(optimisticallyMarkRead);
    setBroadcastNotifications(optimisticallyMarkRead);
    setNotificationActionError(null);
    void markAllNotificationsAsRead().then((success) => {
      if (success) return;
      const revert = (items: NotificationItem[]) => items.map((item) =>
        unreadIds.has(item.id) ? { ...item, isRead: false, readAt: undefined } : item
      );
      setInAppNotifications(revert);
      setBroadcastNotifications(revert);
      setNotificationActionError("Could not mark notifications as read. Please try again.");
    }).finally(() => {
      pendingReadsRef.current.delete("*");
    });
  };

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpenPanel("none");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPanel("none");
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => () => {
    if (badgePulseTimerRef.current !== null) {
      window.clearTimeout(badgePulseTimerRef.current);
    }
  }, []);

  useEffect(() => {
    async function reconcileProfile() {
      try {
        const res = await fetch('/api/session', { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        const serverUser = body.user;
        if (!serverUser) return; // not signed in

        const isNewUser = profileAvatarUserIdRef.current !== serverUser.id;
        profileAvatarUserIdRef.current = serverUser.id;
        setProfileId(serverUser.id);

        // Always sync profile name/email from server to avoid stale local data.
        if (serverUser.fullName) {
          localStorage.setItem('skonnect-profile-name', serverUser.fullName);
          setProfileName(serverUser.fullName);
        }
        if (serverUser.email) {
          localStorage.setItem('skonnect-profile-email', serverUser.email);
          setProfileEmail(serverUser.email);
        }

        // Prefer the server avatar, but retain the last known image during same-user refetches.
        const serverAvatar = serverUser.avatarUrl || serverUser.profilePhotoFallbackUrl;
        try { setServerRole(serverUser.role || ""); } catch {}
        if (serverAvatar) {
          const currentAvatar = profileAvatarRef.current;
          const avatarToKeep = !isNewUser && hasSameAvatarResource(currentAvatar, serverAvatar)
            ? currentAvatar
            : serverAvatar;
          try { localStorage.setItem('skonnect-avatar', avatarToKeep); } catch {}
          updateProfileAvatar(avatarToKeep);
        } else if (isNewUser) {
          try { localStorage.removeItem('skonnect-avatar'); } catch {}
          updateProfileAvatar('');
        }

        // Notify other tabs/components that profile changed
        window.dispatchEvent(new Event('skonnect-profile-updated'));

      } catch {
        // ignore
      }
    }

      reconcileProfile();

    function syncProfile(event: Event) {
      try {
        setProfileName(localStorage.getItem("skonnect-profile-name") || "Your account");
        setProfileEmail(localStorage.getItem("skonnect-profile-email") || "");
        if (event.type === "storage" && (event as StorageEvent).key === "skonnect-avatar") {
          updateProfileAvatar((event as StorageEvent).newValue || "");
          return;
        }

        const detail = event instanceof CustomEvent
          ? event.detail as { avatarUrl?: string | null } | undefined
          : undefined;
        if (detail && Object.prototype.hasOwnProperty.call(detail, "avatarUrl")) {
          updateProfileAvatar(detail.avatarUrl || "");
          return;
        }

        const storedAvatar = localStorage.getItem("skonnect-avatar");
        if (storedAvatar) updateProfileAvatar(storedAvatar);
      } catch {}
    }

    window.addEventListener("storage", syncProfile);
    window.addEventListener("skonnect-profile-updated", syncProfile as EventListener);

    return () => {
      window.removeEventListener("storage", syncProfile);
      window.removeEventListener("skonnect-profile-updated", syncProfile as EventListener);
        // Removed focus and visibility listeners and polling
    };
  }, [updateProfileAvatar]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setRelativeTimeNow(Date.now()));
    const timer = window.setInterval(() => setRelativeTimeNow(Date.now()), 60_000);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(timer);
    };
  }, []);

  const displayedNotifications: NotificationItem[] = [
    ...notifications.map<NotificationItem>((notification, index) => ({
      id: `provided:${index}:${notification}`,
      ...splitNotificationText(notification),
    })),
    ...inAppNotifications,
    ...broadcastNotifications,
  ].sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const filteredNotifications = filter === 'unread'
    ? displayedNotifications.filter((notification) =>
        !notification.isRead && !readNotificationIds.has(notification.id)
      )
    : displayedNotifications;
  const visibleNotifications = filteredNotifications.slice(0, visibleCount);
  const inquiryReplyCount = supportThreads.filter((inquiry) =>
    Boolean(inquiry.response) &&
    !inquiry.isResolved &&
    !readNotificationIds.has(getSupportReplyKey(inquiry))
  ).length;

  useEffect(() => {
    if ((serverRole !== "GRANTEE" && serverRole !== "YOUTH") || !profileId) return;

    let active = true;

    async function refreshGranteeMessages() {
      try {
        const [inquiriesResponse, messagesResponse, announcementsResponse, remindersResponse] = await Promise.all([
          fetch("/api/my/inquiries", { cache: "no-store" }),
          fetch("/api/my/messages", { cache: "no-store" }),
          fetch("/api/announcements", { cache: "no-store" }),
          fetch("/api/my/reminders", { cache: "no-store" }),
        ]);
        if (!active) return;

        const [inquiriesData, messagesData, announcementsData, remindersData]: unknown[] = await Promise.all([
          inquiriesResponse.ok ? inquiriesResponse.json() : { inquiries: [] },
          messagesResponse.ok ? messagesResponse.json() : { messages: [] },
          announcementsResponse.ok ? announcementsResponse.json() : [],
          remindersResponse.ok ? remindersResponse.json() : { reminders: [] },
        ]);
        const inquiryPayload = asRecord(inquiriesData);
        const messagePayload = asRecord(messagesData);
        const inquiryRows: unknown[] =
          inquiryPayload && Array.isArray(inquiryPayload.inquiries)
            ? inquiryPayload.inquiries
            : [];
        const messageRows: unknown[] =
          messagePayload && Array.isArray(messagePayload.messages)
            ? messagePayload.messages
            : [];
        const broadcastMessages = messageRows.flatMap((value): NotificationItem[] => {
          const item = asRecord(value);
          if (!item || (typeof item.id !== "string" && typeof item.id !== "number")) return [];
          const subject = getString(item.subject, "Message");
          return [{
            id: `message:${item.id}`,
            title: subject,
            message: getString(item.body),
            createdAt: getString(item.createdAt),
          }];
        });
        const supportThreads = inquiryRows.flatMap((value): SupportThread[] => {
          const item = asRecord(value);
          if (!item || typeof item.id !== "string") return [];
          return [{
            id: item.id,
            subject: getString(item.subject),
            createdAt: getString(item.createdAt),
            response: typeof item.response === "string" ? item.response : null,
            respondedAt: typeof item.respondedAt === "string" ? item.respondedAt : null,
            isResolved: item.isResolved === true,
          }];
        });
        setSupportThreads(supportThreads);
        setBroadcastNotifications(broadcastMessages);
        const announcementRows: unknown[] = Array.isArray(announcementsData)
          ? announcementsData
          : [];
        const announcementNotifications = announcementRows.flatMap((value): NotificationItem[] => {
          const item = asRecord(value);
          if (!item || (typeof item.id !== "string" && typeof item.id !== "number")) return [];
          return [{
            id: `announcement:${item.id}`,
            title: getString(item.title, "Announcement"),
            message: getString(item.content),
            createdAt: getString(item.publishedAt) || getString(item.createdAt),
          }];
        });
        const reminderPayload = asRecord(remindersData);
        const reminderRows: unknown[] =
          reminderPayload && Array.isArray(reminderPayload.reminders)
            ? reminderPayload.reminders
            : [];
        const reminderNotifications = reminderRows.flatMap((value): NotificationItem[] => {
          const item = asRecord(value);
          if (!item || (typeof item.id !== "string" && typeof item.id !== "number")) return [];
          const metadata = asRecord(item.metadata);
          const subject =
            getString(metadata?.subject) ||
            getString(item.targetType, "Reminder");
          const body =
            getString(metadata?.body) ||
            getString(metadata?.message) ||
            getString(item.channel, "You have a reminder.");
          return [{
            id: `reminder:${item.id}`,
            title: subject,
            message: body,
            createdAt: getString(item.createdAt) || getString(item.sentAt),
          }];
        });
        const refreshedItems = new Map(reminderNotifications.map((item) => [item.id, item]));
        setInAppNotifications((current) => [
          ...current.filter((item) =>
            !item.id.startsWith("announcement:") &&
            !item.id.startsWith("reminder:")
          ),
          ...announcementNotifications,
          ...refreshedItems.values(),
        ]);
      } catch {
        // Keep the last successful message state when a refresh is unavailable.
      } finally {
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") refreshGranteeMessages();
    }

    refreshGranteeMessages();
    const refreshTimer = window.setInterval(refreshGranteeMessages, 30000);
    window.addEventListener("focus", refreshGranteeMessages);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshGranteeMessages);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [profileId, serverRole]);

  useEffect(() => {
    if ((serverRole !== "GRANTEE" && serverRole !== "YOUTH") || !profileId) return;

    const userId = profileId;
    let active = true;
    let realtimeClient: ReturnType<typeof createBrowserClient> | null = null;
    let realtimeChannel: ReturnType<ReturnType<typeof createBrowserClient>["channel"]> | null = null;
    notificationRefreshQueuedRef.current = false;
    previousUnreadNotificationIdsRef.current = null;
    previousUnreadCountRef.current = null;
    if (badgePulseTimerRef.current !== null) {
      window.clearTimeout(badgePulseTimerRef.current);
      badgePulseTimerRef.current = null;
    }

    async function refreshGranteeNotifications() {
      if (
        !active ||
        document.visibilityState !== "visible" ||
        pendingReadsRef.current.size > 0
      ) return;
      if (notificationRefreshInFlight.current) {
        notificationRefreshQueuedRef.current = true;
        return;
      }
      notificationRefreshInFlight.current = true;
      const controller = new AbortController();
      notificationFetchController.current = controller;
      try {
        const response = await fetch("/api/my/notifications", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!active || controller.signal.aborted || pendingReadsRef.current.size > 0 || !response.ok) return;
        const payload = asRecord(await response.json());
        if (!active || controller.signal.aborted || pendingReadsRef.current.size > 0) return;
        const rows: unknown[] = payload && Array.isArray(payload.notifications)
          ? payload.notifications
          : [];
        const items = rows.flatMap((value): NotificationItem[] => {
          const item = asRecord(value);
          if (!item || typeof item.id !== "string" || typeof item.text !== "string") return [];
          const parsedText = splitNotificationText(item.text);
          return [{
            id: item.id,
            title: getString(item.title, parsedText.title),
            message: getString(item.message, parsedText.message),
            createdAt: typeof item.createdAt === "string" ? item.createdAt : undefined,
            readAt: typeof item.readAt === "string" ? item.readAt : undefined,
            link: typeof item.href === "string"
              ? item.href
              : item.id.startsWith("submission:")
                ? "/grantee-dashboard/documents"
                : undefined,
            isRead: item.isRead === true,
          }];
        });
        const unreadItems = items.filter((item) => !item.isRead);
        const unreadCount = typeof payload?.unreadCount === "number"
          ? payload.unreadCount
          : unreadItems.length;
        const previousUnreadIds = previousUnreadNotificationIdsRef.current;
        const previousUnreadCount = previousUnreadCountRef.current;
        const newlyArrived = previousUnreadIds === null
          ? []
          : unreadItems.filter((item) => !previousUnreadIds.has(item.id));
        const arrival = newlyArrived[0] ??
          (previousUnreadCount !== null && unreadCount > previousUnreadCount
            ? unreadItems[0]
            : undefined);
        previousUnreadNotificationIdsRef.current = new Set(
          unreadItems.map((item) => item.id),
        );
        previousUnreadCountRef.current = unreadCount;

        const readIds = payload && Array.isArray(payload.readIds)
          ? payload.readIds.filter((value): value is string => typeof value === "string")
          : [];
        syncNotificationSnapshot(unreadCount, readIds);

        setInAppNotifications((current) => [
          ...current.filter((item) =>
            item.id.startsWith("announcement:") || item.id.startsWith("reminder:")
          ),
          ...items,
        ]);

        if (arrival) {
          setPulseUnreadBadge(true);
          if (badgePulseTimerRef.current !== null) {
            window.clearTimeout(badgePulseTimerRef.current);
          }
          badgePulseTimerRef.current = window.setTimeout(() => {
            setPulseUnreadBadge(false);
            badgePulseTimerRef.current = null;
          }, 1400);
          router.refresh();
        }
      } catch {
        // Keep the last successful notification state when the background request is unavailable.
      } finally {
        notificationRefreshInFlight.current = false;
        if (notificationFetchController.current === controller) {
          notificationFetchController.current = null;
        }
        if (notificationRefreshQueuedRef.current) {
          notificationRefreshQueuedRef.current = false;
          if (active && document.visibilityState === "visible") {
            void refreshGranteeNotifications();
          }
        }
      }
    }

    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") void refreshGranteeNotifications();
    };

    void refreshGranteeNotifications();
    const timer = window.setInterval(refreshWhenVisible, 10000);
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      realtimeClient = createBrowserClient();
      realtimeChannel = realtimeClient
        .channel(`user-notifications-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notifications",
            filter: `userId=eq.${userId}`,
          },
          () => {
            if (document.visibilityState !== "visible") return;
            void refreshGranteeNotifications();
          },
        )
        .subscribe();
    }

    return () => {
      active = false;
      window.clearInterval(timer);
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
      notificationFetchController.current?.abort();
      if (realtimeClient && realtimeChannel) {
        void realtimeClient.removeChannel(realtimeChannel);
      }
    };
  }, [profileId, router, serverRole, syncNotificationSnapshot]);

  const markSupportInboxViewed = () => {
    const keys = supportThreads
      .filter((inquiry) => Boolean(inquiry.response))
      .map(getSupportReplyKey);
    void Promise.all(keys.map(markNotificationAsRead));
  };

  return (
    <div className="relative flex items-center gap-3" ref={wrapperRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            const isOpening = openPanel !== "notifications";
            setOpenPanel(isOpening ? "notifications" : "none");
            if (isOpening && liveUnreadCount > 0) {
              handleMarkAllNotificationsAsRead();
            }
          }}
          className="relative rounded-2xl border border-slate-200 bg-white/95 p-3 text-slate-600 shadow-sm transition hover:border-[#0F3D5C]/40 hover:bg-[#0F3D5C]/5 hover:text-[#0F3D5C]"
          aria-expanded={openPanel === "notifications"}
        >
          <span className="sr-only">Notifications</span>
          {openPanel === "notifications" ? (
            // filled bell using the same path as the outline for visual consistency
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#0F3D5C]" fill="currentColor" aria-hidden>
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          )}
          {liveUnreadCount > 0 && (
            <span
              aria-label={`${liveUnreadCount} unread notifications`}
              className={`absolute -top-1 -right-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none tabular-nums text-white ring-2 ring-white shadow-sm ${pulseUnreadBadge ? "animate-pulse" : ""}`}
            >
              {liveUnreadCount > 99 ? "99+" : liveUnreadCount}
            </span>
          )}
        </button>

        {openPanel === "notifications" && (
          <div className="absolute right-0 z-50 mt-2 flex max-h-[600px] w-96 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-slate-900 shadow-2xl">
            <div className="shrink-0 bg-white/95 px-4 py-3 backdrop-blur-sm">
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
            </div>
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-gray-100 px-3 py-2">
              <div className="flex items-center gap-1">
                {(['all', 'unread'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => {
                      setFilter(option);
                      setVisibleCount(INITIAL_NOTIFICATION_COUNT);
                    }}
                    className={filter === option
                      ? 'rounded-full bg-blue-100 px-4 py-1.5 text-sm font-semibold text-blue-600'
                      : 'rounded-full px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100'}
                  >
                    {option === 'all' ? 'All' : 'Unread'}
                  </button>
                ))}
              </div>
              {liveUnreadCount > 0 ? (
                <button
                  type="button"
                  onClick={handleMarkAllNotificationsAsRead}
                  className="shrink-0 text-xs font-medium text-[#0d5c75] hover:underline"
                >
                  Mark all as read
                </button>
              ) : null}
            </div>
            {notificationActionError ? (
              <p className="px-4 pt-2 text-xs text-rose-700" role="status">{notificationActionError}</p>
            ) : null}
            <div className="max-h-[420px] min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300">
              {visibleNotifications.length > 0 ? (
                <div className="space-y-2">
                {visibleNotifications.map((notification, idx) => {
                  const isRead = notification.isRead || readNotificationIds.has(notification.id);
                  const isExpanded = expandedId === notification.id;
                  const isLongMessage = notification.message.length > 100;
                  const cardClassName = `flex min-w-0 items-start gap-3 rounded-xl p-3 text-left text-sm ${
                    isRead ? "bg-white text-slate-600" : "bg-sky-50/40 text-slate-700"
                  }`;
                  return (
                    <div
                      key={`${notification.id}-${idx}`}
                      onClick={() => handleNotificationClick(notification)}
                      className={`${cardClassName} cursor-pointer transition-colors ${isRead ? "hover:bg-gray-50" : "hover:bg-sky-100/60"}`}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true">
                        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                          <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.83V3a1.5 1.5 0 0 0-3 0v1.17A7 7 0 0 0 5 11v5l-1.5 1.5V19h17v-1.5L19 16Z" />
                        </svg>
                      </span>
                      <div className="min-w-0 flex-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleNotificationClick(notification);
                          }}
                          aria-expanded={isExpanded}
                          className="block w-full text-left focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C]"
                        >
                          <p className="flex items-center gap-1.5 break-words text-sm font-semibold text-slate-900">
                            {!isRead ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-600" aria-label="Unread" /> : null}
                            {notification.title}
                          </p>
                          <p className={`mt-1 break-words text-xs leading-relaxed text-slate-600 ${
                            isExpanded ? "whitespace-pre-line" : "line-clamp-2"
                          }`}>
                            {notification.message}
                          </p>
                        </button>
                        <div className="mt-2 flex items-center justify-between gap-2 text-xs">
                          <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-slate-400">
                            {notification.createdAt ? (
                              <>
                                <span>{formatRelativeTime(notification.createdAt)}</span>
                                {isExpanded ? (
                                  <>
                                    <span aria-hidden="true">·</span>
                                    <time dateTime={notification.createdAt}>
                                      {formatFullDateTime(notification.createdAt)}
                                    </time>
                                  </>
                                ) : null}
                              </>
                            ) : null}
                          </span>
                          <span className="flex shrink-0 items-center gap-3">
                            {isLongMessage ? (
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  handleNotificationClick(notification);
                                }}
                                aria-expanded={isExpanded}
                                className="inline-flex items-center gap-1 font-medium text-slate-500 transition hover:text-slate-800"
                              >
                                {isExpanded ? "Show less" : "Show more"}
                                <ChevronDown
                                  className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                                  aria-hidden="true"
                                />
                              </button>
                            ) : null}
                            {notification.link ? (
                              <Link
                                href={notification.link}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!isRead) handleNotificationClick(notification);
                                  setExpandedId(null);
                                  setOpenPanel("none");
                                }}
                                className="font-semibold text-[#0F3D5C] hover:underline"
                              >
                                View update →
                              </Link>
                            ) : null}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
                  <svg viewBox="0 0 24 24" className="h-8 w-8 text-slate-300" fill="currentColor" aria-hidden="true">
                    <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.83V3a1.5 1.5 0 0 0-3 0v1.17A7 7 0 0 0 5 11v5l-1.5 1.5V19h17v-1.5L19 16Z" />
                  </svg>
                  <p className="mt-3 text-sm text-slate-500">You&apos;re all caught up! No new notifications.</p>
                </div>
              )}
            </div>
            {visibleNotifications.length < filteredNotifications.length && (
              <div className="shrink-0 border-t border-gray-100 bg-white p-3">
                <button
                  type="button"
                  onClick={() => {
                    setVisibleCount((current) => current + NOTIFICATION_PAGE_SIZE);
                  }}
                  className="w-full rounded-lg bg-slate-100 py-2 text-sm font-semibold text-slate-800 transition-[transform,background-color,box-shadow] duration-150 hover:bg-slate-200 active:scale-[0.98] active:bg-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2"
                >
                  Show {Math.min(NOTIFICATION_PAGE_SIZE, filteredNotifications.length - visibleNotifications.length)} more
                  <span className="ml-1 font-normal text-slate-500">
                    ({filteredNotifications.length - visibleNotifications.length} remaining)
                  </span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <Link
        href={supportInboxPath}
        onClick={markSupportInboxViewed}
        className={`relative inline-flex rounded-2xl border p-3 shadow-sm transition ${
          isSupportInboxActive
            ? "border-slate-300/90 bg-slate-200/90 text-slate-900"
            : "border-slate-200 bg-white/95 text-slate-600 hover:border-[#0F3D5C]/40 hover:bg-[#0F3D5C]/5 hover:text-[#0F3D5C]"
        }`}
        aria-label={inquiryReplyCount > 0 ? `Support Inbox, ${inquiryReplyCount} replies` : "Support Inbox"}
        title="Support Inbox"
        aria-current={isSupportInboxActive ? "page" : undefined}
      >
        <Inbox className="h-5 w-5" aria-hidden="true" />
        {inquiryReplyCount > 0 && (
          <span
            aria-label={`${inquiryReplyCount} unread replies`}
            className="absolute -top-1 -right-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none tabular-nums text-white ring-2 ring-white shadow-sm"
          >
            {inquiryReplyCount > 99 ? "99+" : inquiryReplyCount}
          </span>
        )}
      </Link>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenPanel(openPanel === "settings" ? "none" : "settings")}
          className="inline-flex items-center gap-2 rounded-full bg-white/95 px-2 py-2 text-left text-slate-700 shadow-sm transition hover:bg-slate-50"
          aria-expanded={openPanel === "settings"}
          aria-label={`Open account menu for ${profileName}`}
          title={profileName}
        >
          <Avatar
            src={profileAvatar}
            alt={profileName}
            size={32}
            className="bg-[#0F3D5C] text-white"
          />

          <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {openPanel === "settings" && (
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="p-2">
              <div className="flex items-center gap-3 rounded-2xl px-4 py-4">
                <Avatar
                  src={profileAvatar}
                  alt={profileName}
                  size={40}
                  className="bg-[#0F3D5C] text-white"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{profileName}</p>
                  <p className="truncate text-xs text-slate-500">{profileEmail}</p>
                </div>
              </div>

              <div className="my-1 border-t border-slate-200" />

              <Link href="/profile" className="block rounded-2xl px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50">
                Settings
              </Link>

              <div className="my-1 border-t border-slate-200" />

              <Link href="/logout" className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                Sign out
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
