export type RecentSemester = {
  name: string;
  label: string;
  isCurrent: boolean;
};

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
