import { SubmissionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";

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
    throw new Error("Unable to determine the academic term from the approved SKEAP application date.");
  }

  if (month >= 6 && month <= 10) return termFromParts(year, "First Semester");
  if (month >= 11) return termFromParts(year, "Second Semester");
  return termFromParts(year - 1, "Second Semester");
}

function getEducationLevelLabel(value: string | null | undefined) {
  return (value ?? "").trim().toLocaleLowerCase().replace(/[-_]+/g, " ");
}

function isJuniorHighSchool(value: string | null | undefined) {
  const normalized = getEducationLevelLabel(value);
  return (
    normalized === "junior high school" ||
    normalized === "junior high" ||
    normalized === "jhs" ||
    /^grade\s*(7|8|9|10)$/.test(normalized)
  );
}

function getNextTerm(previousTerm: GranteeTerm, educationLevel: string | null | undefined): GranteeTerm {
  const parsed = parseTermLabel(previousTerm.termLabel);
  if (!parsed) {
    throw new Error(`Unable to determine the next requirement term from "${previousTerm.termLabel}".`);
  }

  if (isJuniorHighSchool(educationLevel)) {
    return termFromParts(parsed.startYear + 1, "Annual / School Year");
  }

  if (parsed.semester === "First Semester") {
    return termFromParts(parsed.startYear, "Second Semester");
  }
  return termFromParts(parsed.startYear + 1, "First Semester");
}

export function getScheduleSemesterForTargetTerm(term: Pick<GranteeTerm, "schoolYear" | "semester">) {
  const scheduleSemester = term.semester === "Annual / School Year" ? "First Semester" : term.semester;
  return `${term.schoolYear} ${scheduleSemester}`;
}

function formatSchoolYear(schoolYear: string) {
  return schoolYear.replace("-", "–");
}

function getDetectionSummary(previousTerm: GranteeTerm, source: "submission" | "application") {
  const formattedYear = formatSchoolYear(previousTerm.schoolYear);
  return source === "submission"
    ? `Automatically detected based on your approved ${formattedYear} ${previousTerm.semester} requirements.`
    : `Automatically detected based on your approved SKEAP application term, ${formattedYear} ${previousTerm.semester}.`;
}

