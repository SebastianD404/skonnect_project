import { AccountingPayoutStatus, Role } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAuditEvent } from "@/lib/audit/logger";
import { getSkeapDashboardUrl, sendGranteeApprovalEmail } from "@/lib/broadcast-email";
import { GRANTEE_PLACEHOLDER_SCHOOL, GRANTEE_PLACEHOLDER_YEAR_LEVEL } from "@/lib/grantee-profile";
import { DEFAULT_SKEAP_MAX_SLOTS, getSkeapCapacitySnapshot, lockSkeapCapacity } from "@/lib/skeap-capacity";
import { normalizeSkeapSchoolName } from "@/lib/skeap-school";
import { refreshInactiveGranteesView } from "@/lib/grantee-archive-view";
import {
  getSkeapWaitlistSnapshot,
  reindexSkeapWaitlist,
} from "@/lib/skeap-waitlist";
import { refreshSkeapApplicationsAdminView } from "@/lib/application-admin-view-refresh";
import {
  sweepAgedOutWaitlistApplicants,
  sweepClosedSkeapWaitlistCycles,
} from "@/lib/skeap-applications";
import { getExactAge } from "@/lib/skeap-age";
import { getSkeapMaxEligibleAge } from "@/lib/skeap-program-config";
import { getAcademicYearDateRange } from "@/lib/semester";
import { getSkeapWaitlistCycle, getSkeapWaitlistCycleState } from "@/lib/skeap-waitlist-cycle";
import {
  createSkeapGranteeApprovalNotification,
  notifyGranteesToUploadRequirements,
} from "@/lib/grantee-notifications";
import { resolveGranteeEntryTerm } from "@/lib/grantee-semester";
import { getSkeapGrantAmount } from "@/lib/skeap-payout";

