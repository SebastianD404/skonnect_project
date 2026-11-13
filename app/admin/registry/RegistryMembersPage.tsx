import { GranteeStatus, Prisma, Role, SubmissionStatus } from "@prisma/client";
import { Users } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { hasProfilingRegistrationColumn, listProfilingRegistrations, prisma } from "@/lib/prisma";
import { formatDisplayName } from "@/lib/display-name";
import { checkAndArchiveAgedOutMembers } from "@/lib/archiveAgedOutMembers";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import { KKProfilingRegistrationsTable } from "../kk-profiling/KKProfilingRegistrationsTable";
import AdminTablePaginationFooter from "../AdminTablePaginationFooter";
import { RegistryMembersFilterBar } from "./RegistryMembersFilterBar";
import { RegistryMembersSearchStatusProvider } from "./RegistryMembersSearchStatus";

const classificationFilters = [
  "In school Youth",
  "Out of School Youth",
  "Working Youth",
  "Person w/ Disability",
  "Indigenous People",
] as const;
const skVoterFilters = ["Yes", "No"] as const;

export default async function RegistryMembersPage({
  searchParams,
  cohort,
}: {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    search?: string | string[];
    classification?: string | string[];
    skVoter?: string | string[];
  }>;
  cohort: "all" | "regular";
}) {
  const admin = await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);
  await checkAndArchiveAgedOutMembers(admin.id);

  const resolved = await searchParams;
  const rawPage = Array.isArray(resolved.page) ? resolved.page[0] : resolved.page;
  const rawPageSize = Array.isArray(resolved.pageSize) ? resolved.pageSize[0] : resolved.pageSize;
  const rawSearch = Array.isArray(resolved.search) ? resolved.search[0] : resolved.search;
  const rawClassification = Array.isArray(resolved.classification) ? resolved.classification[0] : resolved.classification;
  const rawSkVoter = Array.isArray(resolved.skVoter) ? resolved.skVoter[0] : resolved.skVoter;
  const profileSearch = cohort === "all" ? String(rawSearch ?? "").trim() : "";
  const classificationFilter = cohort === "all" && classificationFilters.includes(rawClassification as typeof classificationFilters[number])
    ? rawClassification as typeof classificationFilters[number]
    : "";
  const skVoterFilter = cohort === "all" && skVoterFilters.includes(rawSkVoter as typeof skVoterFilters[number])
    ? rawSkVoter as typeof skVoterFilters[number]
    : "";
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const requiredProfileColumns = [
    "reviewStatus",
    "submittedAt",
    "userId",
    "email",
    "youthClassification",
    "fullName",
    "address",
    "registeredSKVoter",
  ];
  const hasRequiredProfileColumns = (
    await Promise.all(requiredProfileColumns.map((column) => hasProfilingRegistrationColumn(column)))
  ).every(Boolean);
  const filterConditions: Prisma.Sql[] = [];
  if (profileSearch) {
    const escapedSearch = profileSearch.replace(/[\\%_]/g, "\\$&");
    const searchPattern = `%${escapedSearch}%`;
    filterConditions.push(Prisma.sql`(
      profile."fullName" ILIKE ${searchPattern} ESCAPE E'\\\\'
      OR profile."email" ILIKE ${searchPattern} ESCAPE E'\\\\'
      OR profile."address" ILIKE ${searchPattern} ESCAPE E'\\\\'
    )`);
  }
  if (classificationFilter) {
    filterConditions.push(Prisma.sql`profile."youthClassification" = ${classificationFilter}`);
  }
  if (skVoterFilter) {
    filterConditions.push(Prisma.sql`profile."registeredSKVoter" = ${skVoterFilter}`);
  }
  const createUniqueProfileCte = (regularOnly: boolean, applyFilters = false) => Prisma.sql`
    WITH ranked_profiles AS (
      SELECT
        registration."id",
        registration."youthClassification",
        registration."submittedAt",
        registration."fullName",
        registration."email",
        registration."address",
        registration."registeredSKVoter",
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
      SELECT
        "id",
        "youthClassification",
        "submittedAt",
        "fullName",
        "email",
        "address",
        "registeredSKVoter"
      FROM ranked_profiles
      WHERE identity_rank = 1
    ),
    filtered_profiles AS (
      SELECT profile.*
      FROM unique_profiles AS profile
      ${applyFilters && filterConditions.length > 0
        ? Prisma.sql`WHERE ${Prisma.join(filterConditions, " AND ")}`
        : Prisma.empty}
    )
  `;
  const defaultProfileCounts = {
    inSchoolYouthCount: 0,
    outOfSchoolYouthCount: 0,
    workingYouthCount: 0,
    personWithDisabilityCount: 0,
    indigenousPeopleCount: 0,
  };
  let filteredCount = 0;
  let globalTotalCount = 0;
  let approvedClassificationCounts = defaultProfileCounts;

  if (hasRequiredProfileColumns) {
    const [filteredCountRows, globalCountRows, classificationRows] = await Promise.all([
      prisma.$queryRaw<Array<{ count: number }>>(
        Prisma.sql`${createUniqueProfileCte(cohort === "regular", true)}
          SELECT COUNT(*)::int AS count FROM filtered_profiles`
      ),
      prisma.$queryRaw<Array<{ count: number }>>(
        Prisma.sql`${createUniqueProfileCte(cohort === "regular")}
          SELECT COUNT(*)::int AS count FROM filtered_profiles`
      ),
      prisma.$queryRaw<Array<{ classification: string | null; count: number }>>(
        Prisma.sql`${createUniqueProfileCte(cohort === "regular")}
          SELECT "youthClassification" AS classification, COUNT(*)::int AS count
          FROM filtered_profiles
          GROUP BY "youthClassification"`
      ),
    ]);
    const countsByClassification = new Map<string, number>();
    for (const { classification, count } of classificationRows) {
      const key = classification?.trim().toLowerCase() ?? "";
      countsByClassification.set(key, (countsByClassification.get(key) ?? 0) + count);
    }
    filteredCount = filteredCountRows[0]?.count ?? 0;
    globalTotalCount = globalCountRows[0]?.count ?? 0;
    approvedClassificationCounts = {
      inSchoolYouthCount: countsByClassification.get("in school youth") ?? 0,
      outOfSchoolYouthCount: countsByClassification.get("out of school youth") ?? 0,
      workingYouthCount: countsByClassification.get("working youth") ?? 0,
      personWithDisabilityCount: countsByClassification.get("person w/ disability") ?? 0,
      indigenousPeopleCount: countsByClassification.get("indigenous people") ?? 0,
    };
  }

  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * pageSize;
  const pageKeys = hasRequiredProfileColumns && filteredCount > 0
    ? await prisma.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`${createUniqueProfileCte(cohort === "regular", true)}
          SELECT "id"
          FROM filtered_profiles
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
        : granteeStatus === GranteeStatus.REMOVED || granteeStatus === GranteeStatus.REVOKED
          ? granteeStatus
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
  const personWithDisabilityCount = approvedClassificationCounts.personWithDisabilityCount;
  const indigenousPeopleCount = approvedClassificationCounts.indigenousPeopleCount;
  const classificationBreakdown = [
    { label: "In-School Youth", value: inSchoolYouthCount, color: "bg-cyan-500" },
    { label: "Out-of-School Youth", value: outOfSchoolYouthCount, color: "bg-indigo-500" },
    { label: "Working Youth", value: workingYouthCount, color: "bg-amber-500" },
    { label: "Person w/ Disability", value: personWithDisabilityCount, color: "bg-rose-500" },
    { label: "Indigenous People", value: indigenousPeopleCount, color: "bg-emerald-500" },
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

        <div className="grid gap-3 sm:gap-5 md:grid-cols-[minmax(220px,0.8fr)_minmax(0,2fr)]">
          <div className="relative overflow-hidden rounded-2xl bg-slate-900 p-5 text-white shadow-sm sm:p-6">
            <div aria-hidden="true" className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-cyan-500/20 blur-2xl" />
            <div className="relative flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-200">
                {cohort === "all" ? "Total Youth" : "KK Profiled Youth"}
              </span>
              <Users aria-hidden="true" className="h-5 w-5 text-cyan-200" />
            </div>
            <p className="relative mt-3 text-3xl font-black tracking-tight sm:text-4xl">
              {globalTotalCount.toLocaleString()}
            </p>
            <p className="relative mt-1 text-xs text-slate-300">
              {cohort === "all" ? "All approved profiles" : "Without an active SKEAP grant"}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-bold text-slate-900">Classification Breakdown</h2>
              <p className="text-xs text-slate-500">
                {classificationBreakdown.reduce((sum, item) => sum + item.value, 0).toLocaleString()} of {globalTotalCount.toLocaleString()} youth
              </p>
            </div>
            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {classificationBreakdown.map(({ label, value, color }) => (
                <div key={label} className="flex min-w-0 items-center gap-2">
                  <span className="w-32 shrink-0 truncate text-[11px] font-medium text-slate-600">{label}</span>
                  <div
                    className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"
                    role="progressbar"
                    aria-label={`${label} share of youth`}
                    aria-valuemin={0}
                    aria-valuemax={globalTotalCount}
                    aria-valuenow={value}
                  >
                    <div
                      className={`h-full rounded-full ${color}`}
                      style={{ width: globalTotalCount > 0 ? `${(value / globalTotalCount) * 100}%` : "0%" }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-bold tabular-nums text-slate-900">
                    {value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <section className="relative z-10 mt-4 flex w-full flex-col overflow-visible rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="w-full overflow-visible">
            <RegistryMembersSearchStatusProvider>
              <KKProfilingRegistrationsTable
                registrations={membersForTable}
                statusLabel="Approved"
                flat
                fitContainer
                archiveAction
                showMemberRoleColumn
                controlBar={cohort === "all" ? (
                  <RegistryMembersFilterBar
                    key="registry-members-filter-bar"
                    search={profileSearch}
                    classification={classificationFilter}
                    skVoter={skVoterFilter}
                  />
                ) : undefined}
              />
            </RegistryMembersSearchStatusProvider>
          </div>

          <AdminTablePaginationFooter
            totalCount={filteredCount}
            page={currentPage}
            pageSize={pageSize}
            basePath={cohort === "all" ? "/admin/registry/masterlist" : "/admin/registry/regular"}
          />
        </section>
    </div>
  );
}
