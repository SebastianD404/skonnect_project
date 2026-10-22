import { getCurrentAcademicSemester } from "./semester-progress";

export type AcademicJourneySubmission = {
  semester: string;
  status: string;
  submittedAt?: Date | string;
};

function getSemesterOrder(semester: string) {
  const match = semester.match(/^(\d{4})-(\d{4})\s+(First|Second) Semester$/i);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;

  return Number(match[1]) * 2 + (match[3].toLowerCase() === "second" ? 1 : 0);
}

export function getAcademicJourneyProgress(
  submissions: AcademicJourneySubmission[],
  dateEnrolled: Date,
  now = new Date(),
  totalYears = 4
) {
  const years = Number.isFinite(totalYears) ? Math.max(1, Math.floor(totalYears)) : 4;
  const termCount = years * 2;
  const startOrder = getSemesterOrder(getCurrentAcademicSemester(dateEnrolled));
  const currentOrder = getSemesterOrder(getCurrentAcademicSemester(now));

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
    validatedSemesterIndexes,
    currentStepStatus: currentStepSubmission?.status === "APPROVED"
      ? "approved" as const
      : currentStepSubmission && !["REJECTED", "RETURNED_FOR_EDIT"].includes(currentStepSubmission.status)
        ? "under_review" as const
        : "pending_docs" as const,
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
