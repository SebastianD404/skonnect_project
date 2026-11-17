"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle } from "lucide-react";

type Props = {
  open: boolean;
};

export default function KkProfilingSuccessInterstitial({ open }: Props) {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);

  if (!open) return null;

  const goToDashboard = () => {
    setIsNavigating(true);
    router.push("/youth-dashboard");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="kk-profiling-success-title"
        aria-describedby="kk-profiling-success-description"
        className="my-auto w-full max-w-[30rem] rounded-2xl bg-white p-4 shadow-2xl ring-1 ring-slate-200 sm:p-5"
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="kk-profiling-success-title"
              className="text-xl font-bold text-slate-900 sm:text-2xl"
            >
              KK Profiling Submitted!
            </h2>
            <p
              id="kk-profiling-success-description"
              className="mt-2 text-sm leading-6 text-slate-600"
            >
              Your Katipunan ng Kabataan (KK) profile and uploaded documents have been received and are now pending review by the Barangay Pico SK Admin. Once your profile is approved, you will be eligible to apply for SKEAP.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <button
            type="button"
            onClick={goToDashboard}
            disabled={isNavigating}
            aria-busy={isNavigating}
            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#0F3D5C] px-4 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-80"
          >
            {isNavigating ? (
              <>
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                Opening dashboard...
              </>
            ) : (
              "Go to Youth Dashboard →"
            )}
          </button>
        </div>
      </section>
    </div>
  );
}
