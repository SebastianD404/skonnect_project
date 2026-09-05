import GranteeDashboardHeader from "@/app/grantee-dashboard/GranteeDashboardHeader";

export default function GranteeLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <GranteeDashboardHeader />
      {children}
    </>
  );
}