import { useMemo } from "react";

export type GranteeTimelineYear = {
  // start year of the academic year, e.g. 2025 for 2025-2026
  startYear: number;
  // number of terms in that academic year (commonly 2 or 3)
  terms: number;
  // optional flag set by grantee to mark which is the current academic year
  isCurrent?: boolean;
};

export type GranteeTimeline = {
  years: GranteeTimelineYear[];
  // optional explicit current academic year start. If provided it takes precedence.
  currentYearStart?: number;
};

export type AcademicTerm = {
  value: string; // stable unique value e.g. "2025-2026-1st" or "2025-2026-summer"
  label: string; // human-readable label e.g. "2025-2026 First Semester"
  startYear: number; // numeric start year
  termIndex: number; // 1-based index within the academic year
  termsInYear: number; // copy of terms for the academic year
};

function academicYearLabel(startYear: number) {
  return `${startYear}-${startYear + 1}`;
}

function termLabelForIndex(termsInYear: number, index: number) {
  // index is 1-based
  if (termsInYear === 2) {
    return index === 1 ? "First Semester" : "Second Semester";
  }
  if (termsInYear === 3) {
    if (index === 1) return "First Semester";
    if (index === 2) return "Second Semester";
    return "Summer Term";
  }
  // fallback generic naming
  return `Term ${index}`;
}

function termValueSuffix(termsInYear: number, index: number) {
  if (termsInYear === 3 && index === 3) return "summer";
  // ordinal suffix for numeric terms
  const n = index;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n}st`;
  if (mod10 === 2 && mod100 !== 12) return `${n}nd`;
  if (mod10 === 3 && mod100 !== 13) return `${n}rd`;
  return `${n}th`;
}

/**
 * Generate a chronological list of academic terms according to the grantee's timeline.
 *
 * Rules implemented:
 * - Use the provided `years` entries (each with startYear and terms count).
 * - Include all past years present in the timeline, the current academic year, and the immediate next academic year.
 * - If the immediate next academic year is not present in `years`, it is generated using the same `terms` count as the current year.
 * - Each term has a stable `value` and a readable `label` and terms are sorted ascending (oldest first) by startYear then term index.
 *
 * Input shape Example:
 * {
 *   years: [ { startYear: 2022, terms: 3 }, { startYear: 2023, terms: 2, isCurrent: true } ],
 *   currentYearStart?: 2023 // optional override
 * }
 */
export function generateAcademicTerms(timeline: GranteeTimeline): AcademicTerm[] {
  if (!timeline || !Array.isArray(timeline.years)) return [];

  // normalize and dedupe years by startYear
  const map = new Map<number, GranteeTimelineYear>();
  for (const y of timeline.years) {
    if (!y || typeof y.startYear !== "number" || typeof y.terms !== "number") continue;
    map.set(y.startYear, { startYear: y.startYear, terms: Math.max(1, Math.floor(y.terms)), isCurrent: !!y.isCurrent });
  }

  if (map.size === 0) return [];

  const years = Array.from(map.values()).sort((a, b) => a.startYear - b.startYear);

  // determine current startYear
  let currentStart: number | undefined = timeline.currentYearStart;
  if (!currentStart) {
    const flagged = years.find((y) => y.isCurrent);
    if (flagged) currentStart = flagged.startYear;
  }
  // fallback heuristic: choose the latest startYear not greater than the current calendar year
  if (!currentStart) {
    const now = new Date();
    const thisYear = now.getFullYear();
    // pick largest startYear <= thisYear, else fall back to last known year
    const candidates = years.filter((y) => y.startYear <= thisYear);
    if (candidates.length > 0) currentStart = candidates[candidates.length - 1].startYear;
    else currentStart = years[years.length - 1].startYear;
  }

  // ensure currentStart corresponds to an entry in years
  let currentYearEntry = years.find((y) => y.startYear === currentStart);
  if (!currentYearEntry) {
    // pick nearest earlier year or the last one
    currentYearEntry = years[years.length - 1];
    currentStart = currentYearEntry.startYear;
  }

  const nextStart = currentStart + 1;

  // ensure next year is present; if not, create it using same terms as current
  if (!map.has(nextStart)) {
    map.set(nextStart, { startYear: nextStart, terms: currentYearEntry.terms });
  }

  // rebuild sorted years to include added next year
  const finalYears = Array.from(map.values()).sort((a, b) => a.startYear - b.startYear);

  // Build terms list: include all years <= nextStart (i.e., all pasts, current, and next) but keep any earlier years as well
  // The requirement says: show all past terms, the current academic year, plus the immediate next academic year.
  // We'll include all years up through nextStart and also keep any earlier years present in the timeline (they are "past").
  const includedYears = finalYears.filter((y) => y.startYear <= nextStart);

  const terms: AcademicTerm[] = [];
  for (const y of includedYears) {
    const yearLabel = academicYearLabel(y.startYear);
    for (let idx = 1; idx <= y.terms; idx++) {
      const label = `${yearLabel} ${termLabelForIndex(y.terms, idx)}`;
      const suffix = termValueSuffix(y.terms, idx);
      const value = `${y.startYear}-${y.startYear + 1}-${suffix}`;
      terms.push({ value, label, startYear: y.startYear, termIndex: idx, termsInYear: y.terms });
    }
  }

  // sort ascending chronological: oldest first
  terms.sort((a, b) => {
    if (a.startYear !== b.startYear) return a.startYear - b.startYear;
    return a.termIndex - b.termIndex;
  });

  return terms;
}

/**
 * React hook wrapper returning a memoized array of academic terms.
 * Use this inside client components to compute dropdown options.
 */
export function useAcademicTerms(timeline: GranteeTimeline) {
  return useMemo(() => generateAcademicTerms(timeline), [timeline]);
}
