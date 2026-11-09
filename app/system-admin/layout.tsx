import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import SystemAdminSidebar from "./SystemAdminSidebar";

export default async function SystemAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole([Role.SUPER_ADMIN]);

  const databaseStatus = await prisma
    .$queryRaw<Array<{ health_check: number }>>`SELECT 1 AS health_check`
    .then(() => "connected" as const)
    .catch(() => "unavailable" as const);

  return (
    <div className="min-h-screen bg-[#EFF4FA] text-slate-950">
      <div className="flex min-h-screen w-full">
        <div className="lg:sticky lg:top-0 lg:h-screen lg:w-64 lg:flex-shrink-0 lg:overflow-y-auto hover-scrollbar">
          <SystemAdminSidebar
          roleUpdateCount={0}
          databaseStatus={databaseStatus}
          />
        </div>
        <main className="min-w-0 flex-1 overflow-x-hidden bg-slate-50">
          <div className="mx-auto w-full max-w-[1440px] p-4 pt-20 sm:p-6 sm:pt-20 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}