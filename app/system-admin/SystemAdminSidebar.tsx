"use client";

import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShieldCheck, ScrollText } from "lucide-react";
import { SignOutButton } from "@/app/components/SignOutButton";

type SessionUser = {
  fullName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
};

type Props = {
  activeUserCount: number;
  roleUpdateCount: number;
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

export default function SystemAdminSidebar({ activeUserCount, roleUpdateCount }: Props) {
  const pathname = usePathname();
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);

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

  const initials = useMemo(() => {
    const source = (displayName || sessionUser?.email || "S").trim();
    const parts = source.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "S";
    if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
    return `${parts[0].slice(0, 1)}${parts[parts.length - 1].slice(0, 1)}`.toUpperCase();
  }, [displayName, sessionUser?.email]);

  const navItems = [
    { label: "Dashboard", href: "/system-admin", icon: LayoutDashboard },
    { label: "Role Management", href: "/system-admin/users", icon: ShieldCheck, badge: activeUserCount },
    { label: "Audit Logs", href: "/system-admin/audit", icon: ScrollText, badge: roleUpdateCount },
  ];

  return (
    <aside className="sticky top-0 flex h-screen w-72 shrink-0 flex-col border-r border-[#1C4B67] bg-[#0F2E47] px-4 py-6 text-[#DCE7F0]">
      <div className="flex items-center gap-3 px-2">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-[#0D4568] to-[#1E97D1] text-sm font-black text-white shadow-lg">
          SK
        </div>
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
              className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? "bg-[#174968] text-white shadow-md"
                  : "text-[#C6D6E2] hover:bg-[#174968]/65 hover:text-white"
              }`}
            >
              {isActive ? <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#33A8E2]" /> : null}
              <Icon className="h-4 w-4" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badge ? (
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

      <div className="mt-6 rounded-2xl border border-[#1C4B67] bg-[#174968]/40 p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9AB0C2]">System health</p>
        <div className="mt-3 flex items-baseline gap-2">
          <p className="text-2xl font-black text-white">99.98%</p>
          <span className="text-xs font-semibold text-emerald-300">stable</span>
        </div>
        <p className="mt-1 text-xs text-[#9AB0C2]">All services nominal over the last 30 days.</p>
      </div>

      <div className="mt-auto border-t border-[#1C4B67] px-2 pt-4">
        <div className="rounded-2xl border border-[#1C4B67] bg-[#174968]/35 p-3">
          <div className="flex items-center gap-3">
            {sessionUser?.avatarUrl ? (
              <img
                src={sessionUser.avatarUrl}
                alt={sessionUser.fullName || sessionUser.email || "System admin"}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-white"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0E4467] text-xs font-bold text-white">
                {initials}
              </div>
            )}

            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{displayName}</p>
              <p className="truncate text-xs text-[#9AB0C2]">{sessionUser?.email || "No email available"}</p>
            </div>

            <SignOutButton />
          </div>
        </div>
      </div>
    </aside>
  );
}
