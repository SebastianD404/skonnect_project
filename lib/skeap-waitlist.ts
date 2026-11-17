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
  waitlistOfferMessage?: string | null;
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
  openSlotCount: number;
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
        userId: true,
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
  const capacitySnapshot = await getSkeapCapacitySnapshot();
  type OfferApplicationWithDeadline = (typeof applications)[number] & {
    waitlistOfferExpiresAt: Date;
  };
  const offerApplications = applications.filter(
    (application): application is OfferApplicationWithDeadline =>
      application.waitlistOfferStatus !== "NONE" &&
      application.waitlistOfferExpiresAt !== null,
  );
  const offerNotifications = offerApplications.length > 0
    ? await prisma.notification.findMany({
        where: {
          OR: offerApplications.map((application) => ({
            userId: application.userId,
            sourceKey: `skeap-waitlist-offer:${application.id}:${application.waitlistOfferExpiresAt.toISOString()}`,
          })),
        },
        select: { userId: true, sourceKey: true, message: true },
      })
    : [];
  const offerMessageBySource = new Map(
    offerNotifications.map((notification) => [
      `${notification.userId}:${notification.sourceKey}`,
      notification.message,
    ]),
  );
  const offerSourceByApplicationId = new Map(
    offerApplications.map((application) => [
      application.id,
      `${application.userId}:skeap-waitlist-offer:${application.id}:${application.waitlistOfferExpiresAt.toISOString()}`,
    ]),
  );
  const offerMessageByApplicationId = new Map(
    offerApplications.map((application) => [
      application.id,
      offerMessageBySource.get(offerSourceByApplicationId.get(application.id) ?? "") ?? null,
    ]),
  );
  const manualNoticeIds = new Set(
    offerApplications
      .filter((application) => Boolean(offerMessageByApplicationId.get(application.id)?.trim()))
      .map((application) => application.id),
  );
  const manualHeldOfferIds = new Set(
    offerApplications
      .filter((application) =>
        (application.waitlistOfferStatus === "OFFERED" ||
          application.waitlistOfferStatus === "EXPIRED") &&
        manualNoticeIds.has(application.id)
      )
      .map((application) => application.id),
  );
  const offeredCount = manualHeldOfferIds.size;
  const openSlots = cycleState.isClosed
    ? 0
    : Math.max(0, capacitySnapshot.availableSlots - offeredCount);

  return {
    cycle,
    activeCount: capacitySnapshot.activeCount,
    maxSlots: capacitySnapshot.maxSlots,
    offeredCount,
    openSlotCount: openSlots,
    totalWaitlisted: cycleState.isClosed ? cycleState.totalWaitlisted : applications.length,
    isClosed: cycleState.isClosed,
    applications: applications.map((application, index) => {
      const hasManualOffer = manualHeldOfferIds.has(application.id);
      return {
        id: application.id,
        waitlistPosition: application.waitlistFinalPosition ?? index + 1,
        waitlistOfferStatus: hasManualOffer
          ? "OFFERED"
          : "NONE",
        waitlistOfferedAt: hasManualOffer
          ? application.waitlistOfferedAt?.toISOString() ?? null
          : null,
        waitlistOfferExpiresAt: hasManualOffer
          ? application.waitlistOfferExpiresAt?.toISOString() ?? null
          : null,
        waitlistOfferMessage: hasManualOffer
          ? offerMessageByApplicationId.get(application.id) ?? null
          : null,
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
      };
    }),
  };
}