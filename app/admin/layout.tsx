import { Role } from "@prisma/client";
import { Search } from "lucide-react";
import { requireRole } from "@/lib/auth";
import AdminSidebar from "./AdminSidebar";
import { AdminSearchProvider } from "./AdminSearchContext";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const adminUser = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  return (
    <AdminSearchProvider>
      <div className="flex min-h-screen w-full bg-[#F8FBFF] text-slate-950">
        <div className="xl:sticky xl:top-0 xl:h-screen xl:w-[17rem] xl:flex-shrink-0 xl:overflow-y-auto hover-scrollbar">
          <AdminSidebar
            openInquiryCount={0}
            skeapApplicationCount={0}
            pendingDocumentCount={0}
            profilingRegistrationCount={0}
            newGranteesToday={0}
            approvedMemberCount={0}
            userRole={adminUser.role}
          />
        </div>
        <main className="flex h-screen min-w-0 flex-1 flex-col bg-slate-50 pt-20 xl:pt-0">
          {/* Top Search Area (with the separating line) */}
          <div className="sticky top-0 z-30 flex shrink-0 items-center gap-x-4 border-b border-slate-200 bg-slate-50/90 backdrop-blur-sm px-4 py-2.5 sm:px-6 xl:px-8">
            <form
              className="relative flex flex-1 max-w-2xl items-center bg-white border border-slate-200 rounded-full h-9 px-4 shadow-sm hover:border-slate-300 transition-colors"
              action="#"
              method="GET"
            >
              <label htmlFor="search-field" className="sr-only">
                Search workspace...
              </label>
              <Search
                aria-hidden="true"
                className="h-4 w-4 text-slate-400 flex-shrink-0"
              />
              <input
                id="search-field"
                className="block w-full h-full bg-transparent border-0 py-0 pl-3 pr-0 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-0"
                placeholder="Search workspace..."
                type="search"
                name="search"
              />
            </form>
          </div>

          {/* Main Dashboard Content (Scrollable independently) */}
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1440px] p-4 sm:p-6 lg:p-8">
              {children}
            </div>
          </div>
        </main>
      </div>
    </AdminSearchProvider>
  );
}
