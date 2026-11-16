import {
  getAcademicJourneyProgress,
  getAcademicJourneyTermsForRange,
  type AcademicJourneyInitialGrant,
  type AcademicJourneySubmission,
} from "@/lib/academic-journey";

type GraduationJourneyInput = {
  submissions: AcademicJourneySubmission[];
  dateEnrolled: Date;
  journeyStart?: string | null;
  journeyEnd?: string | null;
  now?: Date;
  initialGrant?: AcademicJourneyInitialGrant | null;
};

export function getGranteeGraduationProgress({
  submissions,
  dateEnrolled,
  journeyStart,
  journeyEnd,
  now = new Date(),
  initialGrant,
}: GraduationJourneyInput) {
  const totalYears = journeyStart && journeyEnd
    ? getAcademicJourneyTermsForRange(journeyStart, journeyEnd).length / 2
    : 4;
  const progress = getAcademicJourneyProgress(
    submissions,
    dateEnrolled,
    now,
    totalYears,
    initialGrant,
  );
  const totalRequiredSemesters = progress.nodes.length;
  const validatedCount = progress.validatedSemesterIndexes.length;

  return {
    ...progress,
    totalRequiredSemesters,
    validatedCount,
    isComplete: totalRequiredSemesters > 0 && validatedCount >= totalRequiredSemesters,
  };
}
