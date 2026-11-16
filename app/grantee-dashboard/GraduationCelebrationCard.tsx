"use client";

import { useEffect, useState } from "react";
import { Award, CalendarDays, FileCheck2, Sparkles } from "lucide-react";

export default function GraduationCelebrationCard({
  granteeId,
  fullName,
  graduatedAt,
  clearanceUrl,
}: {
  granteeId: string;
  fullName: string;
  graduatedAt: string | null;
  clearanceUrl: string | null;
}) {
  const [showConfetti, setShowConfetti] = useState(false);
  const firstName = fullName.trim().split(/\s+/)[0] || "Graduate";
  const graduationDate = graduatedAt
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "long",
        timeZone: "Asia/Manila",
      }).format(new Date(graduatedAt))
    : null;

  useEffect(() => {
    const key = `skeap-graduation-celebrated:${granteeId}`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "true");
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const frame = window.requestAnimationFrame(() => setShowConfetti(true));
    const timer = window.setTimeout(() => setShowConfetti(false), 1600);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [granteeId]);

  return (
    <section
      className="relative isolate overflow-hidden rounded-3xl border border-teal-500/30 bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 p-7 text-white shadow-lg sm:p-9"
      aria-labelledby="graduation-congratulations-title"
    >
      <div className="pointer-events-none absolute right-0 top-0 z-0 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl" aria-hidden="true" />
      <div className="pointer-events-none absolute bottom-0 left-1/4 z-0 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" aria-hidden="true" />

      {showConfetti ? (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-40 overflow-hidden" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <span className="graduation-confetti-piece" key={index} />
          ))}
        </div>
      ) : null}

      <div className="relative z-10">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden="true" />
          SKEAP Graduate · Exit Clearance Verified
        </span>
        <div className="mt-5 flex items-start gap-4">
          <div className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/20 bg-amber-300/10 text-amber-200 sm:flex">
            <Award className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 id="graduation-congratulations-title" className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Congratulations on your graduation, {firstName}!
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
              Your Exit Clearance has been verified by the SK Council of Barangay Pico. Congratulations on completing your academic journey—we’re proud of your achievement!
            </p>
            {graduationDate ? (
              <p className="mt-4 inline-flex items-center gap-2 text-xs font-medium text-slate-300">
                <CalendarDays className="h-4 w-4 text-emerald-300" aria-hidden="true" />
                Graduated {graduationDate}
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
          {clearanceUrl ? (
            <a
              href={clearanceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-300 px-4 py-2.5 text-sm font-semibold text-slate-950 shadow-sm transition-colors hover:bg-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
            >
              <FileCheck2 className="h-4 w-4" aria-hidden="true" />
              View Verified Clearance
            </a>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-xs font-medium text-slate-200">
              <FileCheck2 className="h-4 w-4 text-emerald-300" aria-hidden="true" />
              Clearance verified in person by the SK Council
            </span>
          )}
          <p className="text-xs text-slate-400">With pride, the SK Council of Barangay Pico</p>
        </div>
      </div>
    </section>
  );
}
