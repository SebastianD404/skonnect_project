import { GranteeStatus, Role, SubmissionStatus } from "@prisma/client";
import { BookOpen, BriefcaseBusiness, GraduationCap, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { listProfilingRegistrations } from "@/lib/prisma";
import { checkAndArchiveAgedOutMembers } from "@/lib/archiveAgedOutMembers";
import { KKProfilingRegistrationsTable } from "../kk-profiling/KKProfilingRegistrationsTable";
import AdminTablePaginationFooter from "../AdminTablePaginationFooter";
import { MembersExportMenu } from "./MembersExportMenu";

const PAGE_SIZES = [10, 20, 50] as const;

export default async function AdminMembersPage({ searchParams }: { searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[]; memberType?: string | string[] }> }) {
  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  await checkAndArchiveAgedOutMembers(admin.id);

  const resolved = await searchParams;
  const rawPage = Array.isArray(resolved.page) ? resolved.page[0] : resolved.page;
  const rawPageSize = Array.isArray(resolved.pageSize) ? resolved.pageSize[0] : resolved.pageSize;
  const rawMemberType = Array.isArray(resolved.memberType) ? resolved.memberType[0] : resolved.memberType;
  const memberTypeFilter = rawMemberType === "grantees" || rawMemberType === "kk"
    ? rawMemberType
    : "all";
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = PAGE_SIZES.includes(requestedPageSize as (typeof PAGE_SIZES)[number])
    ? requestedPageSize
    : 10;
  const skip = (page - 1) * pageSize;

  const approvedMembers = await listProfilingRegistrations({
    where: { reviewStatus: "Approved" },
    orderBy: { submittedAt: "desc" },
    include: {
      user: {
        select: {
          fullName: true,
          email: true,
          grantee: { select: { id: true, status: true } },
          skeapApplications: {
            where: {
              status: { in: [SubmissionStatus.WAITLISTED, SubmissionStatus.PENDING] },
            },
            orderBy: { submittedAt: "desc" },
            select: { status: true },
          },
        },
      },
    },
  });

  const uniqueApprovedMembers = Array.from(
    new Map(
      approvedMembers.map((member) => {
        const identityKey = (member.user?.email || member.email || member.userId || "").trim().toLowerCase();
        return [identityKey || member.id, member];
      })
    ).values()
  );
  const filteredMembers = uniqueApprovedMembers.filter((member) => {
    const granteeStatus = member.user?.grantee?.status;
    const isActiveGrantee =
      granteeStatus === GranteeStatus.ACTIVE || granteeStatus === GranteeStatus.PROBATIONARY;
    if (memberTypeFilter === "grantees") return isActiveGrantee;
    if (memberTypeFilter === "kk") return !isActiveGrantee;
    return true;
  });
  const totalCount = filteredMembers.length;
  const pagedMembers = filteredMembers.slice(skip, skip + pageSize);
  const approvedClassificationCounts = new Map<string | null, number>();
  for (const member of uniqueApprovedMembers) {
    const classification = member.youthClassification?.trim() ?? null;
    approvedClassificationCounts.set(classification, (approvedClassificationCounts.get(classification) ?? 0) + 1);
  }
  const membersForTable = pagedMembers.map((member) => {
    const applicationStatuses = member.user?.skeapApplications.map((application) => application.status) ?? [];
    const skeapStatus = applicationStatuses.includes(SubmissionStatus.WAITLISTED)
      ? SubmissionStatus.WAITLISTED
      : applicationStatuses.includes(SubmissionStatus.PENDING)
        ? SubmissionStatus.PENDING
        : member.user?.grantee?.status ?? "NONE";

    return { ...member, skeapStatus };
  });
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

        <section className="relative z-10 mt-4 flex flex-col overflow-visible rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="w-full overflow-visible">
            <KKProfilingRegistrationsTable
              registrations={membersForTable}
              statusLabel="Approved"
              flat
              fitContainer
              archiveAction
              showMemberRoleColumn
              memberTypeFilter={memberTypeFilter}
              exportMenu={<MembersExportMenu key="members-export-menu" />}
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
