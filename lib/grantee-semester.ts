import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getAcademicTermScheduleState,
  type AcademicTermScheduleRecord,
} from "@/lib/academic-term-schedule";
import { getGranteeGraduationProgress } from "@/lib/grantee-graduation-readiness";

export type GranteeTerm = {
  schoolYear: string;
  semester: string;
  termLabel: string;
};

export type DetectedGranteeTargetTerm = GranteeTerm & {
  isResubmission: boolean;
  reason?: string;
  detectionSummary: string;
  previousApprovedTerm: GranteeTerm | null;
  hasPendingSubmission: boolean;
  canReplacePendingSubmission: boolean;
  hasApprovedSubmission: boolean;
};

export type GranteeTimelineSubmission = {
  id?: string;
  semester: string;
  status: string;
  submittedAt?: Date | string;
  reviewedById?: string | null;
  reviewedAt?: Date | string | null;
  generalAverage?: number | null;
  ocrGwa?: number | null;
  reviewNotes?: string | null;
  gradeFileUrl?: string | null;
  coeFileUrl?: string | null;
};

export type GranteeTimelineProfile = {
  yearLevel?: string | null;
  entryAcademicYear?: string | null;
  entrySemester?: string | null;
  dateEnrolled?: Date | null;
  journeyStart?: string | null;
  journeyEnd?: string | null;
  skeapApplications?: Array<{
    status: string;
    submittedAt: Date | string;
    updatedAt?: Date | string;
    gwa?: number | null;
    enrollmentFileUrl?: string | null;
    reportCardFileUrl?: string | null;
    educationLevel?: string | null;
    currentCourse?: string | null;
    yearLevel?: string | null;
  }>;
};

export type GranteeAcademicTimelineSettings = {
  schedules: AcademicTermScheduleRecord[];
  now?: Date;
};

type ParsedTerm = {
  startYear: number;
  endYear: number;
  semester: string;
};

function parseTermLabel(value: string): ParsedTerm | null {
  const match = /^(\d{4})-(\d{4})\s+(First Semester|Second Semester|Annual \/ School Year)$/i.exec(value.trim());
  if (!match) return null;

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear !== startYear + 1) return null;

  const semester = match[3].toLowerCase() === "first semester"
    ? "First Semester"
    : match[3].toLowerCase() === "second semester"
      ? "Second Semester"
      : "Annual / School Year";

  return { startYear, endYear, semester };
}

function termFromParts(startYear: number, semester: string): GranteeTerm {
  const schoolYear = `${startYear}-${startYear + 1}`;
  return { schoolYear, semester, termLabel: `${schoolYear} ${semester}` };
}

function termFromDate(date: Date): GranteeTerm {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);

  if (!Number.isInteger(year) || !Number.isInteger(month)) {
    throw new Error("Unable to determine the grantee's entry semester.");
  }

  if (month >= 6 && month <= 10) return termFromParts(year, "First Semester");
  if (month >= 11) return termFromParts(year, "Second Semester");
  return termFromParts(year - 1, "Second Semester");
}

function termOrder(term: GranteeTerm) {
  const parsed = parseTermLabel(term.termLabel);
  if (!parsed || parsed.semester === "Annual / School Year") return null;
  return parsed.startYear * 2 + (parsed.semester === "Second Semester" ? 1 : 0);
}

function termFromLabel(value: string): GranteeTerm | null {
  const parsed = parseTermLabel(value);
  if (!parsed || parsed.semester === "Annual / School Year") return null;
  return {
    schoolYear: `${parsed.startYear}-${parsed.endYear}`,
    semester: parsed.semester,
    termLabel: `${parsed.startYear}-${parsed.endYear} ${parsed.semester}`,
  };
}

