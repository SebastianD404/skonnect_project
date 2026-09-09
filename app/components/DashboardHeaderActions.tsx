"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNotificationState } from "./NotificationProvider";

interface DashboardHeaderActionsProps {
  notifications?: string[];
  messages?: string[];
  requiredRole?: string | string[];
}

type NotificationItem = {
  id: string;
  text: string;
  createdAt?: string;
};

type SupportThread = {
  id: string;
  subject: string;
  createdAt: string;
  response: string | null;
  isResolved: boolean;
};

type ThreadMessage = {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
};

export function DashboardHeaderActions({ notifications = [], messages = [], requiredRole }: DashboardHeaderActionsProps) {
  const {
    readNotificationIds,
    unreadCount: liveUnreadCount,
    syncNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead,
  } = useNotificationState();
  const [openPanel, setOpenPanel] = useState<"none" | "notifications" | "messages" | "settings">("none");
  const [serverRole, setServerRole] = useState<string | undefined>(undefined);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("Your account");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [supportThreads, setSupportThreads] = useState<SupportThread[]>([]);
  const [broadcastNotifications, setBroadcastNotifications] = useState<NotificationItem[]>([]);
  const [inAppNotifications, setInAppNotifications] = useState<NotificationItem[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [selectedThread, setSelectedThread] = useState<SupportThread | null>(null);
  const [threadMessages, setThreadMessages] = useState<ThreadMessage[]>([]);
  const [replyText, setReplyText] = useState("");
  const [loadingThread, setLoadingThread] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<NotificationItem | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [visibleCount, setVisibleCount] = useState(3);
  const [hasExpandedNotifications, setHasExpandedNotifications] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const hasRequestedRead = useRef(false);

  const formatRelativeTime = (createdAt?: string) => {
    if (!createdAt) return "";
    const elapsedSeconds = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 1000));
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

  const truncateMessage = (text: string, limit: number = 160) => {
    if (!text) return '';
    return text.length > limit ? text.substring(0, limit).trim() + '...' : text;
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    void markNotificationAsRead(notification.id);
    setOpenPanel("none");
    setSelectedNotification(notification);
  };

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpenPanel("none");
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenPanel("none");
        setSelectedNotification(null);
      }
    }

    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!profileId) return;
    try {
      const state = readStorageState(profileId);
      if (!state) return;
      setClearedNotifications(state.clearedNotifications);
      setClearedMessages(state.clearedMessages);
      setLastSeenNotificationsCount(state.lastSeenNotificationsCount);
      setLastSeenMessagesCount(state.lastSeenMessagesCount);

      if (state.clearedNotifications) {
        setUnreadNotifications(0);
      }
      if (state.clearedMessages) {
        setUnreadMessages(0);
      }
    } catch {
      // ignore storage read errors
    }
  }, [profileId]);

  useEffect(() => {
    async function reconcileProfile() {
      try {
        const res = await fetch('/api/session', { cache: 'no-store' });
        if (!res.ok) return;
        const body = await res.json();
        const serverUser = body.user;
        if (!serverUser) return; // not signed in

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

        // Prefer server-side avatar if present. If server has no avatar, remove any
        // locally-stored avatar to avoid showing another user's picture.
        const serverAvatar = serverUser.avatarUrl;
        try { setServerRole(serverUser.role || ""); } catch {}
        if (serverAvatar) {
          try { localStorage.setItem('skonnect-avatar', serverAvatar); } catch {}
          setProfileAvatar(serverAvatar);
        } else {
          try { localStorage.removeItem('skonnect-avatar'); } catch {}
          setProfileAvatar('');
        }

        // Notify other tabs/components that profile changed
        window.dispatchEvent(new Event('skonnect-profile-updated'));

        if (serverUser.role === 'GRANTEE') {
          try {
            const remindersRes = await fetch('/api/my/reminders', { cache: 'no-store' });
            if (remindersRes.ok) {
              const data = await remindersRes.json();
              const reminders = (data.reminders || []).map((item: any) => {
                const subject = item.metadata?.subject || item.targetType || "Reminder";
                const body = item.metadata?.body || item.metadata?.message || item.channel || "You have a reminder.";
                return { id: `reminder:${item.id}`, text: `${subject}: ${body}`, createdAt: item.createdAt || item.sentAt };
              });
              setInAppNotifications(reminders);
            }
          } catch {
            // ignore reminder fetch errors
          }
        }
      } catch (err) {
        // ignore
      }
    }

      reconcileProfile();

    function syncProfile() {
      try {
        setProfileName(localStorage.getItem("skonnect-profile-name") || "Your account");
        setProfileEmail(localStorage.getItem("skonnect-profile-email") || "");
        setProfileAvatar(localStorage.getItem("skonnect-avatar") || "");
      } catch (error) {}
    }

    syncProfile();
    window.addEventListener("storage", syncProfile);
    window.addEventListener("skonnect-profile-updated", syncProfile as EventListener);

    return () => {
      window.removeEventListener("storage", syncProfile);
      window.removeEventListener("skonnect-profile-updated", syncProfile as EventListener);
        // Removed focus and visibility listeners and polling
    };
  }, []);

  // If this header is rendered on a role-protected page, ensure the current
  // server session matches the required role. If not, clear the session and
  // redirect to login so the user can authenticate with the appropriate account.
  useEffect(() => {
    if (!requiredRole) return;
    if (serverRole === undefined) return; // not yet known

    const required = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    if (serverRole && !required.includes(serverRole)) {
      // sign out on server and redirect
      (async () => {
        try {
          await fetch('/api/auth/signout', { method: 'POST' });
        } catch (e) {}
        window.location.href = '/login';
      })();
    }
  }, [serverRole, requiredRole]);

  const initials =
    profileName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  const displayedNotifications: NotificationItem[] = [
    ...notifications.map<NotificationItem>((notification, index) => ({ id: `provided:${index}:${notification}`, text: notification })),
    ...inAppNotifications,
    ...broadcastNotifications,
  ].sort((a, b) => {
    if (!a.createdAt && !b.createdAt) return 0;
    if (!a.createdAt) return 1;
    if (!b.createdAt) return -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
  const filteredNotifications = filter === 'unread'
    ? displayedNotifications.filter((notification) => !readNotificationIds.has(notification.id))
    : displayedNotifications;
  const visibleNotifications = filteredNotifications.slice(0, visibleCount);
  const notificationSignature = displayedNotifications.map((notification) => notification.id).join("|");
  const notificationCount = displayedNotifications.length;
  const messageCount = supportThreads.length;
  const [unreadNotifications, setUnreadNotifications] = useState<number>(notifications?.length ?? 0);
  const [unreadMessages, setUnreadMessages] = useState<number>(() => supportThreads.length);
  const [clearedNotifications, setClearedNotifications] = useState(false);
  const [clearedMessages, setClearedMessages] = useState(false);
  const [lastSeenNotificationsCount, setLastSeenNotificationsCount] = useState<number | null>(null);
  const [lastSeenMessagesCount, setLastSeenMessagesCount] = useState<number | null>(null);
  const STORAGE_KEY_BASE = "skonnect-dashboard-badge-state";

  useEffect(() => {
    syncNotifications(displayedNotifications);
  // The signature prevents the shared count update from retriggering on every render.
  // The provider separately reacts when its read-ID set changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notificationSignature, readNotificationIds, syncNotifications]);

  useEffect(() => {
    const isOpen = openPanel === "notifications";
    if (!isOpen) {
      hasRequestedRead.current = false;
      return;
    }

    if (liveUnreadCount > 0 && !hasRequestedRead.current) {
      hasRequestedRead.current = true;
      void markAllNotificationsAsRead(displayedNotifications.map((notification) => notification.id));
    }
    // The signature changes when new items arrive, but the ref prevents a
    // second bulk mutation during the same open session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openPanel, liveUnreadCount, notificationSignature, markAllNotificationsAsRead]);

  const getStorageKey = (userId: string | null) => {
    return userId ? `${STORAGE_KEY_BASE}:${userId}` : STORAGE_KEY_BASE;
  };

  const readStorageState = (userId: string | null) => {
    try {
      const raw = localStorage.getItem(getStorageKey(userId));
      if (!raw) return null;
      return JSON.parse(raw) as {
        clearedNotifications: boolean;
        clearedMessages: boolean;
        lastSeenNotificationsCount: number | null;
        lastSeenMessagesCount: number | null;
      };
    } catch {
      return null;
    }
  };

  const writeStorageState = (
    state: {
      clearedNotifications: boolean;
      clearedMessages: boolean;
      lastSeenNotificationsCount: number | null;
      lastSeenMessagesCount: number | null;
    },
    userId: string | null,
  ) => {
    try {
      localStorage.setItem(getStorageKey(userId), JSON.stringify(state));
    } catch {
      // ignore storage errors
    }
  };

  useEffect(() => {
    if (serverRole !== "GRANTEE" || !profileId) return;

    let active = true;

    async function refreshGranteeMessages() {
      setLoadingMessages(true);
      try {
        const [inquiriesResponse, messagesResponse, announcementsResponse] = await Promise.all([
          fetch("/api/my/inquiries", { cache: "no-store" }),
          fetch("/api/my/messages", { cache: "no-store" }),
          fetch("/api/announcements", { cache: "no-store" }),
        ]);
        if (!active) return;

        const inquiriesData = inquiriesResponse.ok ? await inquiriesResponse.json() : { inquiries: [] };
        const messagesData = messagesResponse.ok ? await messagesResponse.json() : { messages: [] };
        const announcementsData = announcementsResponse.ok ? await announcementsResponse.json() : [];
        const broadcastMessages = (messagesData.messages || [])
          .map((item: any) => ({ id: `message:${item.id}`, text: `${item.subject}: ${item.body}`, createdAt: item.createdAt }));

        setSupportThreads((inquiriesData.inquiries || []).map((item: any) => ({
          id: item.id,
          subject: item.subject,
          createdAt: item.createdAt,
          response: item.response ?? null,
          isResolved: Boolean(item.isResolved),
        })));
        setBroadcastNotifications(broadcastMessages);
        const announcementNotifications = (Array.isArray(announcementsData) ? announcementsData : [])
          .map((item: any) => ({ id: `announcement:${item.id}`, text: `Announcement: ${item.title}: ${item.content}`, createdAt: item.publishedAt || item.createdAt }));
        setInAppNotifications((current) => [
          ...current.filter((item) => !item.text.startsWith("Announcement: ")),
          ...announcementNotifications,
        ]);
      } catch {
        // Keep the last successful message state when a refresh is unavailable.
      } finally {
        if (active) setLoadingMessages(false);
      }
    }

    function refreshWhenVisible() {
      if (document.visibilityState === "visible") refreshGranteeMessages();
    }

    refreshGranteeMessages();
    const refreshTimer = window.setInterval(refreshGranteeMessages, 10000);
    window.addEventListener("focus", refreshGranteeMessages);
    document.addEventListener("visibilitychange", refreshWhenVisible);

    return () => {
      active = false;
      window.clearInterval(refreshTimer);
      window.removeEventListener("focus", refreshGranteeMessages);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
  }, [profileId, serverRole]);

  // Sync notifications count only when new items arrive (increase). Clearing hides badge until new items.
  useEffect(() => {
    if (!profileId) return;
    const next = notificationCount;
    if (clearedNotifications) {
      // If the user cleared notifications, only consider counts greater than
      // the last seen server count at the time of clearing as new.
      if (lastSeenNotificationsCount === null) {
        setLastSeenNotificationsCount(next);
      } else if (next > lastSeenNotificationsCount) {
        setUnreadNotifications(next);
        setClearedNotifications(false);
        setLastSeenNotificationsCount(null);
      }
    } else {
      if (next > unreadNotifications) {
        setUnreadNotifications(next);
        setClearedNotifications(false);
      } else if (unreadNotifications === undefined) {
        setUnreadNotifications(next);
      }
    }

    writeStorageState({
      clearedNotifications,
      clearedMessages,
      lastSeenNotificationsCount,
      lastSeenMessagesCount,
    }, profileId);
  }, [notificationCount, clearedNotifications, clearedMessages, lastSeenNotificationsCount, lastSeenMessagesCount, profileId, unreadNotifications]);

  // Sync messages count only when new items arrive.
  useEffect(() => {
    if (!profileId) return;
    const next = messageCount;
    if (clearedMessages) {
      if (lastSeenMessagesCount === null) {
        setLastSeenMessagesCount(next);
      } else if (next > lastSeenMessagesCount) {
        setUnreadMessages(next);
        setClearedMessages(false);
        setLastSeenMessagesCount(null);
      }
    } else {
      if (next > unreadMessages) {
        setUnreadMessages(next);
        setClearedMessages(false);
      }
    }

    writeStorageState({
      clearedNotifications,
      clearedMessages,
      lastSeenNotificationsCount,
      lastSeenMessagesCount,
    }, profileId);
  }, [messageCount, clearedNotifications, clearedMessages, lastSeenNotificationsCount, lastSeenMessagesCount, profileId, unreadMessages]);
  async function openThread(thread: SupportThread) {
    setOpenPanel("none");
    setSelectedThread(thread);
    setLoadingThread(true);
    try {
      const response = await fetch(`/api/my/inquiries/${thread.id}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load conversation.");
      setThreadMessages(data.inquiry?.thread ?? []);
    } catch {
      setThreadMessages([]);
    } finally {
      setLoadingThread(false);
    }
  }

  async function sendThreadReply() {
    if (!selectedThread || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const response = await fetch(`/api/my/inquiries/${selectedThread.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to send reply.");
      setThreadMessages((current) => [...current, data.reply]);
      setReplyText("");
      setSupportThreads((current) => current.map((item) => item.id === selectedThread.id ? { ...item, response: null, isResolved: false } : item));
    } catch {
      // Keep the conversation open so the user can retry.
    } finally {
      setSendingReply(false);
    }
  }

  const conversationModal = selectedThread && portalReady ? createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Support conversation" onClick={(event) => { if (event.target === event.currentTarget) setSelectedThread(null); }}>
      <div className="relative flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0F3D5C]">Support conversation</p>
            <h2 className="mt-1 truncate text-lg font-bold text-slate-900">{selectedThread.subject}</h2>
          </div>
          <button type="button" onClick={() => setSelectedThread(null)} className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">Close</button>
        </div>
        <div className="max-h-[50vh] min-h-24 flex-1 space-y-3 overflow-y-auto px-1 py-4 pr-2">
          {loadingThread ? <p className="text-sm text-slate-500">Loading conversation...</p> : threadMessages.map((message) => (
            <div key={message.id} className={`max-w-[90%] rounded-2xl p-3 ${message.role === "admin" ? "bg-sky-50 text-slate-800" : "ml-auto bg-[#0F3D5C] text-white"}`}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide opacity-70">{message.role === "admin" ? "Admin" : "You"}</p>
              <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
              <p className="mt-2 text-[11px] opacity-60">{new Date(message.createdAt).toLocaleString()}</p>
            </div>
          ))}
        </div>
        <form className="sticky bottom-0 mt-2 border-t border-slate-200 bg-white pt-4" onSubmit={(event) => { event.preventDefault(); sendThreadReply(); }}>
          <label htmlFor="support-reply" className="sr-only">Reply to support</label>
          <textarea id="support-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={3} placeholder="Write a reply..." className="w-full resize-none rounded-2xl border border-slate-300 p-3 text-sm outline-none focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/15" disabled={sendingReply} />
          <div className="mt-3 flex justify-end">
            <button type="submit" disabled={sendingReply || !replyText.trim()} className="rounded-xl bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{sendingReply ? "Sending..." : "Send Reply"}</button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  ) : null;

  const notificationModal = selectedNotification && portalReady ? createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="notification-modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) setSelectedNotification(null);
      }}
    >
      <div
        className="relative w-full max-w-lg max-h-[80vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <h2 id="notification-modal-title" className="text-lg font-semibold text-slate-900">Notification</h2>
          <button type="button" onClick={() => setSelectedNotification(null)} className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">Close</button>
        </div>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{selectedNotification.text}</p>
        <p className="mt-5 text-xs text-slate-500">
          {selectedNotification.createdAt ? new Date(selectedNotification.createdAt).toLocaleString() : "Date unavailable"}
        </p>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div className="relative flex items-center gap-3" ref={wrapperRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            const next = openPanel === "notifications" ? "none" : "notifications";
            const wasClosed = openPanel !== "notifications";
            setOpenPanel(next);
            if (next === "notifications" && wasClosed) {
              writeStorageState({
                clearedNotifications: true,
                clearedMessages,
                lastSeenNotificationsCount: displayedNotifications.length,
                lastSeenMessagesCount,
              }, profileId);
            }
          }}
          className={`relative rounded-2xl border p-3 shadow-sm transition ${openPanel === "notifications" ? "border-slate-200 bg-white/95" : "border-slate-200 bg-white/95"}`}
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
            <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F3D5C] text-[10px] font-bold text-white">
              {liveUnreadCount > 99 ? "99+" : liveUnreadCount}
            </span>
          )}
        </button>

        {openPanel === "notifications" && (
          <div className="absolute right-0 z-50 mt-2 flex max-h-[600px] w-96 flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white text-slate-900 shadow-2xl">
            <div className="shrink-0 bg-white/95 px-4 py-3 backdrop-blur-sm">
              <span className="text-sm font-semibold text-gray-900">Notifications</span>
            </div>
            <div className="flex shrink-0 items-center gap-1 border-b border-gray-100 px-3 py-2">
              {(['all', 'unread'] as const).map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => {
                    setFilter(option);
                    setVisibleCount(3);
                    setHasExpandedNotifications(false);
                  }}
                  className={filter === option
                    ? 'rounded-full bg-blue-100 px-4 py-1.5 text-sm font-semibold text-blue-600'
                    : 'rounded-full px-4 py-1.5 text-sm font-semibold text-gray-700 hover:bg-gray-100'}
                >
                  {option === 'all' ? 'All' : 'Unread'}
                </button>
              ))}
            </div>
            <div className={`min-h-0 flex-1 p-2 ${hasExpandedNotifications ? "max-h-[550px] overflow-y-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300" : "overflow-hidden"}`}>
              {visibleNotifications.length > 0 ? (
                <div className="space-y-2">
                {visibleNotifications.map((notification, idx) => (
                  <button
                    key={`${notification.text}-${idx}`}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex w-full min-w-0 items-start gap-3 overflow-hidden rounded-xl p-3 text-left text-sm transition-all ${readNotificationIds.has(notification.id) ? "bg-white text-slate-600 hover:bg-gray-50" : "bg-blue-50 text-slate-700 hover:bg-blue-100/50"}`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-hidden="true">
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                        <path d="M12 22a2.5 2.5 0 0 0 2.45-2h-4.9A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.83V3a1.5 1.5 0 0 0-3 0v1.17A7 7 0 0 0 5 11v5l-1.5 1.5V19h17v-1.5L19 16Z" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <p className="block overflow-hidden break-words text-ellipsis line-clamp-4 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4]">{truncateMessage(notification.text, 160)}</p>
                      {notification.createdAt && <span className="mt-1 block text-xs text-slate-400">{formatRelativeTime(notification.createdAt)}</span>}
                    </span>
                    {!readNotificationIds.has(notification.id) && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" aria-label="Unread" />}
                  </button>
                ))}
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
                    setVisibleCount((current) => current + 5);
                    setHasExpandedNotifications(true);
                  }}
                  className="w-full rounded-lg bg-gray-200 py-2 text-sm font-semibold text-gray-900 transition-colors hover:bg-gray-300"
                >
                  See previous notifications
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            const next = openPanel === "messages" ? "none" : "messages";
            setOpenPanel(next);
            if (next === "messages") {
              setClearedMessages(true);
              setUnreadMessages(0);
              writeStorageState({
                clearedNotifications,
                clearedMessages: true,
                lastSeenNotificationsCount,
                lastSeenMessagesCount: supportThreads.length,
              }, profileId);
            }
          }}
          className={`relative rounded-2xl border p-3 shadow-sm transition ${openPanel === "messages" ? "border-slate-200 bg-white/95" : "border-slate-200 bg-white/95"}`}
          aria-expanded={openPanel === "messages"}
        >
          <span className="sr-only">Messages</span>
          {openPanel === "messages" ? (
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-[#0F3D5C]" fill="currentColor" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-5 w-5 text-slate-600" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          )}
          {unreadMessages > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F3D5C] text-[10px] font-bold text-white">
              {unreadMessages > 99 ? "99+" : unreadMessages}
            </span>
          )}
        </button>

        {openPanel === "messages" && (
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="space-y-3 p-4">
              <p className="text-sm font-semibold text-[#0F3D5C]">Messages</p>
              {loadingMessages ? (
                <p className="text-sm italic text-slate-500">Loading messages…</p>
              ) : supportThreads.length > 0 ? (
                <div className="space-y-2 text-sm text-slate-600">
                  {supportThreads.map((item) => (
                    <button key={item.id} type="button" onClick={() => openThread(item)} className="block w-full min-w-0 overflow-hidden rounded-2xl bg-slate-50 p-3 text-left transition hover:bg-slate-100">
                      <p className="truncate text-sm font-semibold text-slate-900">{item.subject}</p>
                      <p className="mt-1 line-clamp-2 break-words text-sm leading-6 text-slate-600">{item.response || "No reply yet. Open to view the conversation."}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm italic text-slate-500">No messages yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenPanel(openPanel === "settings" ? "none" : "settings")}
          className="inline-flex items-center gap-2 rounded-full bg-white/95 px-2 py-2 text-left text-slate-700 shadow-sm transition hover:bg-slate-50"
          aria-expanded={openPanel === "settings"}
          aria-label={`Open account menu for ${profileName}`}
          title={profileName}
        >
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0F3D5C] text-xs font-bold text-white">
            {profileAvatar ? (
              <img src={profileAvatar} alt={profileName} className="h-full w-full object-cover" />
            ) : (
              initials
            )}
          </span>

          <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {openPanel === "settings" && (
          <div className="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
            <div className="p-2">
              <div className="flex items-center gap-3 rounded-2xl px-4 py-4">
                <div className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#0F3D5C] text-sm font-bold text-white">
                  {profileAvatar ? <img src={profileAvatar} alt={profileName} className="h-full w-full object-cover" /> : initials}
                </div>
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
      {conversationModal}
      {notificationModal}
      {conversationModal}
    </div>
  );
}
