import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const db = prisma;

const normalizeSemester = (value?: string | null) => String(value ?? "").replace(/\s*\(current\)$/i, "").trim();

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const semester = url.searchParams.get("semester");
    const normalizedSemester = normalizeSemester(semester);
    const claimedParam = url.searchParams.get("claimed");
    const claimedFilter = claimedParam === "true" ? true : claimedParam === "false" ? false : null;

    const rows = await db.grantee.findMany({
      orderBy: { updatedAt: "desc" },
      where: normalizedSemester
        ? {
            submissions: {
              some: {
                semester: { equals: normalizedSemester, mode: "insensitive" },
              },
            },
          }
        : undefined,
      include: {
        user: { select: { fullName: true } },
        submissions: {
          where: normalizedSemester
            ? {
                semester: { equals: normalizedSemester, mode: "insensitive" },
              }
            : undefined,
          orderBy: { submittedAt: "desc" },
          take: 1,
          select: { id: true, status: true, semester: true, submittedAt: true },
        },
      },
    });

    const granteeIds = rows.map((r) => r.id);
    const payouts = granteeIds.length > 0 ? await db.accountingPayout.findMany({ where: { granteeId: { in: granteeIds } } }) : [];
    const payoutByGrantee: Record<string, any> = {};
    for (const p of payouts) payoutByGrantee[p.granteeId] = p;

    const mapped = rows.map((g) => {
      const submission = g.submissions?.[0] ?? null;
      const hasSubmission = Boolean(submission);
      const rawStatus = submission?.status ?? null;
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
        semester: submission?.semester ?? normalizedSemester ?? "",
        submitted: hasSubmission,
        submissionStatus: rawStatus,
        submissionState,
        claimed,
        claimedAt,
      };
    });

    const final = claimedFilter === null ? mapped : mapped.filter((m) => m.claimed === claimedFilter);
    return NextResponse.json({ grantees: final });
  } catch (error) {
    console.error("/api/grantees error:", error);
    return NextResponse.json({ grantees: [] });
  }
}
