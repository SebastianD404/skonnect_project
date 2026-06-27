import { prisma } from "@/lib/prisma";
import UserRoleManager from "../UserRoleManager";

export default async function SystemAdminUsersPage() {
  const users = await prisma.user.findMany({
    take: 50,
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      fullName: true,
      email: true,
      role: true,
      isActive: true,
      updatedAt: true,
    },
  });

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span>System Admin</span>
        <span>/</span>
        <span className="text-slate-900">Role Management</span>
      </div>

      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">System Admin</p>
        <h1 className="text-4xl font-black text-slate-950 sm:text-5xl">Role Management</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Assign and update user roles. Only SUPER_ADMIN can perform role changes.
        </p>
      </header>

      <UserRoleManager
        users={users.map((user) => ({
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          updatedAt: user.updatedAt.toISOString(),
        }))}
      />
    </div>
  );
}
