"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, FileText, Inbox, LayoutDashboard, Megaphone, Settings, Users } from "lucide-react";
import AdminSidebarBrand from "./AdminSidebarBrand";
import { SignOutButton } from "@/app/components/SignOutButton";

type SessionUser = {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

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
    return "Admin account";
  }

  const cleaned = localPart
    .replace(/[._-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\d+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) {
    return "Admin account";
  }

  return toTitleCase(cleaned);
}

interface AdminSidebarProps {
  upcomingEventCount: number;
  openInquiryCount: number;
  pendingDocumentCount: number;
  profilingRegistrationCount: number;
}

export default function AdminSidebar({
  upcomingEventCount,
  openInquiryCount,
  pendingDocumentCount,
  profilingRegistrationCount,
}: AdminSidebarProps) {
  const pathname = usePathname();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const displayName = useMemo(
    () => deriveDisplayName(sessionUser?.fullName, sessionUser?.email),
    [sessionUser?.fullName, sessionUser?.email]
  );

  useEffect(() => {
    let mounted = true;

    async function fetchSessionProfile() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        if (!response.ok) return;

        const data = await response.json();
        if (!mounted) return;

        setSessionUser(data?.user ?? null);
      } catch {
        if (mounted) setSessionUser(null);
      }
    }

    fetchSessionProfile();

    return () => {
      mounted = false;
    };
  }, []);

  const initials = useMemo(() => {
    const value = (displayName || sessionUser?.email || "A").trim();
    const parts = value.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "A";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
  }, [displayName, sessionUser?.email]);

  const navItems = [
    { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { label: "KK Profiling", href: "/admin/kk-profiling", icon: ClipboardList, badge: profilingRegistrationCount },
    { label: "Events", href: "/admin/events", icon: CalendarDays, badge: upcomingEventCount },
    { label: "Document Reviews", href: "/admin/submissions", icon: FileText, badge: pendingDocumentCount },
    { label: "Announcements", href: "/admin/announcements", icon: Megaphone },
    { label: "Inquiries", href: "/admin/inquiries", icon: Inbox, badge: openInquiryCount },
    { label: "Grantees", href: "/admin/grantees", icon: Users },
    { label: "Settings", href: "/admin/settings", icon: Settings },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-slate-200 bg-white px-4 py-6">
      <AdminSidebarBrand />

      <div className="mt-8 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Menu</div>
      <nav className="mt-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/admin" && pathname.startsWith(item.href));

          const Icon = item.icon;

          return (
            <Link
              key={item.label}
              href={item.href}
              className={`group flex items-center gap-3 rounded-2xl px-3 py-2 text-sm transition ${
                isActive ? "bg-[#0F3D5C] text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
                <span
                  className={`flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-semibold ${
                    isActive ? "bg-white/15 text-white" : "bg-slate-900 text-white"
                  }`}
                >
                  {item.badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200 px-2 pt-4">
        <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="flex items-center gap-3">
            {sessionUser?.avatarUrl ? (
              <img
                src={sessionUser.avatarUrl}
                alt={sessionUser.fullName || sessionUser.email || "Admin account"}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0F3D5C] text-xs font-bold text-white">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {displayName}
              </p>
              <p className="truncate text-xs text-slate-500">{sessionUser?.email || "No email available"}</p>
            </div>

            <SignOutButton />
          </div>
        </div>
      </div>
    </aside>
  );
}
