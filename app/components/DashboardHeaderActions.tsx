"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface DashboardHeaderActionsProps {
  notifications?: string[];
  messages?: string[];
}

export function DashboardHeaderActions({ notifications = [], messages = [] }: DashboardHeaderActionsProps) {
  const [openPanel, setOpenPanel] = useState<"none" | "notifications" | "messages" | "settings">("none");
  const [profileName, setProfileName] = useState("Your account");
  const [profileEmail, setProfileEmail] = useState("");
  const [profileAvatar, setProfileAvatar] = useState("");
  const [isDark, setIsDark] = useState(false);
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
    };
  }, []);

  const initials =
    profileName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?";

  return (
    <div className="relative flex items-center gap-3" ref={wrapperRef}>
      <button
        type="button"
        onClick={() => setOpenPanel(openPanel === "notifications" ? "none" : "notifications")}
        className="relative rounded-2xl border border-slate-200 bg-white/95 p-3 text-slate-600 shadow-sm transition hover:border-[#0F3D5C]/20 hover:text-[#0F3D5C]"
        aria-expanded={openPanel === "notifications"}
      >
        <span className="sr-only">Notifications</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {notifications.length > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F3D5C] text-[10px] font-bold text-white">
            {notifications.length > 99 ? "99+" : notifications.length}
          </span>
        )}
      </button>

      <button
        type="button"
        onClick={() => setOpenPanel(openPanel === "messages" ? "none" : "messages")}
        className="relative rounded-2xl border border-slate-200 bg-white/95 p-3 text-slate-600 shadow-sm transition hover:border-[#0F3D5C]/20 hover:text-[#0F3D5C]"
        aria-expanded={openPanel === "messages"}
      >
        <span className="sr-only">Messages</span>
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {messages.length > 0 && (
          <span className="absolute -top-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0F3D5C] text-[10px] font-bold text-white">
            {messages.length > 99 ? "99+" : messages.length}
          </span>
        )}
      </button>

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

      {openPanel !== "none" && (
        <div className={`absolute right-0 top-14 z-20 w-80 overflow-hidden rounded-3xl border shadow-2xl ${isDark ? "border-slate-700 bg-slate-900 text-slate-100" : "border-slate-200 bg-white text-slate-900"}`}>
          {openPanel === "notifications" && (
            <div className="space-y-3 p-4">
              <p className="text-sm font-semibold text-[#0F3D5C] dark:text-sky-300">Notifications</p>
              {notifications.length > 0 ? (
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {notifications.map((notification, idx) => (
                    <div key={idx} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">{notification}</div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic dark:text-slate-400">No notifications yet</p>
              )}
            </div>
          )}

          {openPanel === "messages" && (
            <div className="space-y-3 p-4">
              <p className="text-sm font-semibold text-[#0F3D5C] dark:text-sky-300">Messages</p>
              {messages.length > 0 ? (
                <div className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
                  {messages.map((message, idx) => (
                    <div key={idx} className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-800">{message}</div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500 italic dark:text-slate-400">No messages yet</p>
              )}
            </div>
          )}

          {openPanel === "settings" && (
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
          )}
        </div>
      )}
    </div>
  );
}
