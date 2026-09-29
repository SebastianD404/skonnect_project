import { Prisma, Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE_DEFAULT = 10;
const PAGE_SIZE_MAX = 50;

const PHASES = ["pending-coe", "active-scholars", "pending-grades", "completed"] as const;
type Phase = (typeof PHASES)[number];

function getPhaseWhere(phase: Phase): Prisma.SubmissionWhereInput {
  const hasCoe = { not: "" };
  const hasGrades = { not: "" };

  switch (phase) {
    case "pending-coe":
      return {
        OR: [
          { status: "PENDING", coeFileUrl: hasCoe, gradeFileUrl: "" },
          { status: "RETURNED_FOR_EDIT", gradeFileUrl: "" },
        ],
      };
    case "active-scholars":
      return { status: "APPROVED", coeFileUrl: hasCoe, gradeFileUrl: "" };
    case "pending-grades":
      return {
        OR: [
          { status: "PENDING", gradeFileUrl: hasGrades },
          { status: "RETURNED_FOR_EDIT", gradeFileUrl: hasGrades },
        ],
      };
    case "completed":
      return { status: "APPROVED", coeFileUrl: hasCoe, gradeFileUrl: hasGrades };
  }
}

function normalizeGradeRows(value: unknown): Array<{ subject: string; grade: number }> | null {
  let rows = value;
  if (typeof rows === "string") {
    try {
      rows = JSON.parse(rows);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(rows)) return null;

  const normalized = rows
    .map((row) => ({ subject: String(row?.subject ?? "").trim(), grade: Number(row?.grade) }))
    .filter((row) => row.subject.length > 0 && Number.isFinite(row.grade) && row.grade >= 0 && row.grade <= 100);
  return normalized.length > 0 ? normalized : null;
}

function computeAverage(rows: Array<{ subject: string; grade: number }> | null) {
  if (!rows?.length) return null;
  return Number((rows.reduce((sum, row) => sum + row.grade, 0) / rows.length).toFixed(2));
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
  const phaseValue = params.get("status") ?? "pending-coe";
  if (!PHASES.includes(phaseValue as Phase)) {
    return NextResponse.json({ error: "Invalid submissions status filter." }, { status: 400 });
  }

  const phase = phaseValue as Phase;
  const requestedPage = Number.parseInt(params.get("page") ?? "1", 10);
  const requestedLimit = Number.parseInt(params.get("limit") ?? String(PAGE_SIZE_DEFAULT), 10);
  const pageSize = Number.isFinite(requestedLimit)
    ? Math.min(PAGE_SIZE_MAX, Math.max(1, requestedLimit))
    : PAGE_SIZE_DEFAULT;
  const pageNumber = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1;
  const semester = params.get("semester")?.trim() ?? "";
  const search = params.get("search")?.trim() ?? "";
  const searchWhere = buildSearchWhere(search);
  const currentWhere: Prisma.SubmissionWhereInput = {
    AND: [
      getPhaseWhere(phase),
      ...(semester && semester !== "all" ? [{ semester }] : []),
      ...(searchWhere ? [searchWhere] : []),
    ],
  };

  const countWhere = (phaseToCount: Phase): Prisma.SubmissionWhereInput => getPhaseWhere(phaseToCount);

  try {
    const [totalCount, pendingCoeCount, activeScholarsCount, pendingGradesCount, completedCount, semesterRows] = await Promise.all([
      prisma.submission.count({ where: currentWhere }),
      prisma.submission.count({ where: countWhere("pending-coe") }),
      prisma.submission.count({ where: countWhere("active-scholars") }),
      prisma.submission.count({ where: countWhere("pending-grades") }),
      prisma.submission.count({ where: countWhere("completed") }),
      phase === "completed"
        ? prisma.submission.findMany({
            where: getPhaseWhere("completed"),
            distinct: ["semester"],
            orderBy: { semester: "asc" },
            select: { semester: true },
          })
        : Promise.resolve([]),
    ]);

    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const page = Math.min(pageNumber, totalPages);
    const selectSubmission = (includeFlaggedFields: boolean) => ({
      id: true,
      semester: true,
      gradeFileUrl: true,
      coeFileUrl: true,
      gradeRows: true,
      generalAverage: true,
      status: true,
      reviewNotes: true,
      ...(includeFlaggedFields ? { flaggedFields: true } : {}),
      submittedAt: true,
      grantee: {
        select: {
          school: true,
          yearLevel: true,
          generalAverage: true,
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
        select: selectSubmission(true),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/flaggedFields|column .* does not exist/i.test(message)) throw error;

      submissions = await prisma.submission.findMany({
        where: currentWhere,
        orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: selectSubmission(false),
      });
    }

    const rows = submissions.map((submission) => {
      const gradeRows = normalizeGradeRows(submission.gradeRows);
      return {
        ...submission,
        gradeRows,
        flaggedFields: "flaggedFields" in submission ? submission.flaggedFields ?? [] : [],
        generalAverage:
          submission.generalAverage ?? computeAverage(gradeRows) ?? submission.grantee.generalAverage ?? null,
        submittedAt: submission.submittedAt.toISOString(),
      };
    });

    return NextResponse.json({
      rows,
      counts: {
        "pending-coe": pendingCoeCount,
        "active-scholars": activeScholarsCount,
        "pending-grades": pendingGradesCount,
        completed: completedCount,
      },
      totalCount,
      page,
      pageSize,
      totalPages,
      semesters: semesterRows.map((row) => row.semester),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load submissions.";
    console.error("Failed to load paginated submissions:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}