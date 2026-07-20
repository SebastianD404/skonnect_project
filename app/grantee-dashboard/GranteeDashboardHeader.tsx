"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardHeaderActions } from "@/app/components/DashboardHeaderActions";

function navClass(pathname: string, href: string) {
  const isActive = pathname === href;
  return (
    "px-4 py-2 font-semibold rounded-lg transition-colors duration-200 " +
    (isActive
      ? "text-[#0F3D5C] bg-[#0F3D5C]/10"
      : "text-[#3C3C3C] hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5")
  );
}

export default function GranteeDashboardHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-gradient-to-b from-[#FAFBFC]/95 to-[#F5F7FB]/90 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/grantee-dashboard" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F3D5C] to-[#0D2E47] shadow-lg text-xs font-black tracking-tighter text-white">
            SK
          </div>
          <span className="text-xl font-black tracking-tight text-[#0F3D5C]">SKonnect</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex">
          <Link href="/grantee-dashboard" prefetch className={navClass(pathname, "/grantee-dashboard")}>Overview</Link>
          <Link href="/grantee-dashboard/documents" prefetch className={navClass(pathname, "/grantee-dashboard/documents")}>Submissions</Link>
          <Link href="/grantee-dashboard/announcements" prefetch className={navClass(pathname, "/grantee-dashboard/announcements")}>Announcements</Link>
        </nav>

        <DashboardHeaderActions requiredRole="GRANTEE" />
      </div>
    </header>
  );
}
