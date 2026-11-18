import { getCurrentAcademicSemester } from "./semester-progress";

export const ACADEMIC_JOURNEY_START_OPTIONS = [
  { value: "grade-7", label: "Grade 7" },
  { value: "grade-8", label: "Grade 8" },
  { value: "grade-9", label: "Grade 9" },
  { value: "grade-10", label: "Grade 10" },
  { value: "grade-11", label: "Grade 11" },
  { value: "grade-12", label: "Grade 12" },
  { value: "college-1", label: "1st Year College" },
  { value: "college-2", label: "2nd Year College" },
  { value: "college-3", label: "3rd Year College" },
  { value: "college-4", label: "4th Year College" },
  { value: "college-5", label: "5th Year College" },
] as const;

export const ACADEMIC_JOURNEY_END_OPTIONS = [
  { value: "college-4", label: "4th Year College" },
  { value: "college-5", label: "5th Year College" },
] as const;

type JourneyPoint = {
  track: "grade" | "college";
  year: number;
};

function parseJourneyPoint(value: string): JourneyPoint | null {
  const match = /^(grade|college)-(\d+)$/.exec(value);
  if (!match) return null;
  const year = Number(match[2]);
  if (!Number.isInteger(year)) return null;
  if (match[1] === "grade" && year >= 7 && year <= 12) return { track: "grade", year };
  if (match[1] === "college" && year >= 1 && year <= 5) return { track: "college", year };
  return null;
}

export function isValidAcademicJourneyRange(start: string, end: string) {
  const startPoint = parseJourneyPoint(start);
  const endPoint = parseJourneyPoint(end);
  return Boolean(
    startPoint &&
    endPoint &&
    endPoint.track === "college" &&
    (startPoint.track === "grade" || startPoint.year <= endPoint.year),
  );
}

export function getAcademicJourneyGraduationYear(end: string) {
  const endPoint = parseJourneyPoint(end);
  return endPoint?.track === "college" ? endPoint.year : null;
}

export function getAcademicJourneyLabels(start: string, end: string) {
  return getAcademicJourneyTermsForRange(start, end).map((term) => term.label);
}

export function getAcademicJourneyTermsForRange(start: string, end: string) {
  const startPoint = parseJourneyPoint(start);
  const endPoint = parseJourneyPoint(end);
  const isLegacyGradeTarget = Boolean(
    startPoint &&
    endPoint &&
    startPoint.track === "grade" &&
    endPoint.track === "grade" &&
    endPoint.year === 12 &&
    startPoint.year <= endPoint.year,
  );
  if (!startPoint || !endPoint || (!isValidAcademicJourneyRange(start, end) && !isLegacyGradeTarget)) {
    throw new Error("Choose a valid starting point and graduation target.");
  }

  const startStage = startPoint.track === "grade" ? startPoint.year : 12 + startPoint.year;
  const endStage = endPoint.track === "grade" ? endPoint.year : 12 + endPoint.year;
  const yearOrdinal = (year: number) =>
    `${year}${year === 1 ? "st" : year === 2 ? "nd" : year === 3 ? "rd" : "th"}`;

  return Array.from({ length: (endStage - startStage + 1) * 2 }, (_, index) => {
    const stage = startStage + Math.floor(index / 2);
    const semester = (index % 2) + 1;
    const label = stage <= 12 ? `G${stage} S${semester}` : `Y${stage - 12} S${semester}`;
    const year = stage <= 12 ? `Grade ${stage}` : `${yearOrdinal(stage - 12)} Year`;
    return {
      label,
      year,
      semester: `${semester}${semester === 1 ? "st" : "nd"} Sem`,
    };
  });
}

export type AcademicJourneySubmission = {
  id?: string;
  semester: string;
  status: string;
  submittedAt?: Date | string;
  reviewedAt?: Date | string | null;
  generalAverage?: number | null;
  ocrGwa?: number | null;
  reviewNotes?: string | null;
  gradeFileUrl?: string | null;
  coeFileUrl?: string | null;
};

