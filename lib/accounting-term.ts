export type AccountingTermSchedule = {
  semester: string;
  opensAt: Date | string;
  closesAt: Date | string;
};

export type AccountingTermOption = {
  name: string;
  label: string;
  isCurrent: boolean;
};

type ParsedAccountingTerm = {
  academicYear: string;
  semester: "First Semester" | "Second Semester";
  order: number;
};

function stripCurrentSuffix(value: string) {
  return value.replace(/\s*\(current\)$/i, "").trim().replace(/\s+/g, " ");
}

export function normalizeAccountingSemester(value: string | null | undefined) {
  const cleaned = stripCurrentSuffix(String(value ?? ""));
  if (/^(?:first|1st)\s+semester$/i.test(cleaned)) return "First Semester";
  if (/^(?:second|2nd)\s+semester$/i.test(cleaned)) return "Second Semester";
  return cleaned.toLocaleLowerCase();
}

function parseAccountingTerm(value: string | null | undefined): ParsedAccountingTerm | null {
  const cleaned = stripCurrentSuffix(String(value ?? ""));
  const patterns = [
    /^(\d{4})\s*-\s*(\d{4})\s+((?:first|1st|second|2nd)\s+semester)$/i,
    /^((?:first|1st|second|2nd)\s+semester)\s+(\d{4})\s*-\s*(\d{4})$/i,
  ];

  for (const [patternIndex, pattern] of patterns.entries()) {
    const match = pattern.exec(cleaned);
    if (!match) continue;

    const startYear = Number(patternIndex === 0 ? match[1] : match[2]);
    const endYear = Number(patternIndex === 0 ? match[2] : match[3]);
    const semesterValue = patternIndex === 0 ? match[3] : match[1];
    if (endYear !== startYear + 1) return null;

    const semester = /^(?:first|1st)/i.test(semesterValue)
      ? "First Semester"
      : "Second Semester";
    return {
      academicYear: `${startYear}-${endYear}`,
      semester,
      order: startYear * 2 + (semester === "Second Semester" ? 1 : 0),
    };
  }

  return null;
}

export function normalizeAccountingTerm(value: string | null | undefined) {
  const parsed = parseAccountingTerm(value);
  if (parsed) return `${parsed.academicYear} ${parsed.semester}`;
  const cleaned = stripCurrentSuffix(String(value ?? ""));
  return cleaned
    .replace(/\b1st\s+semester\b/gi, "First Semester")
    .replace(/\b2nd\s+semester\b/gi, "Second Semester")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase();
}

export function normalizeAccountingTermParts(
  academicYear: string | null | undefined,
  semester: string | null | undefined,
) {
  const year = String(academicYear ?? "").trim().replace(/\s+/g, "");
  const normalizedSemester = normalizeAccountingSemester(semester);
  if (!/^\d{4}-\d{4}$/.test(year) || !["First Semester", "Second Semester"].includes(normalizedSemester)) {
    return null;
  }
  const parsed = parseAccountingTerm(`${year} ${normalizedSemester}`);
  return parsed ? `${parsed.academicYear} ${parsed.semester}` : null;
}

export function accountingTermsMatch(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const normalizedLeft = normalizeAccountingTerm(left);
  const normalizedRight = normalizeAccountingTerm(right);
  return Boolean(normalizedLeft && normalizedRight && normalizedLeft === normalizedRight);
}

export function compareAccountingTerms(
  left: string | null | undefined,
  right: string | null | undefined,
) {
  const parsedLeft = parseAccountingTerm(left);
  const parsedRight = parseAccountingTerm(right);
  if (!parsedLeft || !parsedRight) return null;
  return parsedLeft.order - parsedRight.order;
}

function asDate(value: Date | string) {
  return value instanceof Date ? value : new Date(value);
}

