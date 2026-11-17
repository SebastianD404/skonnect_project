import {
  getAcademicJourneyProgress,
  getAcademicJourneyTermsForRange,
  type AcademicJourneyInitialGrant,
  type AcademicJourneySubmission,
} from "@/lib/academic-journey";

type GraduationJourneyInput = {
  submissions: AcademicJourneySubmission[];
  dateEnrolled: Date;
  yearLevel?: string | null;
  journeyStart?: string | null;
  journeyEnd?: string | null;
  entryTerm?: string;
  now?: Date;
  initialGrant?: AcademicJourneyInitialGrant | null;
};

export function getGranteeGraduationProgress({
  submissions,
  dateEnrolled,
  yearLevel,
  journeyStart,
  journeyEnd,
  entryTerm,
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
    entryTerm,
    yearLevel,
    journeyStart,
  );
  const totalRequiredSemesters = progress.eligibleSemesterCount;
  const validatedCount = progress.validatedSemesterIndexes.length;

  return {
    ...progress,
    totalRequiredSemesters,
    validatedCount,
    isComplete: totalRequiredSemesters > 0 && validatedCount >= totalRequiredSemesters,
  };
}
