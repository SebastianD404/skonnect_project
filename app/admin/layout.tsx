import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import AdminSidebar from "./AdminSidebar";
import AdminGlobalTopBar from "./AdminGlobalTopBar";
import { AdminSearchProvider } from "./AdminSearchContext";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminUser = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  return (
    <AdminSearchProvider>
      <div className="h-screen w-screen overflow-hidden bg-[#F8FBFF] text-slate-950">
        <div className="mx-auto flex h-full max-w-[1480px]">
          <AdminSidebar
            openInquiryCount={0}
            skeapApplicationCount={0}
            pendingDocumentCount={0}
            profilingRegistrationCount={0}
            newGranteesToday={0}
            approvedMemberCount={0}
            userRole={adminUser.role}
          />
          <main className="h-full min-w-0 flex-1 overflow-y-auto">
            <AdminGlobalTopBar />
            <div className="px-8 py-8">{children}</div>
          </main>
        </div>
      </div>
    </AdminSearchProvider>
  );
}
