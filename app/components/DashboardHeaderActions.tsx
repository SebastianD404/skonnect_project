"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface DashboardHeaderActionsProps {
  notifications?: string[];
  messages?: string[];
  requiredRole?: string | string[];
}

export function DashboardHeaderActions({ notifications = [], messages = [], requiredRole }: DashboardHeaderActionsProps) {
  const [openPanel, setOpenPanel] = useState<"none" | "notifications" | "messages" | "settings">("none");
  const [serverRole, setServerRole] = useState<string | undefined>(undefined);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState("Your account");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [isDark, setIsDark] = useState(false);
  const [supportMessages, setSupportMessages] = useState<string[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

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
          setLoadingMessages(true);
          try {
            const inboxRes = await fetch('/api/my/inquiries', { cache: 'no-store' });
            if (inboxRes.ok) {
              const data = await inboxRes.json();
              const replies = (data.inquiries || [])
                .filter((item: any) => item.response)
                .map((item: any) => `${item.subject}: ${item.response}`);
              setSupportMessages(replies);
            }
          } catch {
            setSupportMessages([]);
          } finally {
            setLoadingMessages(false);
          }

          try {
            const remindersRes = await fetch('/api/my/reminders', { cache: 'no-store' });
            if (remindersRes.ok) {
              const data = await remindersRes.json();
              const reminders = (data.reminders || []).map((item: any) => {
                const subject = item.metadata?.subject || item.targetType || "Reminder";
                const body = item.metadata?.body || item.metadata?.message || item.channel || "You have a reminder.";
                return `${subject}: ${body}`;
              });
              setSupportMessages((prev) => [...reminders, ...prev]);
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

    function syncTheme() {
      try {
        const savedTheme = localStorage.getItem("skonnect-theme");
        const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        setIsDark(savedTheme === "dark" || (savedTheme !== "light" && systemPrefersDark));
      } catch (error) {}
    }

    syncProfile();
    syncTheme();
    window.addEventListener("storage", syncProfile);
    window.addEventListener("skonnect-profile-updated", syncProfile as EventListener);
    window.addEventListener("storage", syncTheme);
    window.addEventListener("skonnect-theme-updated", syncTheme as EventListener);

    return () => {
      window.removeEventListener("storage", syncProfile);
      window.removeEventListener("skonnect-profile-updated", syncProfile as EventListener);
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("skonnect-theme-updated", syncTheme as EventListener);
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

  const displayedMessages = messages.length > 0 ? messages : supportMessages;
  const notificationCount = notifications?.length ?? 0;
  const messageCount = messages && messages.length ? messages.length : supportMessages.length || 0;
  const [unreadNotifications, setUnreadNotifications] = useState<number>(notifications?.length ?? 0);
  const [unreadMessages, setUnreadMessages] = useState<number>(() => (messages && messages.length ? messages.length : supportMessages.length || 0));
  const [clearedNotifications, setClearedNotifications] = useState(false);
  const [clearedMessages, setClearedMessages] = useState(false);
  const [lastSeenNotificationsCount, setLastSeenNotificationsCount] = useState<number | null>(null);
  const [lastSeenMessagesCount, setLastSeenMessagesCount] = useState<number | null>(null);
  const STORAGE_KEY_BASE = "skonnect-dashboard-badge-state";

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
  // Normalize messages to objects { subject, reply } so rendering is consistent
  const messageItems = (displayedMessages || []).map((m: any) => {
    if (!m) return { subject: "", reply: "" };
    if (typeof m === "string") {
      const idx = m.indexOf(":");
      if (idx >= 0) {
        return { subject: m.slice(0, idx).trim(), reply: m.slice(idx + 1).trim() };
      }
      return { subject: m, reply: "" };
    }
    // If already an object, map fields
    return { subject: m.subject || m.title || "", reply: m.reply || m.response || "" };
  });

  return (
    <div className="relative flex items-center gap-3" ref={wrapperRef}>
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            const next = openPanel === "notifications" ? "none" : "notifications";
            setOpenPanel(next);
            if (next === "notifications") {
              setClearedNotifications(true);
              setUnreadNotifications(0);
              writeStorageState({
                clearedNotifications: true,
                clearedMessages,
                lastSeenNotificationsCount: notifications?.length ?? 0,
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
          {unreadNotifications > 0 && (
            <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F3D5C] text-[10px] font-bold text-white">
              {unreadNotifications > 99 ? "99+" : unreadNotifications}
            </span>
          )}
        </button>

        {openPanel === "notifications" && (
          <div className={`absolute right-0 mt-2 z-20 w-80 overflow-hidden rounded-3xl border shadow-2xl ${isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}>
            <div className="space-y-3 p-4">
              <p className="text-sm font-semibold text-[#0F3D5C] dark:text-sky-300">Notifications</p>
              {notifications.length > 0 ? (
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {notifications.map((notification, idx) => (
                    <div key={`${notification}-${idx}`} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">{notification}</div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic dark:text-slate-400">No notifications yet</p>
              )}
            </div>
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
                lastSeenMessagesCount: (messages && messages.length) ? messages.length : supportMessages.length || 0,
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
          <div className={`absolute right-0 mt-2 z-20 w-80 overflow-hidden rounded-3xl border shadow-2xl ${isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}>
            <div className="space-y-3 p-4">
              <p className="text-sm font-semibold text-[#0F3D5C] dark:text-sky-300">Messages</p>
              {loadingMessages ? (
                <p className="text-sm text-slate-500 italic dark:text-slate-400">Loading messages…</p>
              ) : messageItems.length > 0 ? (
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {messageItems.map((item, idx) => (
                    <div key={`${item.subject}-${idx}`} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">
                      <p className="text-sm font-semibold text-slate-900">{item.subject}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">Admin: {item.reply}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic dark:text-slate-400">No messages yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setOpenPanel(openPanel === "settings" ? "none" : "settings")}
          className={`inline-flex items-center gap-2 rounded-full px-2 py-2 text-left shadow-sm transition ${isDark ? "bg-slate-900/95 text-slate-100 hover:bg-slate-800" : "bg-white/95 text-slate-700 hover:bg-slate-50"}`}
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

          <svg viewBox="0 0 24 24" className={`h-3 w-3 ${isDark ? "text-slate-400" : "text-slate-500"}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>

        {openPanel === "settings" && (
          <div className={`absolute right-0 mt-2 z-20 w-80 overflow-hidden rounded-3xl border shadow-2xl ${isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}>
            <div className="p-2">
              <div className="flex items-center gap-3 rounded-2xl px-4 py-4">
                <div className="inline-flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[#0F3D5C] text-sm font-bold text-white">
                  {profileAvatar ? <img src={profileAvatar} alt={profileName} className="h-full w-full object-cover" /> : initials}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{profileName}</p>
                  <p className="truncate text-xs text-slate-500 dark:text-slate-400">{profileEmail}</p>
                </div>
              </div>

              <div className={`my-1 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`} />

              <Link href="/profile" className="block rounded-2xl px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                Profile
              </Link>
              <Link href="/account" className="block rounded-2xl px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                Settings
              </Link>

              <div className={`my-1 border-t ${isDark ? "border-slate-700" : "border-slate-200"}`} />

              <Link href="/logout" className="block rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">
                Sign out
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
