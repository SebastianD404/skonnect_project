"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ChevronDown, GraduationCap, LoaderCircle, X } from "lucide-react";
import AcademicJourneyMap, { type AcademicJourneyMapProps } from "@/app/components/AcademicJourneyMap";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import {
  ACADEMIC_JOURNEY_END_OPTIONS,
  ACADEMIC_JOURNEY_START_OPTIONS,
  getAcademicJourneyGraduationYear,
  getAcademicJourneyTermsForRange,
  isValidAcademicJourneyRange,
  type AcademicJourneyNode,
} from "@/lib/academic-journey";

type MapProps = Omit<
  AcademicJourneyMapProps,
  "compact" | "journeyStart" | "journeyEnd" | "onConfigureJourney"
>;

function formatYearsRemaining(semesterCount: number) {
  const years = semesterCount / 2;
  return Number.isInteger(years) ? `${years} ${years === 1 ? "year" : "years"}` : `${years} years`;
}

function getSuggestedJourneyStart(yearLevel: string) {
  const gradeMatch = /\bgrade\s*(7|8|9|10|11|12)\b/i.exec(yearLevel);
  if (gradeMatch) return `grade-${gradeMatch[1]}`;

  const normalizedYearLevel = yearLevel.trim().toLowerCase();
  if (/incoming freshman|new trainee/.test(normalizedYearLevel)) return "college-1";

  const numericYearMatch = /\b([1-6])(?:st|nd|rd|th)?\s+year\b/i.exec(yearLevel);
  const wordYearMatch = /\b(first|second|third|fourth|fifth|sixth)\s+year\b/i.exec(normalizedYearLevel);
  const wordYears: Record<string, number> = {
    first: 1,
    second: 2,
    third: 3,
    fourth: 4,
    fifth: 5,
    sixth: 6,
  };
  const year = numericYearMatch
    ? Number(numericYearMatch[1])
    : wordYearMatch
      ? wordYears[wordYearMatch[1]]
      : null;

  return year ? `college-${Math.min(year, 5)}` : "";
}

function getSuggestedJourneyEnd(start: string) {
  const collegeYear = /^college-(\d+)$/.exec(start);
  return collegeYear && Number(collegeYear[1]) >= 5 ? "college-5" : "college-4";
}

function getOptimisticMapProps(mapProps: MapProps, journeyStart: string, journeyEnd: string): MapProps {
  const nodes = mapProps.journeyNodes;
  const targetYear = getAcademicJourneyGraduationYear(journeyEnd);
  const configuredStartYear = Number(journeyStart.split("-")[1]);
  if (
    !nodes?.length ||
    targetYear === null ||
    !Number.isInteger(configuredStartYear)
  ) return mapProps;

  const firstEligibleIndex = nodes.findIndex((node) => node.status !== "PRE_GRANT");
  if (firstEligibleIndex < 0) return mapProps;
  const firstNode = nodes[firstEligibleIndex];
  const firstYear = firstNode.yearNumber ?? configuredStartYear;
  const firstSemester = firstNode.semesterNumber ?? 1;
  const eligibleCount = Math.max(1, (targetYear - firstYear) * 2 + 3 - firstSemester);
  const termMatch = /^(\d{4})-(\d{4})\s+(First|1st|Second|2nd)\s+Semester$/i.exec(firstNode.semester);
  if (!termMatch) return mapProps;
  const nextNodes: AcademicJourneyNode[] = nodes
    .slice(firstEligibleIndex, firstEligibleIndex + eligibleCount)
    .map((node, index) => {
      const offset = firstSemester - 1 + index;
      return {
        ...node,
        index: firstEligibleIndex + index,
        yearNumber: firstYear + Math.floor(offset / 2),
        semesterNumber: (offset % 2) + 1 as 1 | 2,
      };
    });

  const firstCalendarYear = Number(termMatch[1]);
  for (let index = nextNodes.length; index < eligibleCount; index += 1) {
    const offset = firstSemester - 1 + index;
    const semesterNumber = (offset % 2) + 1 as 1 | 2;
    const calendarYear = firstCalendarYear + Math.floor(offset / 2);
    const semesterName = semesterNumber === 1 ? "First" : "Second";
    const progressionYear = firstYear + Math.floor(offset / 2);
    nextNodes.push({
      index: firstEligibleIndex + index,
      semester: `${calendarYear}-${calendarYear + 1} ${semesterName} Semester`,
      yearNumber: progressionYear,
      semesterNumber,
      academicTermCaption: `${calendarYear}-${calendarYear + 1} · ${semesterNumber === 1 ? "1st" : "2nd"} Sem`,
      status: "LOCKED",
      submissionId: null,
      submittedAt: null,
      approvedAt: null,
      gwa: null,
      remarks: null,
      gradeReportUrl: null,
      coeFileUrl: null,
      isInitialGrant: false,
    });
  }

  const journeyNodes = [...nodes.slice(0, firstEligibleIndex), ...nextNodes];
  const currentSemesterIndex = Math.min(mapProps.currentSemesterIndex, journeyNodes.length);
  return {
    ...mapProps,
    currentSemesterIndex,
    eligibleSemesterCount: eligibleCount,
    journeyNodes,
    validatedSemesterIndexes: mapProps.validatedSemesterIndexes.filter((index) => index < journeyNodes.length),
  };
}

