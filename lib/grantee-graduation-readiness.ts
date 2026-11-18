import {
  getAcademicJourneyGraduationYear,
  getAcademicJourneyProgress,
  getAcademicJourneyTermsForRange,
  type AcademicJourneyInitialGrant,
  type AcademicJourneySubmission,
} from "@/lib/academic-journey";

type GraduationJourneyInput = {
  submissions: AcademicJourneySubmission[];
  dateEnrolled: Date;
  yearLevel?: string | null;
  totalYears?: number;
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
  totalYears: configuredTotalYears,
  journeyStart,
  journeyEnd,
  entryTerm,
  now = new Date(),
  initialGrant,
}: GraduationJourneyInput) {
  const rangeTotalYears = journeyStart && journeyEnd
    ? getAcademicJourneyTermsForRange(journeyStart, journeyEnd).length / 2
    : null;
  const graduationYear = journeyEnd ? getAcademicJourneyGraduationYear(journeyEnd) : null;
  const totalYears = rangeTotalYears ??
    graduationYear ??
    (configuredTotalYears && configuredTotalYears > 0 ? configuredTotalYears : 4);
  const progress = getAcademicJourneyProgress(
    submissions,
    dateEnrolled,
    now,
    totalYears,
    initialGrant,
    entryTerm,
    yearLevel,
    journeyStart,
    journeyEnd,
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
