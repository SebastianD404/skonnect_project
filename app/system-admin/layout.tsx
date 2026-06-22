import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";

export default async function SystemAdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await requireRole([Role.SUPER_ADMIN]);

  return children;
}