import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

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

  const [activeScholars, probationaryScholars, graduatedScholars, removedScholars, pendingApplications] = await Promise.all([
    prisma.grantee.count({ where: { status: "ACTIVE" } }),
    prisma.grantee.count({ where: { status: "PROBATIONARY" } }),
    prisma.grantee.count({ where: { status: "GRADUATED" } }),
    prisma.grantee.count({ where: { status: "REMOVED" } }),
    prisma.submission.count({ where: { status: "PENDING" } }),
  ]);

  const totalScholars = activeScholars + probationaryScholars + graduatedScholars;
  const summary = pendingApplications > 0
    ? `There are ${pendingApplications} pending SKEAP application${pendingApplications === 1 ? "" : "s"} awaiting review.`
    : totalScholars > 0
      ? `There are currently ${totalScholars} registered SKEAP scholar${totalScholars === 1 ? "" : "s"}.`
      : "No SKEAP scholars are currently registered.";

  return NextResponse.json({
    badge: defaults.badge,
    label: defaults.label,
    summary,
    activeScholars,
    removedScholars,
    totalScholars,
    nextReview: "TBA",
    deadline: "TBA",
  });
}
