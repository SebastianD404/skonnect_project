import { Role } from "@prisma/client";
import { BookOpen, BriefcaseBusiness, GraduationCap, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { prisma, listProfilingRegistrations, getProfilingRegistrationCountByStatus } from "@/lib/prisma";
import { KKProfilingRegistrationsTable } from "../kk-profiling/KKProfilingRegistrationsTable";
import AdminTablePaginationFooter from "../AdminTablePaginationFooter";

const PAGE_SIZES = [10, 20, 50] as const;

export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }> }) {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  const resolved = await searchParams;
  const rawPage = Array.isArray(resolved.page) ? resolved.page[0] : resolved.page;
  const rawPageSize = Array.isArray(resolved.pageSize) ? resolved.pageSize[0] : resolved.pageSize;
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = PAGE_SIZES.includes(requestedPageSize as (typeof PAGE_SIZES)[number])
    ? requestedPageSize
    : 10;
  const skip = (page - 1) * pageSize;

  const [totalCount, approvedMembers, classificationGroups] = await Promise.all([
    getProfilingRegistrationCountByStatus("Approved"),
    listProfilingRegistrations({
      where: { reviewStatus: "Approved" },
      orderBy: { submittedAt: "desc" },
      take: pageSize,
      skip,
      include: {
        user: { select: { fullName: true, email: true } },
      },
    }),
    prisma.profilingRegistration.groupBy({
      by: ["youthClassification"],
      where: { reviewStatus: "Approved" },
      _count: { _all: true },
    }),
  ]);

  const approvedClassificationCounts = new Map(
    classificationGroups.map((group) => [group.youthClassification?.trim(), group._count._all])
  );
  const inSchoolYouthCount = approvedClassificationCounts.get("In school Youth") ?? 0;
  const outOfSchoolYouthCount = approvedClassificationCounts.get("Out of School Youth") ?? 0;
  const workingYouthCount = approvedClassificationCounts.get("Working Youth") ?? 0;

  const memberCategoryStats = [
    { label: "In-School", value: inSchoolYouthCount, icon: BookOpen, description: "Enrolled youths", isHero: false },
    { label: "Out-of-School", value: outOfSchoolYouthCount, icon: GraduationCap, description: "Unenrolled youths", isHero: false },
    { label: "Working", value: workingYouthCount, icon: BriefcaseBusiness, description: "Employed youths", isHero: false },
    { label: "Total Active", value: totalCount, icon: Users, description: "Total approved profiles", isHero: true },
  ];

  return (
    <div className="flex w-full flex-col gap-6 text-slate-950">
        <header>
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-slate-900">SK Youth Members</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
            KK profiling applicants who have completed approval are counted here as official SK youth members in Barangay Pico. Monitor registration coverage and membership status below.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {memberCategoryStats.map(({ label, value, icon: Icon, description, isHero }) => (
            <div
              key={label}
              className={`relative bg-white rounded-2xl border border-slate-200/80 p-5 shadow-sm flex flex-col gap-4 overflow-hidden group transition-all duration-300 ${isHero ? "hover:shadow-md hover:border-cyan-300" : "hover:shadow-md hover:border-cyan-200"}`}
            >
              <div
                aria-hidden="true"
                className={`absolute rounded-full blur-2xl transition-colors duration-500 ${isHero ? "-top-12 -right-12 w-40 h-40 bg-cyan-100/40 group-hover:bg-cyan-200/50" : "-top-10 -right-10 w-32 h-32 bg-cyan-50/50 group-hover:bg-cyan-100/50"}`}
              />
              <div className="relative z-10 flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isHero ? "text-cyan-600" : "text-slate-400"}`}>{label}</span>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-300 ${isHero ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md" : "bg-cyan-50/70 border border-cyan-100 text-cyan-600"}`}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>
              <div className="relative z-10">
                <h2 className="text-3xl font-black tracking-tight text-slate-900 leading-none">{value}</h2>
                <p className="text-[11px] font-medium text-slate-400 mt-1.5">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <section className="mt-4 flex flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="w-full overflow-x-auto">
            <KKProfilingRegistrationsTable
              registrations={approvedMembers}
              statusLabel="Approved"
              flat
              exportHref="/api/admin/members/export"
            />
          </div>

          <AdminTablePaginationFooter
            totalCount={totalCount}
            page={page}
            pageSize={pageSize}
            basePath="/admin/members"
          />
        </section>
    </div>
  );
}
