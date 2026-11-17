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
import { ACTIVE_GRANTEE_WHERE } from "@/lib/skeap-capacity";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function AdminGranteesPage({ searchParams }: {
  searchParams: Promise<{ page?: string | string[]; pageSize?: string | string[]; q?: string | string[] }>;
}) {
  const resolvedSearchParams = await searchParams;
  const rawPage = Array.isArray(resolvedSearchParams.page) ? resolvedSearchParams.page[0] : resolvedSearchParams.page;
  const rawPageSize = Array.isArray(resolvedSearchParams.pageSize) ? resolvedSearchParams.pageSize[0] : resolvedSearchParams.pageSize;
  const rawQuery = Array.isArray(resolvedSearchParams.q) ? resolvedSearchParams.q[0] : resolvedSearchParams.q;
  const query = String(rawQuery || "").trim();
  const requestedPage = Number(rawPage || 1);
  const page = Number.isFinite(requestedPage) ? Math.max(1, Math.floor(requestedPage)) : 1;
  const requestedPageSize = Number(rawPageSize);
  const pageSize = normalizeAdminTablePageSize(requestedPageSize);
  const skip = (page - 1) * pageSize;
  const [hasRetentionColumn, hasGraduationReadyAtColumn] = await Promise.all([
    hasGranteeRetentionColumn(),
    hasGranteeColumn("graduationReadyAt"),
  ]);
  const searchFilter: Prisma.GranteeWhereInput = query
    ? {
        OR: [
          { user: { is: { fullName: { contains: query, mode: "insensitive" } } } },
          { user: { is: { email: { contains: query, mode: "insensitive" } } } },
          { user: { is: { phoneNumber: { contains: query, mode: "insensitive" } } } },
          {
            user: {
              is: {
                kkProfile: {
                  is: { fullName: { contains: query, mode: "insensitive" } },
                },
              },
            },
          },
          {
            user: {
              is: {
                kkProfile: {
                  is: { firstName: { contains: query, mode: "insensitive" } },
                },
              },
            },
          },
          {
            user: {
              is: {
                kkProfile: {
                  is: { middleName: { contains: query, mode: "insensitive" } },
                },
              },
            },
          },
          {
            user: {
              is: {
                kkProfile: {
                  is: { lastName: { contains: query, mode: "insensitive" } },
                },
              },
            },
          },
          {
            user: {
              is: {
                kkProfile: {
                  is: { contactNumber: { contains: query, mode: "insensitive" } },
                },
              },
            },
          },
          { school: { contains: query, mode: "insensitive" } },
          { yearLevel: { contains: query, mode: "insensitive" } },
          {
            user: {
              is: {
                skeapApplications: {
                  some: { contactNumber: { contains: query, mode: "insensitive" } },
                },
              },
            },
          },
        ],
      }
    : {};
  const where: Prisma.GranteeWhereInput = { ...ACTIVE_GRANTEE_WHERE, ...searchFilter };
  const [pageKeys, totalCount] = await Promise.all([
    prisma.grantee.findMany({
      where,
      select: { id: true },
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip,
      take: pageSize,
    }),
    prisma.grantee.count({ where }),
  ]);
  const grantees = await prisma.grantee.findMany({
      where: { id: { in: pageKeys.map((item) => item.id) } },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        status: true,
        ...(hasGraduationReadyAtColumn ? { graduationReadyAt: true } : {}),
        exitClearanceStatus: true,
        yearLevel: true,
        entryAcademicYear: true,
        entrySemester: true,
        journeyStart: true,
        journeyEnd: true,
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
      entryTerm: grantee.entryAcademicYear && grantee.entrySemester
        ? `${grantee.entryAcademicYear} ${grantee.entrySemester}`
        : undefined,
    });
    return {
      id: grantee.id,
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
      status: "ACTIVE",
      graduationReadyAt:
        "graduationReadyAt" in grantee
          ? grantee.graduationReadyAt?.toISOString() ?? null
          : null,
      isReadyForGraduation:
        ("graduationReadyAt" in grantee && Boolean(grantee.graduationReadyAt)) ||
        (journeyProgress.nodes.length > 0 &&
          journeyProgress.validatedSemesterIndexes.length >= journeyProgress.nodes.length),
      exitClearanceStatus: grantee.exitClearanceStatus,
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
        query={query}
      />
    </div>
  );
}
