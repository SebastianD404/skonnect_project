import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SystemAdminSidebar from "./SystemAdminSidebar";
import { Bell, Search } from "lucide-react";

export default async function SystemAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole([Role.SUPER_ADMIN]);

  const [activeUserCount, roleUpdateCount] = await Promise.all([
    prisma.user.count({
      where: { isActive: true },
    }),
    prisma.auditLog.count({
      where: {
        action: {
          contains: "ROLE",
          mode: "insensitive",
        },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-[#EFF4FA] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1480px]">
        <SystemAdminSidebar
          activeUserCount={activeUserCount}
          roleUpdateCount={roleUpdateCount}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-20 border-b border-[#D6E1EC] bg-[#EFF4FA]/85 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between gap-4 px-6 lg:px-10">
              <div className="relative w-full max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search users, logs, actions..."
                  className="h-10 w-full rounded-xl border border-[#CFDBE7] bg-white pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#4B96C6] focus:ring-2 focus:ring-[#4B96C6]/20"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="relative grid h-10 w-10 place-items-center rounded-xl border border-[#CFDBE7] bg-white text-slate-700 transition hover:bg-slate-50"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500" />
                </button>
                <div className="hidden items-center gap-2 rounded-xl border border-[#CFDBE7] bg-white px-3 py-2 sm:flex">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  <span className="text-xs font-semibold text-slate-500">Live</span>
                </div>
              </div>
            </div>
          </header>

          <main className="flex-1 px-6 py-8 lg:px-10 lg:py-10">{children}</main>
        </div>
      </div>
    </div>
  );
}