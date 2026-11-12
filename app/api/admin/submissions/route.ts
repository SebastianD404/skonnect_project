import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import { DEFAULT_ADMIN_TABLE_PAGE_SIZE, normalizeAdminTablePageSize } from "@/lib/admin-pagination";

const STATUS_FILTERS = ["pending", "returned", "cleared"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function getStatusWhere(status: StatusFilter): Prisma.SubmissionWhereInput {
  const hasBothDocuments = {
    coeFileUrl: { not: "" },
    gradeFileUrl: { not: "" },
  };

  switch (status) {
    case "pending":
      return { ...hasBothDocuments, status: "PENDING" };
    case "returned":
      return {
        ...hasBothDocuments,
        status: { in: ["RETURNED_FOR_EDIT", "REJECTED"] },
      };
    case "cleared":
      return { ...hasBothDocuments, status: "APPROVED" };
  }
}

function buildSearchWhere(search: string): Prisma.SubmissionWhereInput | null {
  if (!search) return null;

  const contains = { contains: search, mode: Prisma.QueryMode.insensitive };
  return {
    OR: [
      { semester: contains },
      { grantee: { is: { school: contains } } },
      { grantee: { is: { yearLevel: contains } } },
      { grantee: { is: { user: { is: { fullName: contains } } } } },
      { grantee: { is: { user: { is: { email: contains } } } } },
    ],
  };
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await ensureProfile(user);
  if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const statusValue = params.get("status") ?? "pending";
  if (!STATUS_FILTERS.includes(statusValue as StatusFilter)) {
    return NextResponse.json({ error: "Invalid submissions status filter." }, { status: 400 });
  }

  const statusFilter = statusValue as StatusFilter;
  const requestedPage = Number.parseInt(params.get("page") ?? "1", 10);
  const requestedLimit = Number.parseInt(params.get("limit") ?? String(DEFAULT_ADMIN_TABLE_PAGE_SIZE), 10);
  const pageSize = normalizeAdminTablePageSize(requestedLimit);
  const pageNumber = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const semester = params.get("semester")?.trim() ?? "";
  const search = params.get("search")?.trim() ?? "";
  const searchWhere = buildSearchWhere(search);
  const currentWhere: Prisma.SubmissionWhereInput = {
    AND: [
      getStatusWhere(statusFilter),
      ...(statusFilter === "cleared" && semester && semester !== "all" ? [{ semester }] : []),
      ...(searchWhere ? [searchWhere] : []),
    ],
  };

  const countWhere = (statusToCount: StatusFilter): Prisma.SubmissionWhereInput => getStatusWhere(statusToCount);

  try {
    const [
      totalCount,
      pendingReviewCount,
      returnedForEditsCount,
      fullyClearedCount,
      semesterRows,
      academicTermState,
    ] = await Promise.all([
      prisma.submission.count({ where: currentWhere }),
      prisma.submission.count({ where: countWhere("pending") }),
      prisma.submission.count({ where: countWhere("returned") }),
      prisma.submission.count({ where: countWhere("cleared") }),
      statusFilter === "cleared"
        ? prisma.submission.findMany({
            where: getStatusWhere("cleared"),
            distinct: ["semester"],
            orderBy: { semester: "asc" },
            select: { semester: true },
          })
        : Promise.resolve([]),
      getAcademicTermScheduleState(),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(pageNumber, totalPages);
    const selectSubmission = (includeFlaggedFields: boolean, includeStrictManualReview: boolean) => ({
      id: true,
      semester: true,
      gradeFileUrl: true,
      coeFileUrl: true,
      ...(includeStrictManualReview ? { requiresStrictManualReview: true } : {}),
      status: true,
      coeStatus: true,
      gradesStatus: true,
      reviewNotes: true,
      ...(includeFlaggedFields ? { flaggedFields: true } : {}),
      submittedAt: true,
      grantee: {
        select: {
          school: true,
          yearLevel: true,
          user: { select: { fullName: true, email: true } },
        },
      },
    });

    let submissions;
    try {
      submissions = await prisma.submission.findMany({
        where: currentWhere,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: selectSubmission(true, true),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const missingFlaggedFields = /flaggedFields/i.test(message);
      const missingStrictManualReview = /requiresStrictManualReview/i.test(message);
      if (!missingFlaggedFields && !missingStrictManualReview) throw error;

      console.warn("Admin submissions query is using a legacy Prisma field selection.", {
        missingFlaggedFields,
        missingStrictManualReview,
      });
      submissions = await prisma.submission.findMany({
        where: currentWhere,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: selectSubmission(!missingFlaggedFields, !missingStrictManualReview),
      });
    }

    const rows = submissions.map((submission) => ({
      ...submission,
      flaggedFields: "flaggedFields" in submission ? submission.flaggedFields ?? [] : [],
      requiresStrictManualReview:
        "requiresStrictManualReview" in submission
          ? submission.requiresStrictManualReview
          : false,
      submittedAt: submission.submittedAt.toISOString(),
    }));

    return NextResponse.json({
      rows,
      counts: {
        pending: pendingReviewCount,
        returned: returnedForEditsCount,
        cleared: fullyClearedCount,
      },
      totalCount,
      page,
      pageSize,
      totalPages,
      semesters: semesterRows.map((row) => row.semester),
      academicTermWindow: academicTermState.window,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load submissions.";
    console.error("Failed to load paginated submissions:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}