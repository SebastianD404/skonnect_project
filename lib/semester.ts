export type RecentSemester = {
  name: string;
  label: string;
  isCurrent: boolean;
};

export function getCurrentAcademicYear(date = new Date()) {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 7 ? year : year - 1;
  return `${startYear}-${startYear + 1}`;
}

export function getAcademicYears(oldestDate: Date | null, date = new Date()) {
  const currentStartYear = Number(getCurrentAcademicYear(date).slice(0, 4));
  const oldestStartYear = oldestDate
    ? Math.min(currentStartYear, Number(getCurrentAcademicYear(oldestDate).slice(0, 4)))
    : currentStartYear;
  return Array.from({ length: currentStartYear - oldestStartYear + 1 }, (_, offset) => {
    const startYear = currentStartYear - offset;
    return `${startYear}-${startYear + 1}`;
  });
}

export function getAcademicYearDateRange(academicYear: string) {
  const match = /^(\d{4})-(\d{4})$/.exec(academicYear);
  if (!match) return null;

  const startYear = Number(match[1]);
  const endYear = Number(match[2]);
  if (endYear !== startYear + 1) return null;

  return {
    start: new Date(startYear, 7, 1),
    end: new Date(endYear, 7, 1),
  };
}

export function getRecentSemesters(date = new Date()): RecentSemester[] {
  const year = date.getFullYear();
  const month = date.getMonth();

  const semesters = month >= 7
    ? [
        { name: `${year}-${year + 1} First Semester`, isCurrent: true },
        { name: `${year - 1}-${year} Second Semester`, isCurrent: false },
        { name: `${year - 1}-${year} First Semester`, isCurrent: false },
      ]
    : [
        { name: `${year - 1}-${year} Second Semester`, isCurrent: true },
        { name: `${year - 1}-${year} First Semester`, isCurrent: false },
        { name: `${year - 2}-${year - 1} Second Semester`, isCurrent: false },
      ];

  return semesters.map((semester) => ({
    ...semester,
    label: `${semester.name}${semester.isCurrent ? " (Current)" : ""}`,
  }));
}