function resolveStoredEntryTerm(grantee: GranteeTimelineProfile) {
  const academicYear = grantee.entryAcademicYear?.trim();
  const semester = grantee.entrySemester?.trim();
  if (!academicYear && !semester) return null;

  const term = academicYear && semester
    ? termFromLabel(`${academicYear} ${semester}`)
    : null;
  if (!term) {
    throw new Error("The grantee's stored entry academic term is invalid.");
  }
  return term;
}

export function resolveGranteeEntryTerm(
  schedules: AcademicTermScheduleRecord[],
  now = new Date(),
): GranteeTerm {
  const orderedSchedules = [...schedules].sort(
    (a, b) => a.opensAt.getTime() - b.opensAt.getTime(),
  );
  const activeSchedule = orderedSchedules.find(
    (schedule) => schedule.opensAt <= now && schedule.closesAt >= now,
  );
  if (activeSchedule) {
    const activeTerm = termFromLabel(activeSchedule.semester);
    if (!activeTerm) {
      throw new Error(`The active academic schedule has an invalid term: "${activeSchedule.semester}".`);
    }
    return activeTerm;
  }

  return termFromDate(now);
}

function previousApprovedTerm(
  submissions: GranteeTimelineSubmission[],
  targetTerm: GranteeTerm,
) {
  const targetOrder = termOrder(targetTerm);
  if (targetOrder === null) return null;

  const approvedTerms = submissions
    .filter((submission) => submission.status === SubmissionStatus.APPROVED)
    .map((submission) => termFromLabel(submission.semester))
    .filter((term): term is GranteeTerm => term !== null)
    .filter((term) => {
      const order = termOrder(term);
      return order !== null && order < targetOrder;
    })
    .sort((a, b) => (termOrder(a) ?? 0) - (termOrder(b) ?? 0));

  return approvedTerms[approvedTerms.length - 1] ?? null;
}

export function resolveGranteeAcademicTimeline(
  grantee: GranteeTimelineProfile,
  submissions: GranteeTimelineSubmission[],
  activeSettings: GranteeAcademicTimelineSettings,
) {
  const now = activeSettings.now ?? new Date();
  const entryTerm =
    resolveStoredEntryTerm(grantee) ??
    resolveGranteeEntryTerm(activeSettings.schedules, now);
  const dateEnrolled = grantee.dateEnrolled ?? now;
  const approvedApplication = grantee.skeapApplications?.find(
    (application) => application.status === "APPROVED",
  ) ?? null;
  const educationLevel = approvedApplication?.educationLevel?.toLowerCase() ?? "";
  const course = approvedApplication?.currentCourse?.toLowerCase() ?? "";
  const applicationYearLevel = approvedApplication?.yearLevel?.toLowerCase() ?? "";
  const inferredTotalYears = educationLevel.includes("senior high")
    ? 2
    : educationLevel.includes("junior high")
      ? 4
      : /6[- ]year|6th year|sixth year/.test(`${course} ${applicationYearLevel}`)
        ? 6
        : /2[- ]year|2nd year|second year/.test(`${course} ${applicationYearLevel}`)
          ? 2
          : 4;
  const initialGrant = approvedApplication
    ? {
        semester: entryTerm.termLabel,
        gwa: approvedApplication.gwa ?? null,
        gradeReportUrl: approvedApplication.reportCardFileUrl ?? null,
        coeFileUrl: approvedApplication.enrollmentFileUrl ?? null,
      }
    : null;
  const journeyProgress = getGranteeGraduationProgress({
    submissions,
    dateEnrolled,
    yearLevel: grantee.yearLevel,
    totalYears: inferredTotalYears,
    journeyStart: grantee.journeyStart,
    journeyEnd: grantee.journeyEnd,
    entryTerm: entryTerm.termLabel,
    now,
    initialGrant,
  });
  const targetTerm = termFromLabel(journeyProgress.currentStepSemester);
  if (!targetTerm) {
    throw new Error("Unable to determine the grantee's current semester.");
  }

  const targetSubmissions = submissions.filter(
    (submission) => submission.semester.trim() === targetTerm.termLabel,
  );
  const latestTargetSubmission = targetSubmissions.reduce<GranteeTimelineSubmission | null>(
    (latest, submission) => {
      if (!latest) return submission;
      const latestTime = latest.submittedAt ? new Date(latest.submittedAt).getTime() : 0;
      const submissionTime = submission.submittedAt ? new Date(submission.submittedAt).getTime() : 0;
      return submissionTime >= latestTime ? submission : latest;
    },
    null,
  );
  const isResubmission =
    latestTargetSubmission?.status === SubmissionStatus.RETURNED_FOR_EDIT;
  const previousTerm = previousApprovedTerm(submissions, targetTerm);
  const formattedYear = targetTerm.schoolYear.replace("-", "–");

  return {
    entryTerm,
    targetTerm: {
      ...targetTerm,
      isResubmission,
      ...(isResubmission
        ? { reason: `Resubmitting returned requirements for ${targetTerm.termLabel}` }
        : {}),
      detectionSummary: isResubmission
        ? `Your ${formattedYear} ${targetTerm.semester} requirements were returned for correction.`
        : previousTerm
          ? `Automatically detected based on your approved ${previousTerm.schoolYear.replace("-", "–")} ${previousTerm.semester} requirements.`
          : `Your entry term is ${targetTerm.termLabel}.`,
      previousApprovedTerm: previousTerm,
      hasPendingSubmission: targetSubmissions.some((submission) =>
        submission.status === SubmissionStatus.PENDING ||
        submission.status === SubmissionStatus.PRE_QUALIFIED ||
        submission.status === SubmissionStatus.AWAITING_PHYSICAL_CTC
      ),
      canReplacePendingSubmission: targetSubmissions.some(
        (submission) =>
          submission.status === SubmissionStatus.PENDING &&
          !submission.reviewedById &&
          !submission.reviewedAt,
      ),
      hasApprovedSubmission: targetSubmissions.some(
        (submission) => submission.status === SubmissionStatus.APPROVED,
      ),
    } satisfies DetectedGranteeTargetTerm,
    journeyProgress,
  };
}