export type AcademicJourneyNodeStatus =
  | "VALIDATED"
  | "PENDING"
  | "UNDER_REVIEW"
  | "RETURNED"
  | "PRE_GRANT"
  | "CURRENT"
  | "LOCKED";

export type AcademicJourneyInitialGrant = {
  semester: string;
  gwa?: number | null;
  gradeReportUrl?: string | null;
  coeFileUrl?: string | null;
};

export type AcademicJourneyNode = {
  index: number;
  semester: string;
  yearNumber?: number | null;
  semesterNumber?: 1 | 2 | null;
  academicTermCaption?: string | null;
  scheduleStatus?: "open" | "future" | "closed" | "none" | null;
  scheduleOpensAt?: Date | string | null;
  status: AcademicJourneyNodeStatus;
  submissionId: string | null;
  submittedAt: Date | string | null;
  approvedAt: Date | string | null;
  gwa: number | null;
  remarks: string | null;
  gradeReportUrl: string | null;
  coeFileUrl: string | null;
  isInitialGrant: boolean;
};

function getJourneyStage(value: string | null | undefined) {
  if (!value) return null;
  const configuredPoint = parseJourneyPoint(value);
  if (configuredPoint) {
    return configuredPoint.track === "grade"
      ? configuredPoint.year
      : 12 + configuredPoint.year;
  }

  const gradeMatch = /\bgrade\s*(7|8|9|10|11|12)\b/i.exec(value);
  if (gradeMatch) return Number(gradeMatch[1]);
  const collegeMatch = /\b(?:incoming freshman|([1-6])(?:st|nd|rd|th)?\s+year|first year|second year|third year|fourth year|fifth year|sixth year)\b/i.exec(value);
  if (!collegeMatch) return null;
  const wordYear = /\b(first|second|third|fourth|fifth|sixth) year\b/i.exec(value)?.[1]?.toLowerCase();
  const year = collegeMatch[1]
    ? Number(collegeMatch[1])
    : value.toLowerCase().includes("incoming freshman")
      ? 1
      : ({ first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6 } as const)[wordYear as "first" | "second" | "third" | "fourth" | "fifth" | "sixth"];
  return year ? 12 + year : null;
}

export type AcademicJourneyStepStatus =
  | "locked"
  | "scheduled_locked"
  | "open_for_submit"
  | "under_review"
  | "action_required"
  | "validated";

export function normalizeAcademicJourneyStepStatus(status: unknown): AcademicJourneyStepStatus {
  switch (status) {
    case "locked":
    case "scheduled_locked":
    case "open_for_submit":
    case "under_review":
    case "action_required":
    case "validated":
      return status;
    case "LOCKED":
      return "locked";
    case "pending_submission":
    case "pending_docs":
      return "open_for_submit";
    case "approved":
      return "validated";
    case "RETURNED":
    case "REJECTED":
    case "RETURNED_FOR_EDIT":
      return "action_required";
    case "PENDING":
    case "PRE_QUALIFIED":
    case "UNDER_REVIEW":
      return "under_review";
    default:
      return "scheduled_locked";
  }
}

export function resolveScheduledJourneyStepStatus(
  status: AcademicJourneyStepStatus,
  schedule: { opensAt: Date; closesAt: Date } | null,
  now = new Date(),
): AcademicJourneyStepStatus {
  if (status !== "open_for_submit") {
    return status;
  }

  if (!schedule || now < schedule.opensAt || now > schedule.closesAt) {
    return "scheduled_locked";
  }

  return "open_for_submit";
}

function getSemesterOrder(semester: string) {
  const match = semester.match(/^(\d{4})-(\d{4})\s+(First|1st|Second|2nd)\s+Semester$/i);
  if (!match || Number(match[2]) !== Number(match[1]) + 1) return null;

  const second = /^second|^2nd/i.test(match[3]);
  return Number(match[1]) * 2 + (second ? 1 : 0);
}

