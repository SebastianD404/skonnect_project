import { requireRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import YouthDashboardHeader from "./YouthDashboardHeader";

export default async function YouthDashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireRole([Role.YOUTH]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      <YouthDashboardHeader />
      {children}
    </div>
  );
}
