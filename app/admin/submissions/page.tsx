import { redirect } from "next/navigation";

export default async function AdminSubmissionsPage() {
  redirect("/admin/grantee-submissions");
}