function normalizeJourneySemester(semester: string) {
  const order = getSemesterOrder(semester);
  return order === null ? null : getSemesterLabel(order);
}

export function normalizeAcademicJourneyTerm(semester: string) {
  return normalizeJourneySemester(semester);
}

function parseStartYear(yearLevel: string | null | undefined) {
  if (!yearLevel) return null;
  const match = /\b(Incoming Freshman|[1-6](?:st|nd|rd|th)?\s+Year|Grade\s*(?:11|12)|(?:First|Second|Third|Fourth|Fifth|Sixth)\s+Year)\b/i.exec(yearLevel);
  if (!match) return null;
  const value = match[1];
  if (/incoming freshman|first year/i.test(value)) return 1;
  if (/second year/i.test(value)) return 2;
  if (/third year/i.test(value)) return 3;
  if (/fourth year/i.test(value)) return 4;
  if (/fifth year/i.test(value)) return 5;
  if (/sixth year/i.test(value)) return 6;
  const numeric = /^(\d)/.exec(value);
  if (numeric) return Number(numeric[1]);
  const grade = /Grade\s*(11|12)/i.exec(value);
  if (grade) return Number(grade[1]) - 10;
  return null;
}

export function getAcademicJourneyProgress(
  submissions: AcademicJourneySubmission[],
  dateEnrolled: Date,
  now = new Date(),
  totalYears = 4,
  initialGrant?: AcademicJourneyInitialGrant | null,
  entrySemester?: string,
  yearLevel?: string | null,
  journeyStart?: string | null,
) {
  const years = Number.isFinite(totalYears) ? Math.max(1, Math.floor(totalYears)) : 4;
  const intakeTerm = normalizeJourneySemester(entrySemester?.trim() ?? "");
  const intakeOrder = intakeTerm ? getSemesterOrder(intakeTerm) : null;
  const configuredStartPoint = journeyStart ? parseJourneyPoint(journeyStart) : null;
  const startYear = parseStartYear(yearLevel) ??
    (configuredStartPoint?.track === "college" ? configuredStartPoint.year : null);

  if (intakeOrder !== null && startYear !== null) {
    const entryStartYear = Math.floor(intakeOrder / 2);
    const terminalStartYear = entryStartYear + Math.max(0, years - startYear);
    const terminalOrder = terminalStartYear * 2 + 1;
    const nodes: AcademicJourneyNode[] = [];
    const submissionsByOrder = new Map<number, AcademicJourneySubmission>();

    for (const submission of submissions) {
      const normalizedSemester = normalizeJourneySemester(submission.semester);
      if (!normalizedSemester) continue;
      const order = getSemesterOrder(normalizedSemester);
      if (order === null || order < intakeOrder || order > terminalOrder) continue;
      const previous = submissionsByOrder.get(order);
      const submittedAt = submission.submittedAt ? new Date(submission.submittedAt).getTime() : 0;
      const previousSubmittedAt = previous?.submittedAt ? new Date(previous.submittedAt).getTime() : 0;
      if (!previous || submittedAt >= previousSubmittedAt) submissionsByOrder.set(order, submission);
    }

    for (let order = intakeOrder; order <= terminalOrder; order += 1) {
      const index = nodes.length;
      const normalizedSemester = getSemesterLabel(order);
      const submission = submissionsByOrder.get(order) ?? null;
      const isInitialGrant =
        !submission &&
        Boolean(initialGrant?.semester && normalizeJourneySemester(initialGrant.semester) === normalizedSemester);
      let status: AcademicJourneyNodeStatus;

      if (submission?.status === "APPROVED") {
        status = "VALIDATED";
      } else if (submission?.status === "PENDING") {
        status = "PENDING";
      } else if (submission?.status === "PRE_QUALIFIED" || submission?.status === "AWAITING_PHYSICAL_CTC") {
        status = "UNDER_REVIEW";
      } else if (submission?.status === "RETURNED_FOR_EDIT" || submission?.status === "REJECTED") {
        status = "RETURNED";
      } else {
        const previousValidated = index === 0
          ? false
          : nodes[index - 1].status === "VALIDATED";
        status = index === 0 || previousValidated ? "CURRENT" : "LOCKED";
      }

      const yearNumber = Math.floor(order / 2) - entryStartYear + startYear;
      const semesterNumber = (order % 2 === 0 ? 1 : 2) as 1 | 2;
      const academicYearStart = Math.floor(order / 2);
      nodes.push({
        index,
        semester: normalizedSemester,
        yearNumber,
        semesterNumber,
        academicTermCaption: `${academicYearStart}-${academicYearStart + 1} · ${semesterNumber === 1 ? "1st" : "2nd"} Sem`,
        scheduleStatus: null,
        scheduleOpensAt: null,
        status,
        submissionId: submission?.id ?? null,
        submittedAt: submission?.submittedAt ?? null,
        approvedAt: submission?.status === "APPROVED" ? submission.reviewedAt ?? null : null,
        gwa: submission?.generalAverage ??
          submission?.ocrGwa ??
          (isInitialGrant ? initialGrant?.gwa : null) ??
          null,
        remarks: submission?.reviewNotes ?? null,
        gradeReportUrl:
          submission?.gradeFileUrl ??
          (isInitialGrant ? initialGrant?.gradeReportUrl : null) ??
          null,
        coeFileUrl:
          submission?.coeFileUrl ??
          (isInitialGrant ? initialGrant?.coeFileUrl : null) ??
          null,
        isInitialGrant,
      });
    }

    const currentIndex = nodes.findIndex((node) =>
      node.status === "CURRENT" ||
      node.status === "PENDING" ||
      node.status === "UNDER_REVIEW" ||
      node.status === "RETURNED"
    );
    const activeIndex = currentIndex < 0 ? nodes.length : currentIndex;
    const currentNode = nodes[activeIndex];
    const validatedSemesterIndexes = nodes
      .filter((node) => node.status === "VALIDATED")
      .map((node) => node.index);

    return {
      currentSemesterIndex: activeIndex,
      currentStepSemester: currentNode?.semester ?? nodes[nodes.length - 1]?.semester ?? intakeTerm,
      validatedSemesterIndexes,
      currentStepStatus: !currentNode || currentNode.status === "VALIDATED"
        ? "validated" as const
        : currentNode.status === "PENDING" || currentNode.status === "UNDER_REVIEW"
          ? "under_review" as const
          : currentNode.status === "RETURNED"
            ? "action_required" as const
            : "open_for_submit" as const,
      nodes,
      eligibleSemesterCount: nodes.length,
      calendarSemesterIndex: 0,
    };
  }

  const startStage = getJourneyStage(journeyStart);
  const journeyStartStage = startStage ?? 13;
  const termCount = years * 2;
  const startOrder = getSemesterOrder(entrySemester ?? getCurrentAcademicSemester(dateEnrolled));
  const calendarOrder = getSemesterOrder(getCurrentAcademicSemester(now));
  const currentEducationStage = getJourneyStage(yearLevel) ?? journeyStartStage;
  const entrySemesterOffset = entrySemester?.toLowerCase().includes("second semester") ? 1 : 0;
  const preGrantCount = Math.max(
    0,
    Math.min(
      termCount,
      (currentEducationStage - journeyStartStage) * 2 + entrySemesterOffset,
    ),
  );
  const journeyStartOrder = startOrder === null ? null : startOrder - preGrantCount;

  if (startOrder === null || calendarOrder === null || journeyStartOrder === null) {
    throw new Error("Unable to determine academic journey semester order.");
  }

  const submissionsByOrder = new Map<number, AcademicJourneySubmission>();
  for (const submission of submissions) {
    const order = getSemesterOrder(submission.semester.trim());
    if (order === null || order < startOrder || order >= journeyStartOrder + termCount) continue;

    const previous = submissionsByOrder.get(order);
    const submittedAt = submission.submittedAt
      ? new Date(submission.submittedAt).getTime()
      : 0;
    const previousSubmittedAt = previous?.submittedAt
      ? new Date(previous.submittedAt).getTime()
      : 0;
    if (!previous || submittedAt >= previousSubmittedAt) submissionsByOrder.set(order, submission);
  }

  const nodes: AcademicJourneyNode[] = [];
  for (let index = 0; index < termCount; index += 1) {
    const nodeOrder = journeyStartOrder + index;
    const semester = getSemesterLabel(nodeOrder);
    const isPreGrant = index < preGrantCount;
    const submission = isPreGrant ? null : submissionsByOrder.get(nodeOrder) ?? null;
    const isInitialGrant =
      index === preGrantCount &&
      !submission &&
      Boolean(initialGrant?.semester === semester);
    let status: AcademicJourneyNodeStatus;

    if (isPreGrant) {
      status = "PRE_GRANT";
    } else if (submission?.status === "APPROVED") {
      status = "VALIDATED";
    } else if (submission?.status === "PENDING") {
      status = "PENDING";
    } else if (
      submission?.status === "PRE_QUALIFIED" ||
      submission?.status === "AWAITING_PHYSICAL_CTC"
    ) {
      status = "UNDER_REVIEW";
    } else if (
      submission?.status === "RETURNED_FOR_EDIT" ||
      submission?.status === "REJECTED"
    ) {
      status = "RETURNED";
    } else if (
      index === preGrantCount ||
      nodes[index - 1]?.status === "VALIDATED"
    ) {
      status = "CURRENT";
    } else {
      status = "LOCKED";
    }

    nodes.push({
      index,
      semester,
      status,
      submissionId: submission?.id ?? null,
      submittedAt: submission?.submittedAt ?? null,
      approvedAt: submission?.status === "APPROVED" ? submission.reviewedAt ?? null : null,
      gwa: submission?.generalAverage ??
        submission?.ocrGwa ??
        (isInitialGrant ? initialGrant?.gwa : null) ??
        null,
      remarks: submission?.reviewNotes ?? null,
      gradeReportUrl:
        submission?.gradeFileUrl ??
        (isInitialGrant ? initialGrant?.gradeReportUrl : null) ??
        null,
      coeFileUrl:
        submission?.coeFileUrl ??
        (isInitialGrant ? initialGrant?.coeFileUrl : null) ??
        null,
      isInitialGrant,
    });
  }

  const currentIndex = nodes.findIndex((node) =>
    node.status === "CURRENT" ||
    node.status === "PENDING" ||
    node.status === "UNDER_REVIEW" ||
    node.status === "RETURNED"
  );
  const activeIndex = currentIndex < 0 ? termCount : currentIndex;
  const currentNode = nodes[activeIndex];
  const validatedSemesterIndexes = nodes
    .filter((node) => node.status === "VALIDATED")
    .map((node) => node.index);

  return {
    currentSemesterIndex: activeIndex,
    currentStepSemester: currentNode?.semester ?? getSemesterLabel(startOrder + termCount - 1),
    validatedSemesterIndexes,
    currentStepStatus: !currentNode || currentNode.status === "VALIDATED"
      ? "validated" as const
      : currentNode.status === "PENDING" || currentNode.status === "UNDER_REVIEW"
        ? "under_review" as const
        : currentNode.status === "RETURNED"
          ? "action_required" as const
          : "open_for_submit" as const,
    nodes,
    eligibleSemesterCount: termCount - preGrantCount,
    calendarSemesterIndex: Math.max(0, Math.min(calendarOrder - journeyStartOrder, termCount)),
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
