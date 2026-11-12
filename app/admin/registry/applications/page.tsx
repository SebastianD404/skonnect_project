import { redirect } from "next/navigation";

export default function ProfilingApplicationsPage() {
  redirect("/admin/kk-profiling?status=pending");
}
