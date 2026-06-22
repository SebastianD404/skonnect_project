import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DashboardHeaderActions } from "@/app/components/DashboardHeaderActions";

export default async function SystemAdminDashboardPage() {
  const [activeUserCount, roleUpdateCount, recentUsers, recentAudits] = await Promise.all([
    prisma.user.count({
      where: { isActive: true },
    }),
    prisma.auditLog.count({
      where: {
        action: {
          contains: "ROLE",
          mode: "insensitive",
        },
      },
    }),
    prisma.user.findMany({
      take: 4,
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        role: true,
        isActive: true,
        updatedAt: true,
      },
    }),
    prisma.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        action: true,
        targetTable: true,
        targetId: true,
        createdAt: true,
        actor: {
          select: {
            fullName: true,
            email: true,
          },
        },
      },
    }),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      <header className="sticky top-0 z-50 border-b border-white/50 bg-gradient-to-b from-[#FAFBFC]/95 to-[#F5F7FB]/90 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F3D5C] to-[#0D2E47] shadow-lg text-xs font-black tracking-tighter text-white">
              SK
            </div>
            <span className="text-xl font-black tracking-tight text-[#0F3D5C]">SKonnect</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <Link href="#overview" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Overview</Link>
            <Link href="#users" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Users</Link>
            <Link href="#audit" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Audit</Link>
          </nav>
          <DashboardHeaderActions requiredRole="SUPER_ADMIN" />
        </div>
      </header>

      <main className="relative overflow-hidden pt-14 pb-20">
        <div className="absolute top-24 right-0 w-96 h-96 bg-gradient-to-br from-[#0F3D5C]/10 to-[#00B4E5]/5 rounded-full blur-3xl -z-10"></div>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-[1.25fr_0.85fr] items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                <span className="w-2 h-2 bg-[#0F3D5C] rounded-full"></span>
                System Admin Console
              </div>
              <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight bg-gradient-to-r from-[#0F3D5C] via-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                Oversee users, permissions, and audit history.
              </h1>
              <p className="text-xl text-[#555555] max-w-2xl leading-relaxed">
                Manage roles, review system logs, and keep the SKonnect platform secure and compliant for Barangay Pico.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4">
                <a href="#users" className="group px-8 py-4 bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] text-white font-bold rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2">
                  Manage users
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </a>
                <a href="#audit" className="px-8 py-4 border-2 border-[#0F3D5C]/30 text-[#0F3D5C] font-bold rounded-xl hover:border-[#0F3D5C] hover:bg-[#0F3D5C]/5 transition-all duration-300">
                  Audit history
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white/80 p-10 shadow-xl backdrop-blur-xl">
              <div className="mb-6 rounded-3xl bg-gradient-to-r from-[#0F3D5C] to-[#00B4E5] p-8 text-white shadow-lg">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-200">System overview</p>
                <h2 className="mt-4 text-3xl font-black">Governance at a glance</h2>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Quickly identify account activity, role assignments, and potential data issues.
                </p>
              </div>
              <div className="space-y-4">
                <StatCard title="Active users" value={activeUserCount.toString()} note="Includes youth, grantees, and officials." />
                <StatCard title="Role updates" value={roleUpdateCount.toString()} note="Review role-related audit entries." />
                <StatCard title="Recent audits" value={recentAudits.length.toString()} note="Track the latest admin actions." />
              </div>
            </div>
          </div>

          <section id="users" className="mt-24">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                User management
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                Control access and role assignments.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {recentUsers.length > 0 ? (
                recentUsers.map((user) => (
                  <UserCard
                    key={user.id}
                    name={user.fullName}
                    email={user.email}
                    role={user.role}
                    active={user.isActive}
                    updatedAt={user.updatedAt.toLocaleDateString()}
                  />
                ))
              ) : (
                <div className="md:col-span-2 rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-10 shadow-sm">
                  <p className="text-lg font-semibold text-[#0F3D5C]">No users found.</p>
                  <p className="mt-3 text-sm leading-6 text-[#555555]">Once user profiles exist in the database, they will appear here automatically.</p>
                </div>
              )}
            </div>
          </section>

          <section id="audit" className="mt-24 pb-16">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                Audit logs
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                Monitor system activity and changes.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {recentAudits.length > 0 ? (
                recentAudits.map((audit) => (
                  <AuditCard
                    key={audit.id}
                    action={audit.action}
                    targetTable={audit.targetTable}
                    targetId={audit.targetId}
                    actorName={audit.actor.fullName}
                    actorEmail={audit.actor.email}
                    createdAt={audit.createdAt.toLocaleDateString()}
                  />
                ))
              ) : (
                <div className="md:col-span-2 rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-10 shadow-sm">
                  <p className="text-lg font-semibold text-[#0F3D5C]">No audit entries found.</p>
                  <p className="mt-3 text-sm leading-6 text-[#555555]">Audit entries will appear here once the app starts writing system change logs.</p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-[#0F3D5C]/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0F3D5C]/70">{title}</p>
      <p className="mt-4 text-4xl font-black text-[#0F3D5C]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[#5F6F84]">{note}</p>
    </div>
  );
}

function ActionCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-gradient-to-br from-white to-[#F5F7FB] p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <p className="text-xl font-bold text-[#0F3D5C]">{title}</p>
      <p className="mt-4 text-sm leading-6 text-[#555555]">{description}</p>
    </div>
  );
}

function UserCard({
  name,
  email,
  role,
  active,
  updatedAt,
}: {
  name: string;
  email: string;
  role: string;
  active: boolean;
  updatedAt: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-[#0F3D5C]">{name}</p>
          <p className="mt-2 text-sm text-[#5F6F84]">{email}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${active ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-700"}`}>
          {active ? "Active" : "Inactive"}
        </span>
      </div>
      <div className="mt-5 space-y-2 text-sm text-[#5F6F84]">
        <p><span className="font-semibold text-[#0F3D5C]">Role:</span> {role}</p>
        <p><span className="font-semibold text-[#0F3D5C]">Updated:</span> {updatedAt}</p>
      </div>
    </div>
  );
}

function AuditCard({
  action,
  targetTable,
  targetId,
  actorName,
  actorEmail,
  createdAt,
}: {
  action: string;
  targetTable: string;
  targetId: string;
  actorName: string;
  actorEmail: string;
  createdAt: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-gradient-to-br from-white to-[#F5F7FB] p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-[#0F3D5C]">{action}</p>
          <p className="mt-2 text-sm text-[#5F6F84]">{actorName} · {actorEmail}</p>
        </div>
        <span className="rounded-full bg-[#0F3D5C]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3D5C]">{targetTable}</span>
      </div>
      <div className="mt-5 space-y-2 text-sm text-[#5F6F84]">
        <p><span className="font-semibold text-[#0F3D5C]">Target ID:</span> {targetId}</p>
        <p><span className="font-semibold text-[#0F3D5C]">Recorded:</span> {createdAt}</p>
      </div>
    </div>
  );
}
