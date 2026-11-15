import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { getSkeapCapacityCount, getSkeapMaxSlots } from "@/lib/skeap-capacity";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { getAcademicYearDateRange } from "@/lib/semester";
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
  const remaining = await tx.skeapApplication.findMany({
    where: {
      status: "WAITLISTED",
      submittedAt: { gte: range.start, lt: range.end },
    },
    orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
    select: { id: true, waitlistPosition: true },
  });

  for (const [index, application] of remaining.entries()) {
    const position = index + 1;
    if (application.waitlistPosition !== position) {
      await tx.skeapApplication.update({
        where: { id: application.id },
        data: { waitlistPosition: position },
      });
    }
  }
}

export type SkeapWaitlistApplication = {
  id: string;
  waitlistPosition: number | null;
  physicalDocumentsConfirmed: boolean;
  submittedAt: string;
  applicantName: string;
  emailAddress: string;
  contactNumber: string | null;
  school: string;
  educationLevel: string | null;
  currentCourse: string;
  yearLevel: string;
};

export type SkeapWaitlistSnapshot = {
  cycle: string;
  activeCount: number;
  maxSlots: number;
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
        physicalDocumentsConfirmed: true,
        submittedAt: true,
        applicantName: true,
        emailAddress: true,
        contactNumber: true,
        school: true,
        educationLevel: true,
        currentCourse: true,
        yearLevel: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
    getSkeapWaitlistCycleState(cycle),
  ]);
  const [activeCount, maxSlots] = await Promise.all([
    getSkeapCapacityCount(),
    getSkeapMaxSlots(),
  ]);

  return {
    cycle,
    activeCount,
    maxSlots,
    totalWaitlisted: cycleState.isClosed ? cycleState.totalWaitlisted : applications.length,
    isClosed: cycleState.isClosed,
    applications: applications.map((application, index) => ({
      id: application.id,
      waitlistPosition: application.waitlistFinalPosition ?? index + 1,
      physicalDocumentsConfirmed: application.physicalDocumentsConfirmed,
      submittedAt: application.submittedAt.toISOString(),
      applicantName: application.applicantName || application.user.fullName || application.user.email,
      emailAddress: application.emailAddress || application.user.email,
      contactNumber: application.contactNumber,
      school: normalizeSkeapSchoolName(application.school),
      educationLevel: application.educationLevel,
      currentCourse: application.currentCourse,
      yearLevel: application.yearLevel,
    })),
  };
}