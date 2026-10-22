import { Role } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireRole } from "@/lib/auth";

export default async function KnowledgeBaseAuditPage() {
  const adminUser = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  redirect(adminUser.role === Role.SUPER_ADMIN ? "/system-admin/knowledge-base" : "/admin?reason=unauthorized");
}
