import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getSkeapCapacitySnapshot } from "@/lib/skeap-capacity";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { getAcademicYearDateRange } from "@/lib/semester";
import { getExactAge } from "@/lib/skeap-age";
import {
  getSkeapWaitlistCycle,
  getSkeapWaitlistCycleState,
} from "@/lib/skeap-waitlist-cycle";

export async function reindexSkeapWaitlist(
  tx: Prisma.TransactionClient,
  programIdOrCycle?: string,
) {
  const range = getAcademicYearDateRange(getSkeapWaitlistCycle(programIdOrCycle));
  if (!range) throw new Error("Unable to determine the active SKEAP waitlist cycle.");
  await tx.$executeRaw`
    WITH ranked AS (
      SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "submittedAt" ASC, "id" ASC)::INTEGER AS "position"
      FROM "skeap_applications"
      WHERE "status" = 'WAITLISTED'
        AND "submittedAt" >= ${range.start}
        AND "submittedAt" < ${range.end}
    )
    UPDATE "skeap_applications" AS application
    SET "waitlistPosition" = ranked."position"
    FROM ranked
    WHERE application."id" = ranked."id"
      AND application."waitlistPosition" IS DISTINCT FROM ranked."position"
  `;
}

export type SkeapWaitlistApplication = {
  id: string;
  waitlistPosition: number | null;
  waitlistOfferStatus: "NONE" | "OFFERED" | "EXPIRED";
  waitlistOfferedAt: string | null;
  waitlistOfferExpiresAt: string | null;
  physicalDocumentsConfirmed: boolean;
  submittedAt: string;
  applicantName: string;
  emailAddress: string;
  contactNumber: string | null;
  school: string;
  educationLevel: string | null;
  currentCourse: string;
  yearLevel: string;
  age: number | null;
};

export type SkeapWaitlistSnapshot = {
  cycle: string;
  activeCount: number;
  maxSlots: number;
  offeredCount: number;
  openUnclaimedCount: number;
  totalWaitlisted: number;
  isClosed: boolean;
  applications: SkeapWaitlistApplication[];
};

export async function getSkeapWaitlistSnapshot(
  programIdOrCycle?: string,
): Promise<SkeapWaitlistSnapshot> {
  const cycle = getSkeapWaitlistCycle(programIdOrCycle);
  const range = getAcademicYearDateRange(cycle);
  if (!range) throw new Error("Unable to determine the active SKEAP waitlist cycle.");
  const [applications, cycleState] = await Promise.all([
    prisma.skeapApplication.findMany({
      where: {
        status: "WAITLISTED",
        submittedAt: { gte: range.start, lt: range.end },
      },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        waitlistPosition: true,
        waitlistFinalPosition: true,
        waitlistOfferStatus: true,
        waitlistOfferedAt: true,
        waitlistOfferExpiresAt: true,
        physicalDocumentsConfirmed: true,
        submittedAt: true,
        applicantName: true,
        emailAddress: true,
        contactNumber: true,
        school: true,
        educationLevel: true,
        currentCourse: true,
        yearLevel: true,
        dateOfBirth: true,
        user: {
          select: {
            fullName: true,
            email: true,
            kkProfile: { select: { birthDate: true } },
          },
        },
      },
    }),
    getSkeapWaitlistCycleState(cycle),
  ]);
  const [capacitySnapshot, offeredCount] = await Promise.all([
    getSkeapCapacitySnapshot(),
    prisma.skeapApplication.count({
      where: {
        status: "WAITLISTED",
        waitlistOfferStatus: "OFFERED",
        waitlistOfferExpiresAt: { gt: new Date() },
        submittedAt: { gte: range.start, lt: range.end },
      },
    }),
  ]);
  const openSlots = cycleState.isClosed
    ? 0
    : Math.max(0, capacitySnapshot.availableSlots - offeredCount);
  const openUnclaimedCount = Math.min(
    openSlots,
    applications.filter((application) => application.waitlistOfferStatus === "NONE").length,
  );

  return {
    cycle,
    activeCount: capacitySnapshot.activeCount,
    maxSlots: capacitySnapshot.maxSlots,
    offeredCount,
    openUnclaimedCount,
    totalWaitlisted: cycleState.isClosed ? cycleState.totalWaitlisted : applications.length,
    isClosed: cycleState.isClosed,
    applications: applications.map((application, index) => ({
      id: application.id,
      waitlistPosition: application.waitlistFinalPosition ?? index + 1,
      waitlistOfferStatus: application.waitlistOfferStatus,
      waitlistOfferedAt: application.waitlistOfferedAt?.toISOString() ?? null,
      waitlistOfferExpiresAt: application.waitlistOfferExpiresAt?.toISOString() ?? null,
      physicalDocumentsConfirmed: application.physicalDocumentsConfirmed,
      submittedAt: application.submittedAt.toISOString(),
      applicantName: application.applicantName || application.user.fullName || application.user.email,
      emailAddress: application.emailAddress || application.user.email,
      contactNumber: application.contactNumber,
      school: normalizeSkeapSchoolName(application.school),
      educationLevel: application.educationLevel,
      currentCourse: application.currentCourse,
      yearLevel: application.yearLevel,
      age: getExactAge(application.user.kkProfile?.birthDate ?? application.dateOfBirth),
    })),
  };
}