import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSkeapCapacityCount, getSkeapMaxSlots } from "@/lib/skeap-capacity";
import { getCurrentAcademicYear } from "@/lib/semester";
import { getSkeapWaitlistCycleState } from "@/lib/skeap-waitlist-cycle";

const PROGRAM_STATUS_DEFAULTS: Record<string, { badge: string; label: string }> = {
  "skeap-scholarship": {
    badge: "Open for application",
    label: "Application open",
  },
};

export async function GET(_: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const defaults = PROGRAM_STATUS_DEFAULTS[slug];

  if (!defaults) {
    return NextResponse.json({ error: "Program status not available" }, { status: 404 });
  }

  const [activeScholars, probationaryScholars, graduatedScholars, removedScholars, pendingApplications, maxSlots, activeScholarsCount] = await Promise.all([
    prisma.grantee.count({ where: { status: "ACTIVE" } }),
    prisma.grantee.count({ where: { status: "PROBATIONARY" } }),
    prisma.grantee.count({ where: { status: "GRADUATED" } }),
    prisma.grantee.count({ where: { status: { in: ["REMOVED", "REVOKED"] } } }),
    prisma.submission.count({ where: { status: "PENDING" } }),
    getSkeapMaxSlots(),
    getSkeapCapacityCount(),
  ]);

  const remainingSlots = Math.max(0, maxSlots - activeScholarsCount);
  const waitlistCycleState = await getSkeapWaitlistCycleState(getCurrentAcademicYear());
  const isCycleClosedAndFull = waitlistCycleState.isClosed;
  const totalScholars = activeScholars + probationaryScholars + graduatedScholars;
  const summary = pendingApplications > 0
    ? `There are ${pendingApplications} pending SKEAP application${pendingApplications === 1 ? "" : "s"} awaiting review.`
    : totalScholars > 0
      ? `There are currently ${totalScholars} registered SKEAP scholar${totalScholars === 1 ? "" : "s"}.`
      : "No SKEAP scholars are currently registered.";

  return NextResponse.json({
    badge: isCycleClosedAndFull ? "Cycle closed" : defaults.badge,
    label: isCycleClosedAndFull ? "Applications are closed" : defaults.label,
    summary,
    granteeCount: activeScholars,
    activeScholars,
    activeScholarsCount,
    maxSlots,
    remainingSlots,
    isCycleClosedAndFull,
    removedScholars,
    totalScholars,
    nextReview: "TBA",
    deadline: "TBA",
  });
}
