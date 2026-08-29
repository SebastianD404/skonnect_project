import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma;

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const semester = url.searchParams.get("semester");

    // Normalize semester param (strip "(Current)" and trim)
    const normalizedSemester = semester ? String(semester).replace(/\s*\(current\)$/i, "").trim() : null;

    if (normalizedSemester) {
      // Return all grantees, and for each include whether they have a submission for the requested semester
      const rows = await db.grantee.findMany({
        orderBy: { updatedAt: "desc" },
        include: {
          user: { select: { fullName: true } },
          submissions: {
            where: { semester: { contains: normalizedSemester, mode: "insensitive" } },
            select: { id: true, status: true, semester: true, submittedAt: true },
            take: 1,
          },
        },
      });

      // Fetch any existing accounting payouts for the returned grantees
      const granteeIds = rows.map((r) => r.id);
      const payouts = granteeIds.length > 0 ? await db.accountingPayout.findMany({ where: { granteeId: { in: granteeIds } } }) : [];
      const payoutByGrantee: Record<string, any> = {};
      for (const p of payouts) payoutByGrantee[p.granteeId] = p;

      const claimedParam = url.searchParams.get('claimed'); // 'true' | 'false' | null

      const mapped = rows.map((g) => {
        const hasSubmission = Array.isArray(g.submissions) && g.submissions.length > 0;
        const rawStatus = g.submissions?.[0]?.status ?? null;
        let submissionState = "Not submitted";
        if (hasSubmission) {
          if (rawStatus === "APPROVED") submissionState = "Approved";
          else if (rawStatus === "PENDING") submissionState = "Pending review";
          else if (rawStatus === "REJECTED" || rawStatus === "RETURNED_FOR_EDIT") submissionState = "Not submitted";
          else submissionState = "Pending review";
        }

        const payout = payoutByGrantee[g.id];
        const claimed = !!(payout && payout.claimedAt);
        const claimedAt = payout?.claimedAt ?? null;

        return {
          id: g.id,
          student_name: g.user?.fullName ?? "",
          semester: normalizedSemester,
          submitted: hasSubmission,
          submissionStatus: rawStatus,
          submissionState,
          claimed,
          claimedAt,
        };
      });

      // Apply claimed filter if requested
      const final = claimedParam === 'true' ? mapped.filter((m) => m.claimed) : claimedParam === 'false' ? mapped.filter((m) => !m.claimed) : mapped;

      return NextResponse.json({ grantees: final });
    }

    // No semester specified: return recent/most-recent submission per grantee
    const rows = await db.grantee.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        user: { select: { fullName: true } },
        submissions: {
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: { id: true, status: true, semester: true, submittedAt: true },
        },
      },
    });

    const granteeIdsAll = rows.map((r) => r.id);
    const payoutsAll = granteeIdsAll.length > 0 ? await db.accountingPayout.findMany({ where: { granteeId: { in: granteeIdsAll } } }) : [];
    const payoutByGranteeAll: Record<string, any> = {};
    for (const p of payoutsAll) payoutByGranteeAll[p.granteeId] = p;

    const result = rows.map((g) => {
      const hasSubmission = Array.isArray(g.submissions) && g.submissions.length > 0;
      const rawStatus = g.submissions?.[0]?.status ?? null;
      let submissionState = "Not submitted";
      if (hasSubmission) {
        if (rawStatus === "APPROVED") submissionState = "Approved";
        else if (rawStatus === "PENDING") submissionState = "Pending review";
        else if (rawStatus === "REJECTED" || rawStatus === "RETURNED_FOR_EDIT") submissionState = "Not submitted";
        else submissionState = "Pending review";
      }
      const payout = payoutByGranteeAll[g.id];
      const claimed = !!(payout && payout.claimedAt);
      const claimedAt = payout?.claimedAt ?? null;

      return {
        id: g.id,
        student_name: g.user?.fullName ?? "",
        semester: g.submissions?.[0]?.semester ?? "",
        submitted: hasSubmission,
        submissionStatus: rawStatus,
        submissionState,
        claimed,
        claimedAt,
      };
    });

    return NextResponse.json({ grantees: result });
  } catch (error) {
    console.error("/api/grantees error:", error);
    return NextResponse.json({ grantees: [] });
  }
}
