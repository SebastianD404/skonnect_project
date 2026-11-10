"use client";

import Link from "next/link";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Cable, Database, LayoutDashboard, Menu, ScrollText, Users, X } from "lucide-react";
import { SignOutButton } from "@/app/components/SignOutButton";
import { SkLogo } from "@/app/components/SkLogo";
import { Avatar } from "@/components/ui/Avatar";

type SessionUser = {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type Props = {
  roleUpdateCount: number;
  databaseStatus: "connected" | "unavailable";
};

const AUDIT_LAST_VIEWED_KEY = "system-admin-audit-last-viewed";

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function deriveDisplayName(fullName?: string | null, email?: string | null) {
  const normalizedFullName = (fullName || "").trim();
  if (normalizedFullName && !normalizedFullName.includes("@")) {
    return normalizedFullName;
  }

  const localPart = (email || "").split("@")[0]?.trim();
  if (!localPart) {
    return "System admin";
  }

  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "System admin";
  }

  return toTitleCase(cleaned);
}

export default function SystemAdminSidebar({ roleUpdateCount, databaseStatus }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadAuditCount, setUnreadAuditCount] = useState(
    pathname.startsWith("/system-admin/audit") ? 0 : roleUpdateCount,
  );
  const countRequest = useRef(false);

  const markAuditLogsViewed = useCallback(() => {
    const viewedAt = new Date().toISOString();
    window.localStorage.setItem(AUDIT_LAST_VIEWED_KEY, viewedAt);
    setUnreadAuditCount(0);
  }, []);

  const refreshUnreadAuditCount = useCallback(async () => {
    if (document.visibilityState !== "visible" || countRequest.current) return;
    if (pathname.startsWith("/system-admin/audit")) {
      window.localStorage.setItem(AUDIT_LAST_VIEWED_KEY, new Date().toISOString());
      return;
    }

    countRequest.current = true;
    try {
      const lastViewed = window.localStorage.getItem(AUDIT_LAST_VIEWED_KEY);
      const query = lastViewed ? `?since=${encodeURIComponent(lastViewed)}` : "";
      const response = await fetch(`/api/system-admin/audit/unread-count${query}`, {
        cache: "no-store",
      });
      if (response.status === 401 || response.status === 403) {
        const next = `${window.location.pathname}${window.location.search}`;
        const reason = response.status === 401 ? "session_expired" : "access_denied";
        router.replace(`/login?reason=${reason}&next=${encodeURIComponent(next)}`);
        return;
      }

      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Unable to refresh unread audit count (${response.status}).`);
      }

      const data: unknown = await response.json();
      const payload =
        typeof data === "object" && data !== null ? data : {};
      const count = "count" in payload ? payload.count : undefined;
      const error = "error" in payload ? payload.error : undefined;
      if (
        !response.ok ||
        typeof count !== "number" ||
        !Number.isInteger(count) ||
        count < 0
      ) {
        throw new Error(
          typeof error === "string"
            ? error
            : "Unable to refresh unread audit count.",
        );
      }
      setUnreadAuditCount(count);
    } catch (error) {
      console.error("Failed to refresh unread audit count:", error);
    } finally {
      countRequest.current = false;
    }
  }, [pathname, router]);

  useEffect(() => {
    if (pathname.startsWith("/system-admin/audit")) {
      window.localStorage.setItem(AUDIT_LAST_VIEWED_KEY, new Date().toISOString());
    }

    const initialRefresh = pathname.startsWith("/system-admin/audit")
      ? null
      : window.setTimeout(() => void refreshUnreadAuditCount(), 0);
    const interval = window.setInterval(() => void refreshUnreadAuditCount(), 15_000);
    const handleFocus = () => void refreshUnreadAuditCount();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") void refreshUnreadAuditCount();
    };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (initialRefresh !== null) window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [pathname, markAuditLogsViewed, refreshUnreadAuditCount]);

  useEffect(() => {
    let mounted = true;

    async function fetchSessionProfile() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (!response.ok || !mounted) {
          return;
        }

        const data = await response.json();
        setSessionUser(data?.user ?? null);
      } catch {
        if (mounted) {
          setSessionUser(null);
        }
      }
    }

    fetchSessionProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const displayName = useMemo(
    () => deriveDisplayName(sessionUser?.fullName, sessionUser?.email),
    [sessionUser?.fullName, sessionUser?.email]
  );

  const navItems = [
    { label: "Dashboard", href: "/system-admin", icon: LayoutDashboard },
    { label: "Users", href: "/system-admin/users", icon: Users },
    { label: "API Integrations", href: "/system-admin/integrations", icon: Cable },
    { label: "Audit Logs", href: "/system-admin/audit", icon: ScrollText, badge: unreadAuditCount },
  ];

  return (
    <>
      <div className="fixed inset-x-0 top-0 z-40 flex items-center gap-x-4 bg-[#0F2E47] px-4 py-3 shadow-sm sm:gap-x-6 sm:px-6 lg:hidden">
        <button type="button" onClick={() => setMobileOpen(true)} className="-m-2.5 p-2.5 text-white" aria-label="Open navigation menu"><Menu aria-hidden="true" className="h-6 w-6" /></button>
        <div className="flex flex-1 items-center gap-3">
          <SkLogo className="h-9 w-9" />
          <span className="font-bold text-white">SKonnect</span>
        </div>
      </div>
      <div
        className={`fixed inset-0 z-50 lg:hidden ${mobileOpen ? "pointer-events-auto" : "pointer-events-none"}`}
        aria-hidden={!mobileOpen}
      >
        <button
          type="button"
          className={`absolute inset-0 bg-slate-950/50 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation menu"
          tabIndex={mobileOpen ? 0 : -1}
        />
        <aside
          className={`relative h-full w-[min(20rem,85vw)] overflow-y-auto bg-[#0F2E47] px-4 py-6 text-[#DCE7F0] shadow-2xl transition-transform duration-300 ease-in-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between"><div className="flex items-center gap-3"><SkLogo className="h-9 w-9" /><span className="font-bold text-white">SKonnect</span></div><button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation menu" tabIndex={mobileOpen ? 0 : -1}><X className="h-5 w-5" /></button></div>
          <nav className="mt-6 flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/system-admin"
                  ? pathname === "/system-admin"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => {
                    if (item.href === "/system-admin/audit") markAuditLogsViewed();
                    setMobileOpen(false);
                  }}
                  tabIndex={mobileOpen ? 0 : -1}
                  aria-current={isActive ? "page" : undefined}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-[#174968] text-white shadow-md"
                      : "text-[#C6D6E2] hover:bg-[#174968]/65 hover:text-white"
                  }`}
                >
                  {isActive ? (
                    <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#33A8E2]" />
                  ) : null}
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">{item.label}</span>
                  {item.badge && item.badge > 0 && !(item.href === "/system-admin/audit" && isActive) ? (
                    <span
                      className={`flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                        isActive ? "bg-white/15 text-white" : "bg-[#0B2132] text-[#DCE7F0]"
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </Link>
              );
            })}
          </nav>
          <Link
            href="/system-admin/knowledge-base"
            onClick={() => setMobileOpen(false)}
            tabIndex={mobileOpen ? 0 : -1}
            aria-current={pathname.startsWith("/system-admin/knowledge-base") ? "page" : undefined}
            className={`group relative mt-4 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              pathname.startsWith("/system-admin/knowledge-base")
                ? "bg-[#174968] text-white shadow-md"
                : "text-[#C6D6E2] hover:bg-[#174968]/65 hover:text-white"
            }`}
          >
            {pathname.startsWith("/system-admin/knowledge-base") ? (
              <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#33A8E2]" />
            ) : null}
            <Database className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate text-left">Knowledge Base</span>
          </Link>
        </aside>
      </div>
    <aside className="hidden h-full w-[17rem] shrink-0 flex-col border-r border-[#1C4B67] bg-[#0F2E47] px-4 py-6 text-[#DCE7F0] lg:flex">
      <div className="flex items-center gap-3 px-2">
        <SkLogo className="h-11 w-11" />
        <div className="min-w-0">
          <p className="truncate text-base font-bold text-white">SKonnect</p>
          <p className="truncate text-xs text-[#9AB0C2]">Admin Workspace · Barangay Pico</p>
        </div>
      </div>

      <div className="mt-6 border-t border-[#1C4B67]" />

      <div className="mt-5 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9AB0C2]">System</div>
      <nav className="mt-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            item.href === "/system-admin"
              ? pathname === "/system-admin"
              : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={item.href === "/system-admin/audit" ? markAuditLogsViewed : undefined}
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[#174968] text-white shadow-md"
                  : "text-[#C6D6E2] hover:bg-[#174968]/65 hover:text-white"
              }`}
            >
              {isActive ? <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#33A8E2]" /> : null}
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge &&
              item.badge > 0 &&
              !(item.href === "/system-admin/audit" && pathname.startsWith("/system-admin/audit")) ? (
                <span
                  className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                    isActive ? "bg-white/15 text-white" : "bg-[#0B2132] text-[#DCE7F0]"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-6 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9AB0C2]">
        AI Assistant
      </div>
      <nav className="mt-3 flex flex-col gap-1">
        <Link
          href="/system-admin/knowledge-base"
          className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
            pathname.startsWith("/system-admin/knowledge-base")
              ? "bg-[#174968] text-white shadow-md"
              : "text-[#C6D6E2] hover:bg-[#174968]/65 hover:text-white"
          }`}
        >
          {pathname.startsWith("/system-admin/knowledge-base") ? (
            <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#33A8E2]" />
          ) : null}
          <Database className="h-4 w-4" />
          <span className="flex-1 text-left">Knowledge Base</span>
        </Link>
      </nav>

      <div className="mt-6 rounded-2xl border border-[#1C4B67] bg-[#174968]/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9AB0C2]">System health</p>
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <Database className="h-4 w-4 text-[#9AB0C2]" />
            Database
          </div>
          <span className={`inline-flex items-center gap-1.5 text-sm ${databaseStatus === "connected" ? "font-normal text-slate-400" : "font-semibold text-rose-300"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${databaseStatus === "connected" ? "animate-pulse bg-emerald-300" : "bg-rose-300"}`} />
            {databaseStatus === "connected" ? "Connected" : "Unavailable"}
          </span>
        </div>
      </div>

      <div className="mt-auto border-t border-[#1C4B67] px-2 pt-4">
        <div className="rounded-2xl border border-[#1C4B67] bg-[#174968]/35 p-3">
          <div className="flex items-center gap-3">
            <Avatar
              src={sessionUser?.avatarUrl}
              alt={sessionUser?.fullName || sessionUser?.email || "System admin"}
              size={40}
              className="ring-2 ring-white"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-[#9AB0C2]">{sessionUser?.email || "No email available"}</p>
            </div>

            <SignOutButton />
          </div>
        </div>
      </div>
    </aside>
    </>
  );
}
