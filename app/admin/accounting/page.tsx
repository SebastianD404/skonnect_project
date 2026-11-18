import AdminAccountingClient from "./AccountingDashboardClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default function AdminAccountingPage() {
  return <AdminAccountingClient />;
}
