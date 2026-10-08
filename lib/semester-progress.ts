export type SemesterProgressSubmission = {
  semester: string;
  status: string;
  gradeFileUrl?: string;
  coeFileUrl?: string;
  submittedAt?: string | Date;
};

const TERM_ORDER: Record<string, number> = {
  "First Semester": 1,
  "Second Semester": 2,
};

function parseSemesterLabel(semester: string) {
  const match = semester.match(/^(\d{4})-(\d{4})\s+(First Semester|Second Semester)$/i);
  if (!match) return null;

  const startYear = Number(match[1]);
  const term = match[3].toLowerCase() === "first semester" ? "First Semester" : "Second Semester";
  const termOrder = TERM_ORDER[term] ?? 0;

  return { startYear, endYear: Number(match[2]), term, termOrder };
}

export function getCurrentAcademicSemester(referenceDate = new Date()) {
  const month = referenceDate.getMonth();
  const year = referenceDate.getFullYear();

  if (month >= 5 && month <= 9) {
    return `${year}-${year + 1} First Semester`;
  }

  if (month >= 10) {
    return `${year}-${year + 1} Second Semester`;
  }

  return `${year - 1}-${year} Second Semester`;
}

export function isAllowedAcademicSemester(semester: string) {
  const parsed = parseSemesterLabel(semester.trim());
  if (!parsed) return false;
  return parsed.endYear === parsed.startYear + 1;
}

export function getPreviousAcademicSemester(semester: string) {
  const parsed = parseSemesterLabel(semester.trim());
  if (!parsed) return null;
  return parsed.term === "First Semester"
    ? `${parsed.startYear - 1}-${parsed.startYear} Second Semester`
    : `${parsed.startYear}-${parsed.startYear + 1} First Semester`;
}

export function getDocumentSemesterOptions(
  existingSemesters: string[],
  referenceDate = new Date()
) {
  const current = getCurrentAcademicSemester(referenceDate);
  const previous = getPreviousAcademicSemester(current);
  const currentMatch = current.match(/^(\d{4})-(\d{4})\s+(First|Second) Semester$/);
  const next =
    currentMatch?.[3] === "First"
      ? `${currentMatch[1]}-${currentMatch[2]} Second Semester`
      : currentMatch
        ? `${currentMatch[2]}-${Number(currentMatch[2]) + 1} First Semester`
        : current;

  return Array.from(
    new Set([...existingSemesters, ...(previous ? [previous] : []), current, next])
  )
    .filter((semester) => isAllowedAcademicSemester(semester))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }))
    .map((value) => ({
      value,
      label: value === current ? `${value} (Current)` : value,
    }));
}

function pickLatestSubmission(submissions: SemesterProgressSubmission[]) {
  return submissions.reduce<SemesterProgressSubmission | null>((latest, current) => {
    if (!latest) return current;

    const latestTime = latest.submittedAt ? new Date(latest.submittedAt).getTime() : 0;
    const currentTime = current.submittedAt ? new Date(current.submittedAt).getTime() : 0;

    return currentTime > latestTime ? current : latest;
  }, null);
}

export function resolveSemesterTrackerTarget(submissions: SemesterProgressSubmission[]) {
  const currentSemester = getCurrentAcademicSemester();

  const exactMatch = submissions.find((submission) => submission.semester === currentSemester);
  if (exactMatch) {
    return currentSemester;
  }

  const currentAcademicYear = parseSemesterLabel(currentSemester)?.startYear;
  if (currentAcademicYear !== undefined) {
    const sameYearSemesters = submissions
      .map((submission) => ({
        submission,
        parsed: parseSemesterLabel(submission.semester),
      }))
      .filter(({ parsed }) => parsed?.startYear === currentAcademicYear)
      .sort((a, b) => (a.parsed!.termOrder === b.parsed!.termOrder ? 0 : a.parsed!.termOrder - b.parsed!.termOrder));

    const latestSameYear = sameYearSemesters[sameYearSemesters.length - 1]?.submission;
    if (latestSameYear) {
      return latestSameYear.semester;
    }
  }

  return pickLatestSubmission(submissions)?.semester ?? currentSemester;
}

export function buildSemesterTracker(
  submissions: SemesterProgressSubmission[],
  currentSemesterOverride?: string
) {
  const current = currentSemesterOverride?.trim() || resolveSemesterTrackerTarget(submissions);
  const currentSubmission = submissions
    .filter((submission) => submission.semester === current)
    .reduce<SemesterProgressSubmission | null>((latest, submission) => {
      if (!latest) return submission;

      const latestTime = latest.submittedAt ? new Date(latest.submittedAt).getTime() : 0;
      const currentTime = submission.submittedAt ? new Date(submission.submittedAt).getTime() : 0;
      return currentTime > latestTime ? submission : latest;
    }, null);

  let approved = 0;

  if (currentSubmission?.status === "APPROVED" && currentSubmission.coeFileUrl) {
    approved += 1;
  }

  if (currentSubmission?.status === "APPROVED" && currentSubmission.gradeFileUrl) {
    approved += 1;
  }

  const total = 2;
  const pct = Math.round((approved / total) * 100);

  return { current, approved, total, pct };
}