import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import { prisma } from "@/lib/prisma";
import { isKKMemberAgeOutReason } from "@/lib/kk-member-archive";
import { getExactAge } from "@/lib/skeap-age";
import {
  isSkeapApplicationBlockingReapplication,
  SKEAP_APPLICATION_REAPPLICATION_BLOCKING_SUBMISSION_STATUSES,
} from "@/lib/skeap-application-guard";
import { getAcademicYearDateRange, getCurrentAcademicYear } from "@/lib/semester";

export type PastGranteeReapplicationState = {
  userId: string | null;
  kkProfileStatus: string | null;
  isKkProfileVerified: boolean;
  isPastGrantee: boolean;
  outcome: string | null;
  age: number | null;
  hasActiveOrPendingApplication: boolean;
  isEligiblePastGrantee: boolean;
  isApplicationOpen: boolean;
  openTerm: string | null;
  nextScheduleHint: string;
};

export async function getPastGranteeReapplicationState(
  userId: string | null,
  now = new Date(),
): Promise<PastGranteeReapplicationState> {
  const academicYearRange = getAcademicYearDateRange(getCurrentAcademicYear(now));
  if (!academicYearRange) {
    throw new Error("Unable to determine the active SKEAP cycle.");
  }

  const [user, scheduleState] = await Promise.all([
    userId
      ? prisma.user.findUnique({
          where: { id: userId },
          select: {
            kkStatus: true,
            kkProfile: { select: { birthDate: true, isVerified: true } },
            grantee: { select: { status: true } },
            skeapApplications: {
              where: {
                submittedAt: {
                  gte: academicYearRange.start,
                  lt: academicYearRange.end,
                },
                status: { in: [...SKEAP_APPLICATION_REAPPLICATION_BLOCKING_SUBMISSION_STATUSES] },
              },
              orderBy: { submittedAt: "desc" },
              take: 1,
              select: { status: true },
            },
          },
        })
      : Promise.resolve(null),
    getAcademicTermScheduleState(now),
  ]);

  const age = getExactAge(user?.kkProfile?.birthDate, now);
  const granteeStatus = user?.grantee?.status ?? null;
  const isPastGrantee =
    granteeStatus !== null &&
    granteeStatus !== "ACTIVE" &&
    granteeStatus !== "PROBATIONARY";
  const isAgedOut =
    (age !== null && age >= 31) || isKKMemberAgeOutReason(user?.kkStatus);
  const outcome = isAgedOut ? "AGED_OUT" : granteeStatus;
  const hasActiveOrPendingApplication = isSkeapApplicationBlockingReapplication(
    user?.skeapApplications[0]?.status,
  );
  const isEligiblePastGrantee =
    isPastGrantee &&
    age !== null &&
    age >= 15 &&
    age <= 30 &&
    outcome !== "GRADUATED" &&
    !hasActiveOrPendingApplication;
  const nextScheduleHint =
    scheduleState.window.status === "UPCOMING" &&
    scheduleState.window.semester &&
    scheduleState.window.opensAt
      ? `Next term: ${scheduleState.window.semester} opens ${new Intl.DateTimeFormat(
          "en-PH",
          { dateStyle: "medium", timeZone: "Asia/Manila" },
        ).format(new Date(scheduleState.window.opensAt))}.`
      : "No upcoming SKEAP application period is scheduled.";

  return {
    userId,
    kkProfileStatus: user?.kkStatus ?? null,
    isKkProfileVerified: user?.kkProfile?.isVerified ?? false,
    isPastGrantee,
    outcome,
    age,
    hasActiveOrPendingApplication,
    isEligiblePastGrantee,
    isApplicationOpen: scheduleState.window.status === "OPEN",
    openTerm: scheduleState.window.status === "OPEN" ? scheduleState.window.semester : null,
    nextScheduleHint,
  };
}
