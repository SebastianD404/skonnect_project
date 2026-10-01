import { redirect } from "next/navigation";

export default function LegacyRoleManagementPage() {
  redirect("/system-admin/users");
}