export async function detectGranteeTargetTerm(userId: string): Promise<DetectedGranteeTargetTerm | null> {
  const grantee = await prisma.grantee.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "PROBATIONARY"] },
    },
    select: {
      id: true,
      yearLevel: true,
      user: {
        select: {
          skeapApplications: {
            where: { status: SubmissionStatus.APPROVED },
            orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
            take: 1,
            select: { educationLevel: true, submittedAt: true },
          },
        },
      },
      submissions: {
        orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
        select: {
          semester: true,
          status: true,
          submittedAt: true,
          reviewedById: true,
          reviewedAt: true,
        },
      },
    },
  });

  if (!grantee) return null;

  const returnedSubmission = [...grantee.submissions]
    .reverse()
    .find((submission) => submission.status === SubmissionStatus.RETURNED_FOR_EDIT);
  if (returnedSubmission) {
    const returnedTerm = parseTermLabel(returnedSubmission.semester);
    if (!returnedTerm) {
      throw new Error(`Returned requirement submission has an invalid term: "${returnedSubmission.semester}".`);
    }

    const schoolYear = `${returnedTerm.startYear}-${returnedTerm.endYear}`;
    const semester = returnedTerm.semester;
    const term = { schoolYear, semester, termLabel: `${schoolYear} ${semester}` };
    const previousApprovedSubmission = [...grantee.submissions]
      .reverse()
      .find(
        (submission) =>
          submission.status === SubmissionStatus.APPROVED &&
          submission.submittedAt <= returnedSubmission.submittedAt
      );
    const parsedPreviousApprovedTerm = previousApprovedSubmission
      ? parseTermLabel(previousApprovedSubmission.semester)
      : null;
    if (previousApprovedSubmission && !parsedPreviousApprovedTerm) {
      throw new Error(
        `Approved requirement submission has an invalid term: "${previousApprovedSubmission.semester}".`
      );
    }
    const previousApprovedTerm = parsedPreviousApprovedTerm
      ? {
          schoolYear: `${parsedPreviousApprovedTerm.startYear}-${parsedPreviousApprovedTerm.endYear}`,
          semester: parsedPreviousApprovedTerm.semester,
          termLabel: `${parsedPreviousApprovedTerm.startYear}-${parsedPreviousApprovedTerm.endYear} ${parsedPreviousApprovedTerm.semester}`,
        }
      : null;
    return {
      ...term,
      isResubmission: true,
      reason: `Resubmitting returned requirements for ${schoolYear} ${semester}`,
      detectionSummary: `Your ${formatSchoolYear(schoolYear)} ${semester} requirements were returned for correction.`,
      previousApprovedTerm,
      hasPendingSubmission: grantee.submissions.some(
        (submission) =>
          submission.semester === term.termLabel &&
          (submission.status === SubmissionStatus.PENDING ||
            submission.status === SubmissionStatus.PRE_QUALIFIED ||
            submission.status === SubmissionStatus.AWAITING_PHYSICAL_CTC)
      ),
      canReplacePendingSubmission: grantee.submissions.some(
        (submission) =>
          submission.semester === term.termLabel &&
          submission.status === SubmissionStatus.PENDING &&
          !submission.reviewedById &&
          !submission.reviewedAt
      ),
      hasApprovedSubmission: grantee.submissions.some(
        (submission) =>
          submission.semester === term.termLabel &&
          submission.status === SubmissionStatus.APPROVED
      ),
    };
  }

  const latestApprovedSubmission = [...grantee.submissions]
    .reverse()
    .find((submission) => submission.status === SubmissionStatus.APPROVED);
  const approvedApplication = grantee.user.skeapApplications[0];
  if (!latestApprovedSubmission && !approvedApplication) return null;

  let previousTerm: GranteeTerm;
  if (latestApprovedSubmission) {
    const parsed = parseTermLabel(latestApprovedSubmission.semester);
    if (!parsed) {
      throw new Error(`Approved requirement submission has an invalid term: "${latestApprovedSubmission.semester}".`);
    }
    const schoolYear = `${parsed.startYear}-${parsed.endYear}`;
    previousTerm = { schoolYear, semester: parsed.semester, termLabel: `${schoolYear} ${parsed.semester}` };
  } else if (approvedApplication) {
    previousTerm = termFromDate(approvedApplication.submittedAt);
  } else {
    return null;
  }
  const educationLevel = approvedApplication?.educationLevel ?? grantee.yearLevel;
  const targetTerm = getNextTerm(previousTerm, educationLevel);
  const hasPendingSubmission = grantee.submissions.some(
    (submission) =>
      submission.semester === targetTerm.termLabel &&
      (submission.status === SubmissionStatus.PENDING ||
        submission.status === SubmissionStatus.PRE_QUALIFIED ||
        submission.status === SubmissionStatus.AWAITING_PHYSICAL_CTC)
  );
  const canReplacePendingSubmission = grantee.submissions.some(
    (submission) =>
      submission.semester === targetTerm.termLabel &&
      submission.status === SubmissionStatus.PENDING &&
      !submission.reviewedById &&
      !submission.reviewedAt
  );
  const hasApprovedSubmission = grantee.submissions.some(
    (submission) =>
      submission.semester === targetTerm.termLabel &&
      submission.status === SubmissionStatus.APPROVED
  );

  return {
    ...targetTerm,
    isResubmission: false,
    detectionSummary: getDetectionSummary(
      previousTerm,
      latestApprovedSubmission ? "submission" : "application"
    ),
    previousApprovedTerm: previousTerm,
    hasPendingSubmission,
    canReplacePendingSubmission,
    hasApprovedSubmission,
  };
}
