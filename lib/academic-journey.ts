export type AcademicJourneySubmission = {
  semester: string;
  status: string;
};

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