export function getScheduleSemesterForTargetTerm(term: Pick<GranteeTerm, "schoolYear" | "semester">) {
  const scheduleSemester = term.semester === "Annual / School Year" ? "First Semester" : term.semester;
  return `${term.schoolYear} ${scheduleSemester}`;
}

export async function detectGranteeTargetTerm(
  userId: string,
  activeSettings?: GranteeAcademicTimelineSettings,
): Promise<DetectedGranteeTargetTerm | null> {
  const grantee = await prisma.grantee.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "PROBATIONARY"] },
    },
    select: {
      yearLevel: true,
      entryAcademicYear: true,
      entrySemester: true,
      dateEnrolled: true,
      journeyStart: true,
      journeyEnd: true,
      user: {
        select: {
          skeapApplications: {
            orderBy: { submittedAt: "desc" },
            take: 5,
            select: {
              status: true,
              submittedAt: true,
              updatedAt: true,
              gwa: true,
              enrollmentFileUrl: true,
              reportCardFileUrl: true,
              educationLevel: true,
              currentCourse: true,
              yearLevel: true,
            },
          },
        },
      },
      submissions: {
        orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
        select: {
          id: true,
          semester: true,
          status: true,
          submittedAt: true,
          reviewedById: true,
          reviewedAt: true,
          generalAverage: true,
          ocrGwa: true,
          reviewNotes: true,
          gradeFileUrl: true,
          coeFileUrl: true,
        },
      },
    },
  });

  if (!grantee) return null;

  const settings = activeSettings ?? (
    grantee.entryAcademicYear && grantee.entrySemester
      ? { schedules: [] }
      : { schedules: (await getAcademicTermScheduleState()).schedules }
  );
  return resolveGranteeAcademicTimeline(
    {
      ...grantee,
      skeapApplications: grantee.user.skeapApplications,
    },
    grantee.submissions,
    settings,
  ).targetTerm;
}
