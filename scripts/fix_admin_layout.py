from pathlib import Path

path = Path(__file__).resolve().parent.parent / "app" / "admin" / "layout.tsx"
content = '''import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import AdminSidebar from "./AdminSidebar";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const [upcomingEventCount, openInquiryCount] = await Promise.all([
    prisma.event.count({
      where: {
        status: {
          in: ["UPCOMING", "REGISTRATION_OPEN"],
        },
      },
    }),
    prisma.inquiry.count({
      where: { isResolved: false },
    }),
  ]);

  return (
    <div className="min-h-screen bg-[#F8FBFF] text-slate-950">
      <div className="mx-auto flex min-h-screen max-w-[1480px]">
        <AdminSidebar upcomingEventCount={upcomingEventCount} openInquiryCount={openInquiryCount} />
        <main className="flex-1 flex flex-col">{children}</main>
      </div>
    </div>
  );
}
'''
path.write_text(content, encoding='utf-8')
print(f'Wrote {path}')
