import { Role } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { ensureProfile } from "@/lib/auth";
import { getProfilingRegistrationCountByStatusSince, prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

function getViewedAt(request: NextRequest, cookieName: string) {
  const value = request.cookies.get(cookieName)?.value;
  if (!value) return null;

  const viewedAt = new Date(value);
  if (Number.isNaN(viewedAt.getTime())) {
    throw new Error(`Invalid viewed timestamp in ${cookieName}.`);
  }
  return viewedAt;
}

function isTransientConnectionError(error: unknown) {
  return error instanceof Error &&
    /server has closed the connection|connection terminated unexpectedly|connection reset by peer|socket hang up/i
      .test(error.message);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = await ensureProfile(user);
    if (!admin || (admin.role !== Role.SK_OFFICIAL && admin.role !== Role.SUPER_ADMIN)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } catch (error) {
    console.error("Failed to authenticate admin sidebar counts request:", error);
    return NextResponse.json({ error: "Failed to load sidebar counts." }, { status: 500 });
  }

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const queryGranteesLastViewed = new URL(request.url).searchParams.get("granteesLastViewed");
  const granteesLastViewedFromQuery = queryGranteesLastViewed
    ? new Date(queryGranteesLastViewed)
    : null;
  if (queryGranteesLastViewed && (!granteesLastViewedFromQuery || Number.isNaN(granteesLastViewedFromQuery.getTime()))) {
    return NextResponse.json({ error: "Invalid Grantees viewed timestamp." }, { status: 400 });
  }
  let inquiryLastViewed: Date | null;
  let skeapLastViewed: Date | null;
  let submissionsLastViewed: Date | null;
  let kkProfilingLastViewed: Date | null;
  let granteesLastViewed: Date | null;
  let membersLastViewed: Date | null;
  try {
    inquiryLastViewed = getViewedAt(request, "admin-inquiries-last-viewed");
    skeapLastViewed = getViewedAt(request, "admin-skeap-applications-last-viewed");
    submissionsLastViewed = getViewedAt(request, "admin-submissions-last-viewed");
    kkProfilingLastViewed = getViewedAt(request, "admin-kk-profiling-last-viewed");
    granteesLastViewed =
      getViewedAt(request, "admin-grantees-last-viewed") ??
      granteesLastViewedFromQuery;
    membersLastViewed = getViewedAt(request, "admin-members-last-viewed");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid viewed timestamp.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supportInquiryFilter = {
    NOT: {
      subject: {
        contains: "SKEAP application",
        mode: "insensitive" as const,
      },
    },
  };
  const applicationStatusFilter = {
    OR: ["pending", "pre_qualified", "return", "resubm", "respond"].flatMap((pattern) => [
      { reviewStatus: { contains: pattern, mode: "insensitive" as const } },
      { response: { contains: pattern, mode: "insensitive" as const } },
    ]),
  };

  try {
    const loadCounts = () => Promise.all([
      prisma.inquiry.count({
        where: { ...supportInquiryFilter, isResolved: false, createdAt: { gte: inquiryLastViewed ?? startOfToday } },
      }),
      prisma.inquiry.count({
        where: {
          subject: { contains: "SKEAP application", mode: "insensitive" },
          NOT: [
            { reviewStatus: { contains: "cancel", mode: "insensitive" } },
            { reviewStatus: { contains: "approve", mode: "insensitive" } },
          ],
          AND: [applicationStatusFilter],
          createdAt: { gte: skeapLastViewed ?? startOfToday },
        },
      }),
      prisma.submission.count({ where: { status: "PENDING", submittedAt: { gte: submissionsLastViewed ?? startOfToday } } }),
      getProfilingRegistrationCountByStatusSince(
        "Pending",
        kkProfilingLastViewed ?? startOfToday,
      ),
      getProfilingRegistrationCountByStatusSince(
        "Resubmitted",
        kkProfilingLastViewed ?? startOfToday,
      ),
      prisma.grantee.count({
        where: {
          createdAt: granteesLastViewed
            ? { gt: granteesLastViewed }
            : { gte: startOfToday },
        },
      }),
      getProfilingRegistrationCountByStatusSince("Approved", membersLastViewed ?? startOfToday),
    ]);

    let countResults: Awaited<ReturnType<typeof loadCounts>>;
    try {
      countResults = await loadCounts();
    } catch (error) {
      if (!isTransientConnectionError(error)) throw error;
      countResults = await loadCounts();
    }

    const [
      openInquiryCount,
      skeapApplicationCount,
      pendingDocumentCount,
      pendingProfilingRegistrationCount,
      resubmittedProfilingRegistrationCount,
      newGranteeCount,
      approvedMemberCount,
    ] = countResults;

    return NextResponse.json(
      {
        counts: {
          openInquiryCount,
          skeapApplicationCount,
          pendingDocumentCount,
          profilingRegistrationCount:
            pendingProfilingRegistrationCount + resubmittedProfilingRegistrationCount,
          pendingProfilingRegistrationCount,
          resubmittedProfilingRegistrationCount,
          newGranteeCount,
          approvedMemberCount,
        },
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error) {
    console.error("Failed to load admin sidebar counts:", error);
    return NextResponse.json({ error: "Failed to load sidebar counts." }, { status: 500 });
  }
}
