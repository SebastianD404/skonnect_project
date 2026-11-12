import Link from "next/link";
import { Check, ClipboardCheck, LockKeyhole } from "lucide-react";
import HomePageContent from "@/app/HomePageContent";

export default function YouthOnboardingGate() {
  return (
    <>
      <div
        aria-hidden="true"
        inert
        className="pointer-events-none select-none blur-md opacity-40"
      >
        <HomePageContent />
      </div>

      <main className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/40 px-4 py-8 backdrop-blur-sm sm:px-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="youth-onboarding-title"
          aria-describedby="youth-onboarding-description"
          className="my-auto w-full max-w-xl rounded-3xl border border-white/70 bg-white p-6 shadow-2xl sm:p-8"
        >
          <ol aria-label="Onboarding progress" className="grid grid-cols-3 items-start gap-2">
            <li className="flex flex-col items-center text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <Check className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="mt-2 text-xs font-semibold text-slate-700 sm:text-sm">Account Created</span>
              <span className="sr-only">Complete</span>
            </li>
            <li aria-current="step" className="flex flex-col items-center text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#0F3D5C] text-sm font-bold text-white">
                2
              </span>
              <span className="mt-2 text-xs font-semibold text-[#0F3D5C] sm:text-sm">KK Profiling</span>
              <span className="sr-only">Current step</span>
            </li>
            <li className="flex flex-col items-center text-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-slate-50 text-slate-400">
                <LockKeyhole className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="mt-2 text-xs font-semibold text-slate-500 sm:text-sm">SKEAP Access</span>
              <span className="sr-only">Locked</span>
            </li>
          </ol>

          <div className="mt-7 border-t border-slate-100 pt-7 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-[#0F3D5C]">
              <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
            </div>
            <p className="mt-4 text-xs font-bold uppercase tracking-[0.2em] text-sky-700">
              Step 2 of 3
            </p>
            <h1 id="youth-onboarding-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Complete your KK Profiling
            </h1>
            <p id="youth-onboarding-description" className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">
              Verify your Barangay Pico residency to unlock SKEAP scholarship applications and our AI Helpdesk.
            </p>
          </div>

          <ul className="mt-6 grid gap-3 text-left sm:grid-cols-3">
            <li className="rounded-xl bg-slate-50 px-3 py-3 text-xs font-medium leading-5 text-slate-700">
              SKEAP Scholarship Tracking
            </li>
            <li className="rounded-xl bg-slate-50 px-3 py-3 text-xs font-medium leading-5 text-slate-700">
              Multilingual AI Helpdesk
            </li>
            <li className="rounded-xl bg-slate-50 px-3 py-3 text-xs font-medium leading-5 text-slate-700">
              Verified Barangay Profile
            </li>
          </ul>

          <Link
            href="/programs/kk-profiling"
            className="mt-7 inline-flex w-full items-center justify-center rounded-xl bg-[#0F3D5C] px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#0F3D5C]/15 transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2"
          >
            Start KK Profiling
          </Link>
        </section>
      </main>
    </>
  );
}
