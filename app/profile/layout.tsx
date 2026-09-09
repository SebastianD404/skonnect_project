import GranteeDashboardHeader from "@/app/grantee-dashboard/GranteeDashboardHeader";

export default function ProfileLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      <GranteeDashboardHeader />
      {children}
    </div>
  );
}