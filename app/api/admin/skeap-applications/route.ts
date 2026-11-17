import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { mapInquiryToApplication, SKEAP_APPLICATION_SELECT } from "@/lib/skeap-applications";
import { getAcademicYearDateRange, getCurrentAcademicYear } from "@/lib/semester";
import { getSkeapCapacitySnapshot } from "@/lib/skeap-capacity";
import { getPermanentlyDisqualifiedSkeapRecords } from "@/lib/skeap-permanent-disqualification-records";
import {
  countSkeapAdminQueueRows,
  getSkeapAdminQueueRows,
  getSkeapAdminViewCounts,
  type SkeapAdminQueueFilter,
} from "@/lib/admin-application-views";

const PAGE_SIZE = 15;
type SelectedSkeapInquiry = Prisma.InquiryGetPayload<{ select: typeof SKEAP_APPLICATION_SELECT }>;

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const appUser = await ensureProfile(user);
  return appUser?.role === Role.SK_OFFICIAL || appUser?.role === Role.SUPER_ADMIN;
}

export async function GET(request: NextRequest) {
  try {
    if (!(await authorizeAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const params = request.nextUrl.searchParams;
    const cursorId = params.get("cursorId");
    const cursorDateValue = params.get("cursorDate");
    const cursorDate = cursorDateValue ? new Date(cursorDateValue) : null;
    const academicYear = params.get("academicYear") ?? getCurrentAcademicYear();
    const range = getAcademicYearDateRange(academicYear);
    const searchTerm = params.get("search")?.trim() ?? "";
    const isSearch = searchTerm.length >= 2;
    const filter: SkeapAdminQueueFilter = isSearch
      ? "search"
      : params.get("filter") === "withdrawn"
        ? "withdrawn"
        : params.get("filter") === "returned"
          ? "returned"
          : "queue";

    if (!range) {
      return NextResponse.json({ error: "Invalid academic year." }, { status: 400 });
    }
    if (cursorId && (!cursorDate || Number.isNaN(cursorDate.getTime()))) {
      return NextResponse.json({ error: "Invalid pagination cursor." }, { status: 400 });
    }

    const [rows, viewCounts, totalCount, capacitySnapshot] = await Promise.all([
      getSkeapAdminQueueRows({
        range,
        filter,
        search: isSearch ? searchTerm : undefined,
        cursor: cursorId && cursorDate ? { id: cursorId, createdAt: cursorDate } : null,
        take: PAGE_SIZE + 1,
      }),
      cursorId ? Promise.resolve(null) : getSkeapAdminViewCounts(range),
      isSearch
        ? countSkeapAdminQueueRows({ range, filter: "search", search: searchTerm })
        : Promise.resolve(null),
      cursorId ? Promise.resolve(null) : getSkeapCapacitySnapshot(),
    ]);

    const hasNextPage = rows.length > PAGE_SIZE;
    const pageRows = rows.slice(0, PAGE_SIZE);
    const inquiryIds = pageRows
      .map((row) => row.inquiryId)
      .filter((id): id is string => Boolean(id));
    const [inquiries, permanentRecords] = await Promise.all([
      inquiryIds.length
        ? prisma.inquiry.findMany({
            where: { id: { in: inquiryIds } },
            select: SKEAP_APPLICATION_SELECT,
          })
        : Promise.resolve([] as SelectedSkeapInquiry[]),
      getPermanentlyDisqualifiedSkeapRecords(),
    ]);
    const inquiriesById = new Map<string, SelectedSkeapInquiry>();
    for (const inquiry of inquiries) inquiriesById.set(inquiry.id, inquiry);
    const applications = inquiryIds
      .map((id) => inquiriesById.get(id))
      .filter((inquiry): inquiry is NonNullable<typeof inquiry> => Boolean(inquiry))
      .map((inquiry) => mapInquiryToApplication(inquiry, permanentRecords));
    const lastRow = pageRows[pageRows.length - 1];
    const metrics = viewCounts && capacitySnapshot
      ? {
          counts: {
            pending: viewCounts.pendingCount,
            returned: viewCounts.returnedCount,
            physicalCtc: viewCounts.physicalCtcCount,
            resubmitted: viewCounts.resubmittedCount,
            withdrawn: viewCounts.withdrawnCount,
          },
          capacityFull: capacitySnapshot?.isFull ?? false,
        }
      : null;

    return NextResponse.json({
      applications,
      counts: metrics?.counts,
      capacityFull: metrics?.capacityFull,
      totalCount,
      hasNextPage,
      pendingCount: viewCounts?.pendingCount,
      returnedCount: viewCounts?.returnedCount,
      resubmittedCount: viewCounts?.resubmittedCount,
      physicalCtcCount: viewCounts?.physicalCtcCount,
      withdrawnCount: viewCounts?.withdrawnCount,
      nextCursor: hasNextPage && lastRow?.inquiryId && lastRow.inquiryCreatedAt
        ? { id: lastRow.inquiryId, createdAt: lastRow.inquiryCreatedAt.toISOString() }
        : null,
    });
  } catch (error) {
    console.error("Failed to load SKEAP application page:", error);
    return NextResponse.json(
      {
        error: "Failed to load applications.",
        detail: error instanceof Error ? error.message : "Unexpected server error.",
      },
      { status: 500 },
    );
  }
}