async function authorizeAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };

  const appUser = await ensureProfile(user);
  if (!appUser || (appUser.role !== Role.SK_OFFICIAL && appUser.role !== Role.SUPER_ADMIN)) {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { user: appUser };
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authorizeAdmin();
  if ("error" in auth) return auth.error;

  const { id } = await params;
  if (!id) return NextResponse.json({ error: "Application id is required." }, { status: 400 });

  let confirmPhysicalVerification = false;
  try {
    const body: unknown = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return NextResponse.json({ error: "A valid promotion confirmation is required." }, { status: 400 });
    }
    confirmPhysicalVerification =
      (body as Record<string, unknown>).confirmPhysicalVerification === true;
  } catch {
    return NextResponse.json({ error: "A valid promotion confirmation is required." }, { status: 400 });
  }

  let maxSlots = DEFAULT_SKEAP_MAX_SLOTS;
  try {
    const grantAmount = getSkeapGrantAmount();
    const ageOutSweep = await sweepAgedOutWaitlistApplicants(auth.user.id);
    await sweepClosedSkeapWaitlistCycles(auth.user.id);
    if (ageOutSweep.removedApplicants.some((application) => application.applicationId === id)) {
      return NextResponse.json(
        { error: "Applicant has exceeded the maximum eligible age and was automatically removed from the waitlist." },
        { status: 400 },
      );
    }
    const priorAgeOut = await prisma.skeapApplication.findUnique({
      where: { id },
      select: { waitlistRemark: true },
    });
    if (priorAgeOut?.waitlistRemark === "AGED_OUT") {
      return NextResponse.json(
        { error: "Applicant has exceeded the maximum eligible age and was automatically removed from the waitlist." },
        { status: 400 },
      );
    }

    const promoted = await prisma.$transaction(async (tx) => {
      await lockSkeapCapacity(tx);
      const currentCapacity = await getSkeapCapacitySnapshot(tx);
      maxSlots = currentCapacity.maxSlots;
      const application = await tx.skeapApplication.findUnique({
        where: { id },
        select: {
          id: true,
          status: true,
          submittedAt: true,
          waitlistOfferStatus: true,
          waitlistOfferExpiresAt: true,
          dateOfBirth: true,
          physicalDocumentsConfirmed: true,
          userId: true,
          applicantName: true,
          emailAddress: true,
          user: {
            select: {
              email: true,
              kkProfile: { select: { birthDate: true } },
            },
          },
          school: true,
          currentCourse: true,
          yearLevel: true,
          inquiry: { select: { id: true } },
        },
      });
      if (!application) throw new Error("NOT_FOUND");
      if (application.status !== "WAITLISTED") throw new Error("NOT_WAITLISTED");
      const maxEligibleAge = await getSkeapMaxEligibleAge(tx);
      const currentAge = getExactAge(
        application.user.kkProfile?.birthDate ?? application.dateOfBirth,
      );
      if (currentAge !== null && currentAge > maxEligibleAge) {
        throw new Error("APPLICANT_AGED_OUT");
      }

      const cycle = getSkeapWaitlistCycle();
      const cycleRange = getAcademicYearDateRange(cycle);
      if (!cycleRange) throw new Error("SKEAP_CYCLE_UNAVAILABLE");
      if (
        application.submittedAt < cycleRange.start ||
        application.submittedAt >= cycleRange.end
      ) {
        throw new Error("STALE_WAITLIST_CYCLE");
      }
      const cycleState = await getSkeapWaitlistCycleState(cycle, tx);
      if (cycleState.isClosed) throw new Error("SKEAP_CYCLE_CLOSED");
      if (
        (application.waitlistOfferStatus !== "OFFERED" &&
          application.waitlistOfferStatus !== "EXPIRED") ||
        !application.waitlistOfferExpiresAt
      ) {
        throw new Error("SLOT_OFFER_NOT_ACTIVE");
      }
      const manualOfferNotification = await tx.notification.findMany({
        where: {
          userId: application.userId,
          sourceKey: `skeap-waitlist-offer:${application.id}:${application.waitlistOfferExpiresAt.toISOString()}`,
        },
        select: { message: true },
        take: 1,
      });
      if (!manualOfferNotification.some(
        (notification) => typeof notification.message === "string" && notification.message.trim().length > 0,
      )) {
        throw new Error("SLOT_OFFER_NOT_ACTIVE");
      }
      if (!application.physicalDocumentsConfirmed && !confirmPhysicalVerification) {
        throw new Error("PHYSICAL_VERIFICATION_REQUIRED");
      }
      const schedules = await tx.academicTermSchedule.findMany({
        select: { id: true, semester: true, opensAt: true, closesAt: true },
      });
      const promotionTime = new Date();
      const entryTerm = resolveGranteeEntryTerm(schedules, promotionTime);

      const existingGrantee = await tx.grantee.findUnique({
        where: { userId: application.userId },
        select: {
          status: true,
          entryAcademicYear: true,
          entrySemester: true,
        },
      });
      if (existingGrantee?.status === "GRADUATED") throw new Error("GRANTEE_ARCHIVED");

      const applicantCapacity = await getSkeapCapacitySnapshot(tx, application.userId);
      const otherOffers = await tx.skeapApplication.findMany({
        where: {
          id: { not: application.id },
          status: "WAITLISTED",
          waitlistOfferStatus: { in: ["OFFERED", "EXPIRED"] },
          waitlistOfferExpiresAt: { not: null },
          submittedAt: { gte: cycleRange.start, lt: cycleRange.end },
        },
        select: { id: true, userId: true, waitlistOfferExpiresAt: true },
      });
      const otherOfferNotifications = otherOffers.length > 0
        ? await tx.notification.findMany({
            where: {
              OR: otherOffers.flatMap((offer) => offer.waitlistOfferExpiresAt
                ? [{
                    userId: offer.userId,
                    sourceKey: `skeap-waitlist-offer:${offer.id}:${offer.waitlistOfferExpiresAt.toISOString()}`,
                  }]
                : []),
            },
            select: { message: true },
          })
        : [];
      const otherManualOffers = otherOfferNotifications.filter(
        (notification) => typeof notification.message === "string" && notification.message.trim().length > 0,
      ).length;
      if (applicantCapacity.activeCount + otherManualOffers >= maxSlots) throw new Error("CAPACITY_FULL");

      await tx.skeapApplication.update({
        where: { id },
        data: {
          status: "APPROVED",
          waitlistPosition: null,
          waitlistOfferStatus: "NONE",
          waitlistOfferedAt: null,
          waitlistOfferExpiresAt: null,
          waitlistOfferReminderSentAt: null,
          physicalDocumentsConfirmed: true,
        },
      });

      if (application.inquiry) {
        await tx.inquiry.update({
          where: { id: application.inquiry.id },
          data: {
            reviewStatus: "Approved",
            response: "Your SKEAP application has been promoted from the waitlist and approved.",
            respondedAt: new Date(),
            isResolved: true,
            lastUpdatedBy: "admin",
          },
        });
      }

      await tx.user.update({
        where: { id: application.userId },
        data: { role: Role.GRANTEE, hasSeenOnboarding: false },
      });
      const grantee = await tx.grantee.upsert({
        where: { userId: application.userId },
        create: {
          userId: application.userId,
          school: normalizeSkeapSchoolName(application.school || application.currentCourse || GRANTEE_PLACEHOLDER_SCHOOL),
          yearLevel: application.yearLevel || GRANTEE_PLACEHOLDER_YEAR_LEVEL,
          status: "ACTIVE",
          dateEnrolled: promotionTime,
          entryAcademicYear: entryTerm.schoolYear,
          entrySemester: entryTerm.semester,
          journeyStart: null,
          journeyEnd: null,
        },
        update: {
          school: normalizeSkeapSchoolName(application.school || application.currentCourse || GRANTEE_PLACEHOLDER_SCHOOL),
          yearLevel: application.yearLevel || GRANTEE_PLACEHOLDER_YEAR_LEVEL,
          status: "ACTIVE",
          dateRemoved: null,
          ...(existingGrantee?.status === "REMOVED" ||
          existingGrantee?.status === "REVOKED" ||
          !existingGrantee?.entryAcademicYear ||
          !existingGrantee.entrySemester
            ? {
                dateEnrolled: promotionTime,
                entryAcademicYear: entryTerm.schoolYear,
                entrySemester: entryTerm.semester,
              }
            : {}),
        },
        select: { id: true, entryAcademicYear: true, entrySemester: true },
      });
      const persistedEntryTerm = {
        schoolYear: grantee.entryAcademicYear ?? entryTerm.schoolYear,
        semester: grantee.entrySemester ?? entryTerm.semester,
        termLabel: `${grantee.entryAcademicYear ?? entryTerm.schoolYear} ${grantee.entrySemester ?? entryTerm.semester}`,
      };
      const existingPayout = await tx.accountingPayout.findUnique({
        where: { granteeId: grantee.id },
        select: { status: true, disbursedAt: true },
      });
      const shouldRefreshUnfiledPayout =
        !existingPayout?.disbursedAt &&
        (existingPayout?.status === AccountingPayoutStatus.PENDING ||
          existingPayout?.status === AccountingPayoutStatus.NOT_YET_FILED);
      await tx.accountingPayout.upsert({
        where: { granteeId: grantee.id },
        create: {
          granteeId: grantee.id,
          amount: grantAmount,
          semester: persistedEntryTerm.termLabel,
          status: AccountingPayoutStatus.NOT_YET_FILED,
        },
        update: shouldRefreshUnfiledPayout
          ? {
              amount: grantAmount,
              semester: persistedEntryTerm.termLabel,
              status: AccountingPayoutStatus.NOT_YET_FILED,
            }
          : {},
      });

      await reindexSkeapWaitlist(tx);

      return {
        id: application.id,
        applicantId: application.userId,
        applicantName: application.applicantName,
        applicantEmail: application.emailAddress?.trim() || application.user.email,
        entryTerm: persistedEntryTerm,
        granteeStatusChanged:
          existingGrantee?.status === "REMOVED" || existingGrantee?.status === "REVOKED",
      };
    });

    revalidatePath("/");
    revalidatePath("/admin");
    revalidatePath("/admin/grantees");
    revalidatePath("/admin/skeap-waitlist");
    revalidatePath("/programs/skeap");

    const { granteeStatusChanged, applicantEmail, entryTerm, ...promotedApplication } = promoted;
    const waitlistSnapshot = await getSkeapWaitlistSnapshot();
    const capacityMetrics = {
      activeCount: waitlistSnapshot.activeCount,
      maxSlots: waitlistSnapshot.maxSlots,
      offeredCount: waitlistSnapshot.offeredCount,
      openSlotCount: waitlistSnapshot.openSlotCount,
    };

    if (granteeStatusChanged) {
      try {
        await refreshInactiveGranteesView();
      } catch (error) {
        console.error("SKEAP promotion completed, but the grantee archive view could not be refreshed:", error);
        return NextResponse.json(
          { error: "SKEAP promotion completed, but the grantee archive report could not be refreshed." },
          { status: 503 }
        );
      }
    }

    let emailSent = false;
    try {
      await createSkeapGranteeApprovalNotification({
        applicationId: promotedApplication.id,
        userId: promotedApplication.applicantId,
        academicYear: entryTerm.schoolYear,
        semester: entryTerm.semester,
      });
    } catch (error) {
      console.error("SKEAP promotion completed, but the approval notification could not be created:", error);
    }

    try {
      await sendGranteeApprovalEmail({
        to: applicantEmail,
        applicantName: promotedApplication.applicantName || "Scholar",
        academicYear: entryTerm.schoolYear,
        semester: entryTerm.semester,
        dashboardUrl: getSkeapDashboardUrl(),
      });
      emailSent = true;
    } catch (error) {
      console.error("SKEAP promotion completed, but the approval email could not be sent:", error);
    }

    try {
      const notificationResult = await notifyGranteesToUploadRequirements({
        targetUserIds: [promotedApplication.applicantId],
        schoolYear: entryTerm.schoolYear,
        semester: entryTerm.semester,
        trigger: "GRANTEE_APPROVED",
      });
      if (notificationResult.errors.length > 0) {
        console.error("SKEAP promotion completed with requirement notification errors:", notificationResult.errors);
      }
    } catch (error) {
      console.error("SKEAP promotion completed, but requirement notifications failed:", error);
    }

    logAuditEvent({
      actorId: auth.user.id,
      actorEmail: auth.user.email,
      action: "APPLICATION_PROMOTED",
      resource: "skeap_applications",
      resourceId: promotedApplication.id,
      metadata: {
        applicantId: promotedApplication.applicantId,
        target: promotedApplication.applicantName || promotedApplication.applicantId,
        resultingStatus: "APPROVED",
        physicalDocumentsConfirmed: true,
      },
    });

    await refreshSkeapApplicationsAdminView();
    revalidatePath("/admin/skeap-applications");
    revalidatePath("/applications");
    revalidatePath("/youth-dashboard");
    revalidatePath("/grantee-dashboard");
    revalidatePath("/admin/members");
    revalidatePath("/admin/kk-profiling");

    return NextResponse.json({
      success: true,
      emailSent,
      application: promotedApplication,
      ...capacityMetrics,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to promote application.";
    if (message === "APPLICANT_AGED_OUT") {
      await sweepAgedOutWaitlistApplicants(auth.user.id);
      return NextResponse.json(
        { error: "Applicant has exceeded the maximum eligible age and was automatically removed from the waitlist." },
        { status: 400 },
      );
    }
    if (message === "NOT_FOUND") return NextResponse.json({ error: "Application not found." }, { status: 404 });
    if (message === "NOT_WAITLISTED") return NextResponse.json({ error: "Application is not currently waitlisted." }, { status: 409 });
    if (message === "SLOT_OFFER_NOT_ACTIVE") {
      return NextResponse.json({ error: "Applicant must have an active slot offer before admission." }, { status: 409 });
    }
    if (message === "PHYSICAL_VERIFICATION_REQUIRED") {
      return NextResponse.json({ error: "Confirm that the original/CTC documents were physically verified before promotion." }, { status: 400 });
    }
    if (message === "GRANTEE_ARCHIVED") return NextResponse.json({ error: "Graduated Grantee records cannot be changed by SKEAP promotion." }, { status: 409 });
    if (message === "STALE_WAITLIST_CYCLE" || message === "SKEAP_CYCLE_CLOSED") {
      return NextResponse.json({ error: "This SKEAP waitlist cycle is closed and cannot be promoted." }, { status: 409 });
    }
    if (message === "CAPACITY_FULL") {
      return NextResponse.json(
        { error: `All ${maxSlots} SKEAP slots are currently filled. The applicant remains WAITLISTED.` },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}