export function accountingTermForDate(
  schedules: AccountingTermSchedule[],
  date: Date,
) {
  const matchingSchedule = schedules
    .filter((schedule) => {
      const opensAt = asDate(schedule.opensAt).getTime();
      const closesAt = asDate(schedule.closesAt).getTime();
      return opensAt <= date.getTime() && date.getTime() <= closesAt;
    })
    .sort((left, right) => asDate(right.opensAt).getTime() - asDate(left.opensAt).getTime())[0];

  if (matchingSchedule) return normalizeAccountingTerm(matchingSchedule.semester);

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  if (!Number.isInteger(year) || !Number.isInteger(month)) return null;

  if (month >= 6 && month <= 10) return `${year}-${year + 1} First Semester`;
  if (month >= 11) return `${year}-${year + 1} Second Semester`;
  return `${year - 1}-${year} Second Semester`;
}

export function getAccountingTermOptions(
  schedules: AccountingTermSchedule[],
  now = new Date(),
): AccountingTermOption[] {
  const uniqueSchedules = new Map<string, { schedule: AccountingTermSchedule; term: ParsedAccountingTerm }>();
  const nowTimestamp = now.getTime();
  const schedulePriority = (schedule: AccountingTermSchedule) => {
    const opensAt = asDate(schedule.opensAt).getTime();
    const closesAt = asDate(schedule.closesAt).getTime();
    return opensAt <= nowTimestamp && nowTimestamp <= closesAt
      ? 0
      : opensAt <= nowTimestamp
        ? 1
        : 2;
  };
  for (const schedule of schedules) {
    const term = parseAccountingTerm(schedule.semester);
    if (!term) continue;

    const key = `${term.academicYear} ${term.semester}`;
    const current = uniqueSchedules.get(key);
    const nextPriority = schedulePriority(schedule);
    const currentPriority = current ? schedulePriority(current.schedule) : Number.POSITIVE_INFINITY;
    const nextOpensAt = asDate(schedule.opensAt).getTime();
    const currentOpensAt = current ? asDate(current.schedule.opensAt).getTime() : 0;
    if (
      !current ||
      nextPriority < currentPriority ||
      (nextPriority === currentPriority &&
        (nextPriority === 2 ? nextOpensAt < currentOpensAt : nextOpensAt > currentOpensAt))
    ) {
      uniqueSchedules.set(key, { schedule, term });
    }
  }

  const terms = [...uniqueSchedules.values()];
  const sortByOpensAtAscending = (
    left: (typeof terms)[number],
    right: (typeof terms)[number],
  ) => asDate(left.schedule.opensAt).getTime() - asDate(right.schedule.opensAt).getTime();
  const futureTerms = terms
    .filter(({ schedule }) => asDate(schedule.opensAt).getTime() > nowTimestamp)
    .sort(sortByOpensAtAscending);
  const pastTerms = terms
    .filter(({ schedule }) => asDate(schedule.opensAt).getTime() <= nowTimestamp)
    .sort((left, right) => sortByOpensAtAscending(right, left));
  const currentlyOpen = terms
    .filter(({ schedule }) => (
      asDate(schedule.opensAt).getTime() <= nowTimestamp &&
      nowTimestamp <= asDate(schedule.closesAt).getTime()
    ))
    .sort((left, right) => sortByOpensAtAscending(right, left))[0];
  const currentTerm = currentlyOpen ?? pastTerms[0];
  const nextTerm = futureTerms[0];
  const orderedTerms = [
    ...(currentTerm ? [currentTerm] : []),
    ...(nextTerm ? [nextTerm] : []),
    ...futureTerms.slice(1),
    ...pastTerms.filter((term) => term !== currentTerm),
  ];
  const currentName = currentTerm
    ? `${currentTerm.term.academicYear} ${currentTerm.term.semester}`
    : null;
  const nextName = nextTerm
    ? `${nextTerm.term.academicYear} ${nextTerm.term.semester}`
    : null;

  return orderedTerms.map(({ schedule, term }) => {
    const name = `${term.academicYear} ${term.semester}`;
    const isCurrent = name === currentName;
    const isNext = name === nextName;
    const isFuture = asDate(schedule.opensAt).getTime() > nowTimestamp;
    const labelSuffix = isCurrent
      ? " (Current)"
      : isNext
        ? " (Next)"
        : isFuture
          ? " (Scheduled)"
          : "";
    return { name, label: `${name}${labelSuffix}`, isCurrent };
  });
}
