"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardHeaderActions } from "@/app/components/DashboardHeaderActions";
import { SignOutButton } from "@/app/components/SignOutButton";
import { useAuth } from "@/app/components/AuthProvider";
import { Avatar } from "@/components/ui/Avatar";
import { SkLogo } from "@/app/components/SkLogo";

function navClass(pathname: string, href: string) {
  const isActive = pathname === href || pathname.startsWith(`${href}/`);
  return (
    "px-4 py-2 font-semibold rounded-lg transition-colors duration-200 " +
    (isActive
      ? "text-[#0F3D5C] bg-[#0F3D5C]/10"
      : "text-[#3C3C3C] hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5")
  );
}

export default function YouthDashboardHeader({ onboarding = false }: { onboarding?: boolean }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);

  return (
    <header className={`sticky top-0 ${onboarding ? "z-[60]" : "z-50"} border-b border-white/50 bg-gradient-to-b from-[#FAFBFC]/95 to-[#F5F7FB]/90 shadow-sm backdrop-blur-xl`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/?from=youth-dashboard" className="flex items-center gap-2" aria-label="Go to SKonnect home" title="Go to home">
          <SkLogo className="h-12 w-12" />
          <span className="text-xl font-black tracking-tight text-[#0F3D5C]">SKonnect</span>
        </Link>

        {onboarding ? (
          <div className="relative">
            <button
              type="button"
              onClick={() => setProfileMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 rounded-full bg-white/95 px-2 py-2 text-left text-slate-700 shadow-sm transition hover:bg-slate-50"
              aria-expanded={profileMenuOpen}
              aria-haspopup="menu"
              aria-label={`Open account menu for ${user?.fullName || user?.email || "your account"}`}
            >
              <Avatar
                src={user?.avatarUrl}
                alt={user?.fullName || "Your account"}
                size={32}
                className="bg-[#0F3D5C] text-white"
              />
              <span className="hidden max-w-36 truncate text-sm font-medium sm:block">
                {user?.fullName || user?.email || "Your account"}
              </span>
              <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>
            {profileMenuOpen ? (
              <div
                role="menu"
                className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl"
              >
                <div className="px-3 py-2">
                  <p className="truncate text-sm font-semibold">{user?.fullName || "Your account"}</p>
                  {user?.email ? <p className="truncate text-xs text-slate-500">{user.email}</p> : null}
                </div>
                <div className="my-1 border-t border-slate-200" />
                <div role="menuitem">
                  <SignOutButton showLabel />
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <nav className="hidden items-center gap-1 text-sm md:flex">
              <Link href="/?from=dashboard" className={navClass(pathname, "/")}>Home</Link>
              <Link href="/about?from=dashboard" className={navClass(pathname, "/about")}>About</Link>
              <Link href="/applications" className={navClass(pathname, "/applications")}>Applications</Link>
            </nav>
            <DashboardHeaderActions supportInboxPath="/youth-dashboard/inquiries" />
          </>
        )}
      </div>
    </header>
  );
}
