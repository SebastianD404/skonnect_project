import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";

export default function YouthOnboardingCallout() {
  return (
    <aside className="mx-auto mt-6 w-full max-w-7xl px-4 sm:px-6 lg:px-8">
      <section
        aria-labelledby="kk-onboarding-title"
        className="flex flex-col gap-5 rounded-2xl border border-sky-200 bg-gradient-to-r from-sky-50 via-white to-cyan-50 p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div className="flex items-start gap-4">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F3D5C] text-white">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 id="kk-onboarding-title" className="text-lg font-semibold text-slate-950">
              Complete your one-time KK Profile
            </h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">
              Your Katipunan ng Kabataan (KK) Profile is required to verify your Barangay residency and unlock SK programs and SKEAP applications.
            </p>
          </div>
        </div>
        <Link
          href="/youth/kk-profiling"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0F3D5C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2"
        >
          Complete KK Profile
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    </aside>
  );
}
