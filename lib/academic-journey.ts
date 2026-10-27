import { getCurrentAcademicSemester } from "./semester-progress";

export type AcademicJourneySubmission = {
  semester: string;
  status: string;
  submittedAt?: Date | string;
};

export type AcademicJourneyStepStatus =
  | "locked"
  | "scheduled_locked"
  | "open_for_submit"
  | "under_review"
  | "action_required"
  | "validated";

export function normalizeAcademicJourneyStepStatus(status: unknown): AcademicJourneyStepStatus {
  switch (status) {
    case "locked":
    case "scheduled_locked":
    case "open_for_submit":
    case "under_review":
    case "action_required":
    case "validated":
      return status;
    case "LOCKED":
      return "locked";
    case "pending_submission":
    case "pending_docs":
      return "open_for_submit";
    case "approved":
      return "validated";
    case "REJECTED":
    case "RETURNED_FOR_EDIT":
      return "action_required";
    case "PENDING":
      return "under_review";
    default:
      return "scheduled_locked";
  }
}

export function resolveScheduledJourneyStepStatus(
  status: AcademicJourneyStepStatus,
  schedule: { opensAt: Date; closesAt: Date } | null,
  now = new Date(),
): AcademicJourneyStepStatus {
  if (status !== "open_for_submit") {
    return status;
  }

  if (!schedule || now < schedule.opensAt || now > schedule.closesAt) {
    return "scheduled_locked";
  }

  return "open_for_submit";
}

function getSemesterOrder(semester: string) {
  const match = semester.match(/^(\d{4})-(\d{4})\s+(First|Second) Semester$/i);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;

  return Number(match[1]) * 2 + (match[3].toLowerCase() === "second" ? 1 : 0);
}

export function getAcademicJourneyProgress(
  submissions: AcademicJourneySubmission[],
  dateEnrolled: Date,
  now = new Date(),
  totalYears = 4,
  activeSemester?: string,
) {
  const years = Number.isFinite(totalYears) ? Math.max(1, Math.floor(totalYears)) : 4;
  const termCount = years * 2;
  const startOrder = getSemesterOrder(getCurrentAcademicSemester(dateEnrolled));
  const activeOrder = activeSemester ? getSemesterOrder(activeSemester) : null;
  const currentOrder = activeOrder ?? getSemesterOrder(getCurrentAcademicSemester(now));

  if (startOrder === null || currentOrder === null) {
    throw new Error("Unable to determine academic journey semester order.");
  }

  const currentStepSemester = getSemesterLabel(currentOrder);
  const currentStepSubmission = submissions
    .filter((submission) => submission.semester.trim() === currentStepSemester)
    .reduce<AcademicJourneySubmission | null>((latest, submission) => {
      if (!latest) return submission;

      const latestTime = latest.submittedAt
        ? new Date(latest.submittedAt).getTime()
        : 0;
      const currentTime = submission.submittedAt
        ? new Date(submission.submittedAt).getTime()
        : 0;
      return currentTime > latestTime ? submission : latest;
    }, null);
  const validatedSemesterIndexes = Array.from(new Set(
    submissions
      .filter((submission) => submission.status === "APPROVED")
      .map((submission) => getSemesterOrder(submission.semester.trim()))
      .filter((order): order is number => order !== null)
      .map((order) => order - startOrder)
      .filter((index) => index >= 0 && index < termCount)
  )).sort((a, b) => a - b);

  return {
    currentSemesterIndex: Math.max(0, Math.min(currentOrder - startOrder, termCount)),
    currentStepSemester,
    validatedSemesterIndexes,
    currentStepStatus: !currentStepSubmission
      ? "open_for_submit" as const
      : currentStepSubmission.status === "APPROVED"
        ? "validated" as const
        : currentStepSubmission.status === "REJECTED" ||
            currentStepSubmission.status === "RETURNED_FOR_EDIT"
          ? "action_required" as const
          : "under_review" as const,
  };
}

function getSemesterLabel(order: number) {
  const startYear = Math.floor(order / 2);
  const semester = order % 2 === 0 ? "First" : "Second";
  return `${startYear}-${startYear + 1} ${semester} Semester`;
}

export function getAcademicJourneyTerms(totalYears: number) {
  const years = Number.isFinite(totalYears) ? Math.max(1, Math.floor(totalYears)) : 4;
  return Array.from({ length: years }, (_, index) => {
    const year = index + 1;
    const ordinalYear = `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"} Year`;

    return [1, 2].map((semester) => ({
      label: `Y${year} S${semester}`,
      year: ordinalYear,
      semester: `${semester}${semester === 1 ? "st" : "nd"} Sem`,
    }));
  }).flat();
}

export function getApprovedSemesterCount(submissions: AcademicJourneySubmission[], totalYears = 4) {
  const approvedSemesters = new Set(
    submissions
      .filter((submission) => submission.status === "APPROVED")
      .map((submission) => submission.semester.trim().toLowerCase())
      .filter(Boolean)
  );

  const years = Number.isFinite(totalYears) ? Math.max(1, Math.floor(totalYears)) : 4;
  return Math.min(approvedSemesters.size, years * 2);
}
