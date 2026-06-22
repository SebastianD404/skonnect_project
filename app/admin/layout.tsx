import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  return children;
}