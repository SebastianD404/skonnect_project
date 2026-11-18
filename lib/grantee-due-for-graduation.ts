import { getAcademicSemesterOrder, getCurrentManilaAcademicSemester } from "./semester-progress";
import { isValidAcademicJourneyRange } from "./academic-journey";

export type GranteeDueForGraduationInput = {
  status: string;
  journeyStart?: string | null;
  journeyEnd?: string | null;
  currentStepSemester?: string | null;
  finalJourneySemester?: string | null;
};

export function isGranteeDueForGraduation(
  grantee: GranteeDueForGraduationInput,
  now = new Date(),
) {
  if (
    !grantee.journeyStart ||
    !grantee.journeyEnd ||
    !isValidAcademicJourneyRange(grantee.journeyStart, grantee.journeyEnd) ||
    !grantee.finalJourneySemester ||
    !["ACTIVE", "PROBATIONARY"].includes(grantee.status)
  ) {
    return false;
  }

  const finalTermOrder = getAcademicSemesterOrder(grantee.finalJourneySemester);
  const currentTermOrder = getAcademicSemesterOrder(getCurrentManilaAcademicSemester(now));
  if (
    grantee.currentStepSemester === grantee.finalJourneySemester ||
    (finalTermOrder !== null && currentTermOrder === finalTermOrder)
  ) {
    return true;
  }

  if (grantee.status !== "ACTIVE") {
    return false;
  }

  return finalTermOrder !== null &&
    currentTermOrder !== null &&
    finalTermOrder < currentTermOrder;
}
