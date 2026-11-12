import { GranteeStatus, Prisma, Role, SubmissionStatus } from "@prisma/client";
import { BookOpen, BriefcaseBusiness, GraduationCap, Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { hasProfilingRegistrationColumn, listProfilingRegistrations, prisma } from "@/lib/prisma";
import { formatDisplayName } from "@/lib/display-name";
import { checkAndArchiveAgedOutMembers } from "@/lib/archiveAgedOutMembers";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import { KKProfilingRegistrationsTable } from "../kk-profiling/KKProfilingRegistrationsTable";
import AdminTablePaginationFooter from "../AdminTablePaginationFooter";
import { MembersExportMenu } from "../members/MembersExportMenu";

export default async function RegistryMembersPage({
  searchParams,
  cohort,
}: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[] }>;
  cohort: "all" | "regular";
}) {
  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  await checkAndArchiveAgedOutMembers(admin.id);

  const resolved = await searchParams;
  const rawPage = Array.isArray(resolved.page) ? resolved.page[0] : resolved.page;
  const rawPageSize = Array.isArray(resolved.pageSize) ? resolved.pageSize[0] : resolved.pageSize;
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const requiredProfileColumns = ["reviewStatus", "submittedAt", "userId", "email", "youthClassification"];
  const hasRequiredProfileColumns = (
    await Promise.all(requiredProfileColumns.map((column) => hasProfilingRegistrationColumn(column)))
  ).every(Boolean);
  const createUniqueProfileCte = (regularOnly: boolean) => Prisma.sql`
    WITH ranked_profiles AS (
      SELECT
        registration."id",
        registration."youthClassification",
        registration."submittedAt",
        ROW_NUMBER() OVER (
          PARTITION BY COALESCE(
            NULLIF(LOWER(BTRIM(user_record."email")), ''),
            NULLIF(LOWER(BTRIM(registration."email")), ''),
            NULLIF(registration."userId", ''),
            registration."id"
          )
          ORDER BY registration."submittedAt" DESC, registration."id" DESC
        ) AS identity_rank
      FROM public."kk_profiling_registrations" AS registration
      LEFT JOIN public."users" AS user_record
        ON user_record."id" = registration."userId"
      LEFT JOIN public."grantees" AS grantee_record
        ON grantee_record."userId" = user_record."id"
      WHERE registration."reviewStatus" = 'Approved'
        AND (
          ${!regularOnly}::boolean
          OR user_record."role"::text IS DISTINCT FROM 'GRANTEE'
          OR grantee_record."status"::text IS DISTINCT FROM 'ACTIVE'
        )
    ),
    unique_profiles AS (
      SELECT "id", "youthClassification", "submittedAt"
      FROM ranked_profiles
      WHERE identity_rank = 1
    )
  `;
  const defaultProfileCounts = {
    inSchoolYouthCount: 0,
    outOfSchoolYouthCount: 0,
    workingYouthCount: 0,
  };
  let totalCount = 0;
  let approvedClassificationCounts = defaultProfileCounts;

  if (hasRequiredProfileColumns) {
    const [filteredCountRows, classificationCountRows] = await Promise.all([
      prisma.$queryRaw<Array<{ count: number }>>(
        Prisma.sql`${createUniqueProfileCte(cohort === "regular")}
          SELECT COUNT(*)::int AS count FROM unique_profiles`
      ),
      prisma.$queryRaw<Array<{
        inSchoolYouthCount: number;
        outOfSchoolYouthCount: number;
        workingYouthCount: number;
      }>>(
        Prisma.sql`${createUniqueProfileCte(false)}
          SELECT
            COUNT(*) FILTER (WHERE "youthClassification" = 'In school Youth')::int AS "inSchoolYouthCount",
            COUNT(*) FILTER (WHERE "youthClassification" = 'Out of School Youth')::int AS "outOfSchoolYouthCount",
            COUNT(*) FILTER (WHERE "youthClassification" = 'Working Youth')::int AS "workingYouthCount"
          FROM unique_profiles`
      ),
    ]);
    totalCount = filteredCountRows[0]?.count ?? 0;
    approvedClassificationCounts = classificationCountRows[0] ?? defaultProfileCounts;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * pageSize;
  const pageKeys = hasRequiredProfileColumns && totalCount > 0
    ? await prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`${createUniqueProfileCte(cohort === "regular")}
          SELECT "id"
          FROM unique_profiles
          ORDER BY "submittedAt" DESC, "id" DESC
          LIMIT ${pageSize} OFFSET ${skip}`
      )
    : [];
  const pageRecords = pageKeys.length > 0
    ? await listProfilingRegistrations({
        where: { id: { in: pageKeys.map(({ id }) => id) } },
        include: {
          user: {
            select: {
              fullName: true,
              email: true,
              role: true,
              kkProfile: {
                select: {
                  firstName: true,
                  middleName: true,
                  lastName: true,
                },
              },
              grantee: { select: { id: true, status: true } },
              skeapApplications: {
                where: {
                  status: {
                    in: [
                      SubmissionStatus.APPROVED,
                      SubmissionStatus.WAITLISTED,
                      SubmissionStatus.PENDING,
                      SubmissionStatus.REMOVED,
                    ],
                  },
                },
                orderBy: { submittedAt: "desc" },
                select: { status: true },
              },
            },
          },
        },
      })
    : [];
  const pageRecordsById = new Map(pageRecords.map((member) => [member.id, member]));
  const pagedMembers = pageKeys.flatMap(({ id }) => {
    const member = pageRecordsById.get(id);
    return member ? [member] : [];
  });
  const membersForTable = pagedMembers.map((member) => {
    const applicationStatuses = member.user?.skeapApplications.map((application) => application.status) ?? [];
    const granteeStatus = member.user?.grantee?.status;
    const isActiveScholar =
      member.user?.role === Role.GRANTEE &&
      granteeStatus === GranteeStatus.ACTIVE;
    const isProbationaryGrantee =
      member.user?.role === Role.GRANTEE && granteeStatus === GranteeStatus.PROBATIONARY;
    const skeapStatus = isActiveScholar
      ? GranteeStatus.ACTIVE
      : isProbationaryGrantee
        ? GranteeStatus.PROBATIONARY
        : granteeStatus === GranteeStatus.REMOVED
          ? GranteeStatus.REMOVED
          : applicationStatuses.includes(SubmissionStatus.APPROVED)
            ? SubmissionStatus.APPROVED
            : applicationStatuses.includes(SubmissionStatus.WAITLISTED)
              ? SubmissionStatus.WAITLISTED
              : applicationStatuses.includes(SubmissionStatus.PENDING)
                ? SubmissionStatus.PENDING
                : "NONE";

    const profileName = member.user?.kkProfile;
    const fullName = formatDisplayName(profileName, member.fullName);

    return { ...member, fullName, skeapStatus };
  });
  const inSchoolYouthCount = approvedClassificationCounts.inSchoolYouthCount;
  const outOfSchoolYouthCount = approvedClassificationCounts.outOfSchoolYouthCount;
  const workingYouthCount = approvedClassificationCounts.workingYouthCount;

  const memberCategoryStats = [
    { label: "In-School", value: inSchoolYouthCount, icon: BookOpen, description: "Enrolled youths", isHero: false },
    { label: "Out-of-School", value: outOfSchoolYouthCount, icon: GraduationCap, description: "Unenrolled youths", isHero: false },
    { label: "Working", value: workingYouthCount, icon: BriefcaseBusiness, description: "Employed youths", isHero: false },
    {
      label: cohort === "all" ? "Total Youth" : "KK Profiled Youth",
      value: totalCount,
      icon: Users,
      description: cohort === "all" ? "All approved profiles" : "Without an active SKEAP grant",
      isHero: true,
    },
  ];

  return (
    <div className="w-full max-w-[1200px] mx-auto flex flex-col gap-6 sm:gap-8 text-slate-950">
        <header>
          <h1 className="mb-1.5 text-2xl font-bold tracking-tight text-slate-900">
            {cohort === "all" ? "All Profiled Youth" : "KK Profiled Youth"}
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-500">
            {cohort === "all"
              ? "Approved KK profiles across Barangay Pico, including active SKEAP scholars."
              : "Approved KK profiles without an active or approved SKEAP grant."}
          </p>
        </header>

        <div className="grid grid-cols-2 gap-3 sm:gap-6 xl:grid-cols-4">
          {memberCategoryStats.map(({ label, value, icon: Icon, description, isHero }) => (
            <div
              key={label}
              className={`relative bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-sm flex flex-col gap-3 overflow-hidden group transition-all duration-300 sm:gap-4 sm:p-5 ${isHero ? "hover:shadow-md hover:border-cyan-300" : "hover:shadow-md hover:border-cyan-200"}`}
            >
              <div
                aria-hidden="true"
                className={`absolute rounded-full blur-2xl transition-colors duration-500 ${isHero ? "-top-12 -right-12 w-40 h-40 bg-cyan-100/40 group-hover:bg-cyan-200/50" : "-top-10 -right-10 w-32 h-32 bg-cyan-50/50 group-hover:bg-cyan-100/50"}`}
              />
              <div className="relative z-10 flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-widest ${isHero ? "text-cyan-600" : "text-slate-400"}`}>{label}</span>
                <div className={`w-7 h-7 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-300 ${isHero ? "bg-gradient-to-br from-cyan-500 to-cyan-600 text-white shadow-md" : "bg-cyan-50/70 border border-cyan-100 text-cyan-600"}`}>
                  <Icon className="h-3.5 w-3.5 sm:h-5 sm:w-5" />
                </div>
              </div>
              <div className="relative z-10">
                <h2 className="text-xl font-black tracking-tight text-slate-900 leading-none sm:text-3xl">{value}</h2>
                <p className="mt-1 text-[10px] font-medium text-slate-400 sm:mt-1.5 sm:text-[11px]">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <section className="relative z-10 mt-4 flex w-full flex-col overflow-visible rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="w-full overflow-visible">
            <KKProfilingRegistrationsTable
              registrations={membersForTable}
              statusLabel="Approved"
              flat
              fitContainer
              archiveAction
              showMemberRoleColumn
              exportMenu={cohort === "all" ? <MembersExportMenu key="members-export-menu" /> : undefined}
            />
          </div>

          <AdminTablePaginationFooter
            totalCount={totalCount}
            page={currentPage}
            pageSize={pageSize}
            basePath={cohort === "all" ? "/admin/registry/masterlist" : "/admin/registry/regular"}
          />
        </section>
    </div>
  );
}
