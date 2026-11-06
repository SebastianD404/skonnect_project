"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Circle, Settings, X } from "lucide-react";
import AcademicJourneyMap, { type AcademicJourneyMapProps } from "@/app/components/AcademicJourneyMap";
import {
  ACADEMIC_JOURNEY_END_OPTIONS,
  ACADEMIC_JOURNEY_START_OPTIONS,
  isValidAcademicJourneyRange,
} from "@/lib/academic-journey";

type MapProps = Omit<
  AcademicJourneyMapProps,
  "compact" | "journeyStart" | "journeyEnd" | "onConfigureJourney"
>;

export default function AcademicJourneySetup({
  journeyConfigured: initiallyConfigured,
  journeyStart: initialJourneyStart,
  journeyEnd: initialJourneyEnd,
  mapProps,
}: {
  journeyConfigured: boolean;
  journeyStart: string | null;
  journeyEnd: string | null;
  mapProps: MapProps;
}) {
  const [journeyStart, setJourneyStart] = useState(initialJourneyStart ?? "");
  const [journeyEnd, setJourneyEnd] = useState(initialJourneyEnd ?? "");
  const [draftStart, setDraftStart] = useState(initialJourneyStart ?? "");
  const [draftEnd, setDraftEnd] = useState(initialJourneyEnd ?? "");
  const [showDialog, setShowDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configured, setConfigured] = useState(initiallyConfigured);

  const availableEndOptions = useMemo(() => {
    return ACADEMIC_JOURNEY_END_OPTIONS.filter(({ value }) => {
      const [endTrack, endYearValue] = value.split("-");
      const startTrack = draftStart.split("-")[0];
      const startYear = Number(draftStart.split("-")[1]);
      return endTrack === "college" && (startTrack === "grade" || Number(endYearValue) >= startYear);
    });
  }, [draftStart]);

  const openDialog = () => {
    setError(null);
    setDraftStart(journeyStart);
    setDraftEnd(
      ACADEMIC_JOURNEY_END_OPTIONS.some(({ value }) => value === journeyEnd) ? journeyEnd : "",
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
      setConfigured(true);
      setShowDialog(false);
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
          {...mapProps}
          journeyStart={journeyStart}
          journeyEnd={journeyEnd}
          onConfigureJourney={openDialog}
        />
      ) : (
        <section className="relative flex min-h-[420px] flex-col items-center gap-10 overflow-hidden rounded-2xl border border-slate-100 bg-white p-8 shadow-[0_8px_32px_rgba(15,23,42,0.06)] lg:min-h-[390px] lg:flex-row lg:p-12">
          <div className="pointer-events-none absolute -right-20 -top-32 h-96 w-96 rounded-full bg-teal-50 opacity-70 blur-3xl" aria-hidden="true" />
          <div className="relative z-10 w-full text-left lg:w-1/2">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-100 bg-white/80 px-3 py-1.5">
              <Circle className="h-2 w-2 fill-amber-500 text-amber-500" aria-hidden="true" />
              <span className="text-xs font-bold tracking-wider text-slate-500">SETUP REQUIRED</span>
            </div>
            <h2 className="mt-5 text-4xl font-extrabold tracking-tight text-slate-900">
              Map your path to <span className="text-teal-600">graduation.</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-slate-500">
              Set your starting point and target graduation to unlock your personalized SKEAP milestone tracker.
            </p>
            <button
              type="button"
              onClick={openDialog}
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-6 py-3 font-medium text-white transition-all hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
            >
              <Settings className="h-4 w-4" aria-hidden="true" />
              Set Up Journey
            </button>
          </div>

          <div className="relative z-10 flex min-h-[250px] w-full items-center justify-center lg:w-1/2" aria-label="Preview of academic journey milestones">
            <div className="pointer-events-none absolute h-56 w-56 rounded-full bg-teal-100/70 blur-3xl" aria-hidden="true" />
            <div className="absolute left-[5%] top-[48%] w-[min(250px,78%)] -translate-y-1/2 -rotate-[3deg] rounded-2xl border border-slate-100 bg-white p-5 shadow-lg transition-transform duration-500 hover:scale-105 sm:left-[12%]">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed border-slate-300 bg-slate-50 text-[10px] font-semibold text-slate-400">
                  Y2
                </span>
                <div>
                  <p className="text-xs font-semibold text-slate-500">UP NEXT</p>
                  <p className="mt-0.5 text-sm font-medium text-slate-400">Y2 S1 milestone</p>
                </div>
              </div>
              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full w-1/3 rounded-full bg-slate-300" />
              </div>
            </div>
            <div className="absolute right-[3%] top-[44%] w-[min(270px,82%)] -translate-y-1/2 rotate-[2deg] rounded-2xl border border-slate-100 bg-white p-5 shadow-xl transition-transform duration-500 hover:scale-105 sm:right-[8%]">
              <div className="flex items-center gap-3">
                <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
                  <span className="absolute inset-0 animate-ping rounded-full bg-emerald-300/30" />
                  <span className="relative h-4 w-4 rounded-full border-4 border-white bg-emerald-500 shadow-sm" />
                </span>
                <div>
                  <p className="text-[10px] font-bold tracking-[0.16em] text-emerald-600">CURRENT STEP</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">Y1 S1</p>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <span className="text-xs font-medium text-slate-500">Your journey begins here</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
              </div>
            </div>
          </div>
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
                  <label className="block text-sm font-medium text-slate-700">
                    Starting Point
                    <span className="relative mt-1.5 block">
                      <select
                        value={draftStart}
                        onChange={(event) => {
                          setDraftStart(event.target.value);
                          setDraftEnd("");
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
                        {availableEndOptions.map(({ value, label }) => (
                          <option key={value} value={value}>{label}</option>
                        ))}
                      </select>
                      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                    </span>
                  </label>
                  {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
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
                    {isSaving ? "Saving..." : "Save Journey"}
                  </button>
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
