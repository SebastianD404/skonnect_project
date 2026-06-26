"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardList, FileText, Inbox, LayoutDashboard, Megaphone, Settings, Users } from "lucide-react";
import AdminSidebarBrand from "./AdminSidebarBrand";

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
    </aside>
  );
}
