import { GranteeStatus } from "@prisma/client";
import { hasGranteeColumn, hasGranteeRetentionColumn, prisma } from "@/lib/prisma";
import { getRetentionExpiryDate } from "@/lib/grantee-retention";
import { formatDisplayName } from "@/lib/display-name";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import AdminGranteesPageClient from "../AdminGranteesPageClient";
import type { GranteeTableRow } from "../grantees/GranteeStatusTable";
import { ensureProfile } from "@/lib/auth";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { getGranteeGraduationProgress } from "@/lib/grantee-graduation-readiness";
import { normalizeAdminTablePageSize } from "@/lib/admin-pagination";
import type { Prisma } from "@prisma/client";
import { isGranteeDueForGraduation } from "@/lib/grantee-due-for-graduation";

export const dynamic = "force-dynamic";

function normalizeJourneySemesterNumber(value: number | null): 1 | 2 | null {
  return value === 1 || value === 2 ? value : null;
}

function normalizeTokens(value: string) {
  return value
    .toLowerCase()
    .replace(/[.,]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

export default async function AdminGranteesPage({ searchParams }: {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    q?: string | string[];
    search?: string | string[];
    filter?: string | string[];
  }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawPageSize = Array.isArray(resolvedSearchParams.pageSize) ? resolvedSearchParams.pageSize[0] : resolvedSearchParams.pageSize;
  const rawQ = Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q;
  const rawSearch = Array.isArray(resolvedSearchParams.search)
    ? resolvedSearchParams.search[0]
    : resolvedSearchParams.search;
  const rawFilter = Array.isArray(resolvedSearchParams.filter)
    ? resolvedSearchParams.filter[0]
    : resolvedSearchParams.filter;
  const rawQuery = rawQ ?? rawSearch;
  const query = String(rawQuery || "").trim();
  const dueFilter = rawFilter === "due";
  const submittedFilter = rawFilter === "submitted";
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const skip = (page - 1) * pageSize;
  const [
    hasRetentionColumn,
    hasGraduationReadyAtColumn,
    hasExitClearanceFileNameColumn,
    hasExitClearanceSubmittedAtColumn,
  ] = await Promise.all([
    hasGranteeRetentionColumn(),
    hasGranteeColumn("graduationReadyAt"),
    hasGranteeColumn("exitClearanceFileName"),
    hasGranteeColumn("exitClearanceSubmittedAt"),
  ]);
  const queryTokens = normalizeTokens(query);
  const searchFilter: Prisma.GranteeWhereInput = queryTokens.length
    ? {
        AND: queryTokens.map((token) => ({
          OR: [
            { user: { is: { fullName: { contains: token, mode: "insensitive" } } } },
            { user: { is: { email: { contains: token, mode: "insensitive" } } } },
            { user: { is: { phoneNumber: { contains: token, mode: "insensitive" } } } },
            { user: { is: { kkProfile: { is: { fullName: { contains: token, mode: "insensitive" } } } } } },
            { user: { is: { kkProfile: { is: { firstName: { contains: token, mode: "insensitive" } } } } } },
            { user: { is: { kkProfile: { is: { middleName: { contains: token, mode: "insensitive" } } } } } },
            { user: { is: { kkProfile: { is: { lastName: { contains: token, mode: "insensitive" } } } } } },
            { school: { contains: token, mode: "insensitive" } },
            { yearLevel: { contains: token, mode: "insensitive" } },
            {
              user: {
                is: {
                  skeapApplications: {
                    some: { contactNumber: { contains: token, mode: "insensitive" } },
                  },
                },
              },
            },
          ],
        })),
      }
    : {};
  const where: Prisma.GranteeWhereInput = {
    status: { in: [GranteeStatus.ACTIVE, GranteeStatus.PROBATIONARY] },
    ...searchFilter,
  };
  const now = new Date();
  const dueCandidates = await prisma.grantee.findMany({
    where,
    select: {
      id: true,
      status: true,
      exitClearanceStatus: true,
      yearLevel: true,
      entryAcademicYear: true,
      entrySemester: true,
      journeyStart: true,
      journeyEnd: true,
      journeyStartAcademicYear: true,
      journeyStartSemester: true,
      journeyEndSemester: true,
      dateEnrolled: true,
      submissions: {
        orderBy: { submittedAt: "desc" },
        select: {
          semester: true,
          status: true,
          submittedAt: true,
        },
      },
    },
  });
  const dueGranteeIds = dueCandidates.flatMap((grantee) => {
    const journeyProgress = getGranteeGraduationProgress({
      submissions: grantee.submissions,
      dateEnrolled: grantee.dateEnrolled,
      yearLevel: grantee.yearLevel,
      journeyStart: grantee.journeyStart,
      journeyEnd: grantee.journeyEnd,
      startAcademicYear: grantee.journeyStartAcademicYear,
      startSemester: normalizeJourneySemesterNumber(grantee.journeyStartSemester),
      endSemester: normalizeJourneySemesterNumber(grantee.journeyEndSemester),
      entryTerm: grantee.entryAcademicYear && grantee.entrySemester
        ? `${grantee.entryAcademicYear} ${grantee.entrySemester}`
        : undefined,
      now,
    });
    const isDue = grantee.exitClearanceStatus !== "CLEARED" &&
      isGranteeDueForGraduation({
        status: grantee.status,
        journeyStart: grantee.journeyStart,
        journeyEnd: grantee.journeyEnd,
        currentStepSemester: journeyProgress.currentStepSemester,
        finalJourneySemester: journeyProgress.nodes.at(-1)?.semester ?? null,
      }, now);
    return isDue ? [grantee.id] : [];
  });
  const submittedGranteeIds = dueCandidates.flatMap((grantee) =>
    grantee.exitClearanceStatus === "SUBMITTED" ? [grantee.id] : [],
  );
  const filteredWhere: Prisma.GranteeWhereInput = dueFilter
    ? { AND: [where, { id: { in: dueGranteeIds } }] }
    : submittedFilter
      ? { AND: [where, { id: { in: submittedGranteeIds } }] }
      : where;
  const [pageKeys, totalCount] = await Promise.all([
    prisma.grantee.findMany({
      where: filteredWhere,
      select: { id: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.grantee.count({ where: filteredWhere }),
  ]);
  const grantees = await prisma.grantee.findMany({
      where: { id: { in: pageKeys.map((item) => item.id) } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        ...(hasGraduationReadyAtColumn ? { graduationReadyAt: true } : {}),
        exitClearanceStatus: true,
        exitClearanceUrl: true,
        ...(hasExitClearanceFileNameColumn ? { exitClearanceFileName: true } : {}),
        ...(hasExitClearanceSubmittedAtColumn ? { exitClearanceSubmittedAt: true } : {}),
        graduationRemarks: true,
        yearLevel: true,
        entryAcademicYear: true,
        entrySemester: true,
        journeyStart: true,
        journeyEnd: true,
        journeyStartAcademicYear: true,
        journeyStartSemester: true,
        journeyEndSemester: true,
        school: true,
        dateEnrolled: true,
        graduatedAt: true,
        ...(hasRetentionColumn ? { retentionExpiresAt: true } : {}),
        createdAt: true,
        updatedAt: true,
        submissions: {
          orderBy: { submittedAt: "desc" },
          select: {
            semester: true,
            status: true,
            submittedAt: true,
          },
        },
        user: {
          select: {
            fullName: true,
            email: true,
            phoneNumber: true,
            kkProfile: {
              select: {
                firstName: true,
                middleName: true,
                lastName: true,
                fullName: true,
              },
            },
            skeapApplications: {
              orderBy: { submittedAt: "desc" },
              take: 1,
              select: { contactNumber: true },
            },
            avatarUrl: true,
          },
        },
      },
    });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await ensureProfile(user);

  if (!appUser) {
    redirect("/login");
  }

  const granteeRows: GranteeTableRow[] = grantees.map((grantee) => {
    const journeyProgress = getGranteeGraduationProgress({
      submissions: grantee.submissions,
      dateEnrolled: grantee.dateEnrolled,
      yearLevel: grantee.yearLevel,
      journeyStart: grantee.journeyStart,
      journeyEnd: grantee.journeyEnd,
      startAcademicYear: grantee.journeyStartAcademicYear,
      startSemester: normalizeJourneySemesterNumber(grantee.journeyStartSemester),
      endSemester: normalizeJourneySemesterNumber(grantee.journeyEndSemester),
      entryTerm: grantee.entryAcademicYear && grantee.entrySemester
        ? `${grantee.entryAcademicYear} ${grantee.entrySemester}`
        : undefined,
      now,
    });
    return {
      id: grantee.id,
      lastName: grantee.user.kkProfile?.lastName ?? null,
      firstName: grantee.user.kkProfile?.firstName ?? null,
      middleName: grantee.user.kkProfile?.middleName ?? null,
      profileFullName: grantee.user.kkProfile?.fullName ?? null,
      fullName: formatDisplayName(grantee.user.kkProfile, grantee.user.fullName),
      email: grantee.user.email,
      contactNumber:
        grantee.user.phoneNumber?.trim() ||
        grantee.user.skeapApplications[0]?.contactNumber?.trim() ||
        null,
      school: normalizeSkeapSchoolName(grantee.school),
      yearLevel: grantee.yearLevel,
      currentJourneySemesterIndex: journeyProgress.currentSemesterIndex,
      validatedJourneySemesterIndexes: journeyProgress.validatedSemesterIndexes,
      journeyNodes: journeyProgress.nodes.map((node) => ({
        index: node.index,
        semester: node.semester,
        yearNumber: node.yearNumber,
        semesterNumber: node.semesterNumber,
        academicTermCaption: node.academicTermCaption,
        status: node.status,
      })),
      journeyConfigured: Boolean(
        grantee.journeyStart &&
        grantee.journeyEnd &&
        grantee.journeyStartAcademicYear &&
        normalizeJourneySemesterNumber(grantee.journeyStartSemester) &&
        normalizeJourneySemesterNumber(grantee.journeyEndSemester),
      ),
      isDueForGraduation:
        grantee.exitClearanceStatus !== "CLEARED" &&
        isGranteeDueForGraduation({
          status: grantee.status,
          journeyStart: grantee.journeyStart,
          journeyEnd: grantee.journeyEnd,
          currentStepSemester: journeyProgress.currentStepSemester,
          finalJourneySemester: journeyProgress.nodes.at(-1)?.semester ?? null,
        }, now),
      status: grantee.status,
      graduationReadyAt:
        "graduationReadyAt" in grantee
          ? grantee.graduationReadyAt?.toISOString() ?? null
          : null,
      isReadyForGraduation:
        ("graduationReadyAt" in grantee && Boolean(grantee.graduationReadyAt)) ||
        (journeyProgress.nodes.length > 0 &&
          journeyProgress.validatedSemesterIndexes.length >= journeyProgress.nodes.length),
      exitClearanceStatus: grantee.exitClearanceStatus,
      exitClearanceUrl: grantee.exitClearanceUrl,
      exitClearanceFileName:
        "exitClearanceFileName" in grantee ? grantee.exitClearanceFileName : null,
      exitClearanceSubmittedAt:
        "exitClearanceSubmittedAt" in grantee
          ? grantee.exitClearanceSubmittedAt?.toISOString() ?? null
          : null,
      graduationRemarks: grantee.graduationRemarks,
      dateEnrolled: grantee.dateEnrolled.toISOString(),
      graduatedAt: grantee.graduatedAt?.toISOString() ?? null,
      retentionExpiresAt: getRetentionExpiryDate(grantee)?.toISOString() ?? null,
      updatedAt: grantee.updatedAt.toISOString(),
      detailsHref: `/admin/grantees/${grantee.id}`,
    };
  });

  const granteeRowsById = new Map(granteeRows.map((grantee) => [grantee.id, grantee]));
  const paginatedGranteeRows = pageKeys.flatMap((item) => {
    const grantee = granteeRowsById.get(item.id);
    return grantee ? [grantee] : [];
  });
  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <AdminGranteesPageClient
        grantees={paginatedGranteeRows}
        page={page}
        pageSize={pageSize}
        totalCount={totalCount}
        allCount={dueCandidates.length}
        query={query}
        dueCount={dueGranteeIds.length}
        dueFilter={dueFilter}
        submittedCount={submittedGranteeIds.length}
        submittedFilter={submittedFilter}
      />
    </div>
  );
}