export default function AcademicJourneySetup({
  journeyConfigured: initiallyConfigured,
  journeyStart: initialJourneyStart,
  journeyEnd: initialJourneyEnd,
  yearLevel,
  entryAcademicYear,
  entrySemester,
  mapProps,
}: {
  journeyConfigured: boolean;
  journeyStart: string | null;
  journeyEnd: string | null;
  yearLevel: string;
  entryAcademicYear: string | null;
  entrySemester: string | null;
  mapProps: MapProps;
}) {
  const router = useRouter();
  const [journeyStart, setJourneyStart] = useState(initialJourneyStart ?? "");
  const [journeyEnd, setJourneyEnd] = useState(initialJourneyEnd ?? "");
  const [draftStart, setDraftStart] = useState(initialJourneyStart ?? "");
  const [draftEnd, setDraftEnd] = useState(initialJourneyEnd ?? "");
  const [showDialog, setShowDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(initiallyConfigured);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const suggestedStart = getSuggestedJourneyStart(yearLevel);
  const suggestedEntryTerm = [entryAcademicYear, entrySemester].filter(Boolean).join(" ");
  const [optimisticRange, setOptimisticRange] = useState<{
    start: string;
    end: string;
    previousStart: string | null;
    previousEnd: string | null;
  } | null>(null);

  const preview = useMemo(() => {
    if (!isValidAcademicJourneyRange(draftStart, draftEnd)) return null;
    const graduationYear = getAcademicJourneyGraduationYear(draftEnd);
    const startYear = Number(draftStart.split("-")[1]);
    const firstJourneyNode = mapProps.journeyNodes?.find((node) => node.status !== "PRE_GRANT");
    const firstSemester = firstJourneyNode?.semesterNumber ?? 1;
    const startingYear = firstJourneyNode?.yearNumber ?? startYear;
    const semesterCount = graduationYear === null || !draftStart.startsWith("college-")
      ? getAcademicJourneyTermsForRange(draftStart, draftEnd).length
      : Math.max(1, (graduationYear - startingYear) * 2 + 3 - firstSemester);

    return {
      semesterCount,
      yearsRemaining: formatYearsRemaining(semesterCount),
      endLabel: graduationYear === null ? "graduation" : `Y${graduationYear} 2nd Sem`,
    };
  }, [draftEnd, draftStart, mapProps.journeyNodes]);

  const hasUnreconciledOptimisticRange = Boolean(
    optimisticRange &&
    initialJourneyStart === optimisticRange.previousStart &&
    initialJourneyEnd === optimisticRange.previousEnd &&
    (initialJourneyStart !== optimisticRange.start || initialJourneyEnd !== optimisticRange.end),
  );
  const optimisticMapProps = optimisticRange && hasUnreconciledOptimisticRange
    ? getOptimisticMapProps(mapProps, optimisticRange.start, optimisticRange.end)
    : mapProps;

  const openDialog = () => {
    setError(null);
    const suggestedStartValue = journeyStart || suggestedStart;
    setDraftStart(suggestedStartValue);
    setDraftEnd(
      ACADEMIC_JOURNEY_END_OPTIONS.some(({ value }) => value === journeyEnd)
        ? journeyEnd
        : suggestedStartValue
          ? getSuggestedJourneyEnd(suggestedStartValue)
          : "",
    );
    setShowDialog(true);
  };

  const saveJourney = async () => {
    setError(null);
    if (!isValidAcademicJourneyRange(draftStart, draftEnd)) {
      setError("Choose a graduation target that follows your starting point.");
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch("/api/grantee/academic-journey", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ journeyStart: draftStart, journeyEnd: draftEnd }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error || "We couldn't save your journey. Please try again.");
        return;
      }
      if (typeof result.journeyStart !== "string" || typeof result.journeyEnd !== "string") {
        setError("We couldn't save your journey. Please try again.");
        return;
      }

      setJourneyStart(result.journeyStart);
      setJourneyEnd(result.journeyEnd);
      setOptimisticRange({
        start: result.journeyStart,
        end: result.journeyEnd,
        previousStart: initialJourneyStart,
        previousEnd: initialJourneyEnd,
      });
      setConfigured(true);
      setShowDialog(false);
      setSuccessMessage("Academic journey updated.");
      router.refresh();
    } catch {
      setError("We couldn't save your journey. Check your connection and try again.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {configured ? (
        <AcademicJourneyMap
          {...optimisticMapProps}
          journeyStart={journeyStart}
          journeyEnd={journeyEnd}
          onConfigureJourney={openDialog}
        />
      ) : (
        <section className="flex min-h-[360px] flex-col items-center justify-center rounded-2xl border border-slate-100 bg-white px-6 py-12 text-center shadow-[0_8px_32px_rgba(15,23,42,0.06)] sm:px-12">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-amber-50 text-teal-700 ring-1 ring-inset ring-teal-100">
            <GraduationCap className="h-8 w-8" aria-hidden="true" />
          </div>
          <h2 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
            Set Up Your Academic Journey
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
            Confirm your degree length and expected graduation term to generate your personalized semester-by-semester SKEAP compliance roadmap.
          </p>
          {yearLevel || suggestedEntryTerm ? (
            <p className="mt-3 text-xs text-slate-500">
              Suggested from your grantee record{yearLevel ? `: ${yearLevel}` : ""}
              {suggestedEntryTerm ? ` · Entry term ${suggestedEntryTerm}` : ""}
            </p>
          ) : null}
          <button
            type="button"
            onClick={openDialog}
            className="mt-7 inline-flex items-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
          >
            <GraduationCap className="h-4 w-4" aria-hidden="true" />
            Set Up Your Academic Journey
          </button>
        </section>
      )}

      {showDialog && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
              onMouseDown={(event) => {
                if (event.target === event.currentTarget && !isSaving) setShowDialog(false);
              }}
            >
              <section
                role="dialog"
                aria-modal="true"
                aria-labelledby="academic-journey-dialog-title"
                className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 id="academic-journey-dialog-title" className="text-lg font-semibold text-slate-900">
                      Configure Academic Journey
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Choose where your journey begins and when you expect to graduate.
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Close dialog"
                    disabled={isSaving}
                    onClick={() => setShowDialog(false)}
                    className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {yearLevel || suggestedEntryTerm ? (
                    <p className="rounded-xl border border-teal-100 bg-teal-50/60 px-3 py-2.5 text-xs leading-5 text-teal-900">
                      Suggested from your grantee record{yearLevel ? `: ${yearLevel}` : ""}
                      {suggestedEntryTerm ? ` · Entry term ${suggestedEntryTerm}` : ""}.
                      You can adjust these before saving.
                    </p>
                  ) : null}
                  <label className="block text-sm font-medium text-slate-700">
                    Starting Point
                    <span className="relative mt-1.5 block">
                      <select
                        value={draftStart}
                        onChange={(event) => {
                          const nextStart = event.target.value;
                          setDraftStart(nextStart);
                          setDraftEnd((currentEnd) => {
                            if (isValidAcademicJourneyRange(nextStart, currentEnd)) return currentEnd;
                            return ACADEMIC_JOURNEY_END_OPTIONS.find(({ value }) =>
                              isValidAcademicJourneyRange(nextStart, value),
                            )?.value ?? "";
                          });
                          setError(null);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/10"
                      >
                        <option value="">Select your starting point</option>
                        {ACADEMIC_JOURNEY_START_OPTIONS.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    </span>
                  </label>

                  <label className="block text-sm font-medium text-slate-700">
                    Target Graduation
                    <span className="relative mt-1.5 block">
                      <select
                        value={draftEnd}
                        disabled={!draftStart}
                        onChange={(event) => {
                          setDraftEnd(event.target.value);
                          setError(null);
                        }}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-10 text-sm text-slate-800 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/10 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
                      >
                        <option value="">Select your target graduation</option>
                        {ACADEMIC_JOURNEY_END_OPTIONS.map(({ value, label }) => (
                          <option
                            key={value}
                            value={value}
                            disabled={Boolean(draftStart) && !isValidAcademicJourneyRange(draftStart, value)}
                          >
                            {label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    </span>
                  </label>
                  {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
                  {preview ? (
                    <p className="rounded-xl border border-cyan-100 bg-cyan-50/70 px-3 py-2.5 text-xs text-cyan-900">
                      <span className="font-semibold">Timeline Preview:</span>{" "}
                      {preview.semesterCount} semesters ({preview.yearsRemaining}) through {preview.endLabel}.
                    </p>
                  ) : null}
                </div>

                <div className="mt-6 flex justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setShowDialog(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={isSaving || !draftStart || !draftEnd}
                    onClick={saveJourney}
                    className="rounded-xl bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0b3049] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isSaving ? <LoaderCircle className="mr-1.5 inline h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {isSaving ? "Saving..." : "Save Journey"}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
      {successMessage ? (
        <FloatingFeedback
          message={successMessage}
          type="success"
          onDismiss={() => setSuccessMessage(null)}
        />
      ) : null}
    </>
  );
}
