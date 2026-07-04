"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import SkeapApplicationWizard from "@/app/programs/SkeapApplicationWizard";

type Props = {
  slug: string;
  requirements?: string[];
};

type ProgramStatus = {
  badge?: string;
  label?: string;
  summary?: string;
};

export default function ProgramApplyClient({ slug, requirements = [] }: Props) {
  const [open, setOpen] = useState(false);
  const [checkingKkProfile, setCheckingKkProfile] = useState(false);
  const [showKkRequiredModal, setShowKkRequiredModal] = useState(false);
  const [status, setStatus] = useState<ProgramStatus | null>(null);
  const [loading, setLoading] = useState(false);

  async function openApplyFlow(skipKkCheck = false) {
    if (skipKkCheck) {
      setOpen(true);
      return;
    }

    setCheckingKkProfile(true);

    try {
      const response = await fetch("/api/my/kk-profile", { cache: "no-store" });
      if (response.ok) {
        setOpen(true);
      } else {
        setShowKkRequiredModal(true);
      }
    } catch {
      setShowKkRequiredModal(true);
    } finally {
      setCheckingKkProfile(false);
    }
  }

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("openApply") === "1") {
        const skip = params.get("skipKkCheck") === "1";
        void openApplyFlow(skip);
        params.delete("openApply");
        params.delete("skipKkCheck");
        const base = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
        window.history.replaceState({}, document.title, base + window.location.hash);
      }
    } catch {
      // ignore environments without window
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    setLoading(true);
    fetch(`/api/programs/${slug}/status`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        if (!mounted) return;
        setStatus(json);
      })
      .catch(() => {
        if (!mounted) return;
        setStatus(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, slug]);

  const isOpen =
    (status?.label || "").toLowerCase().includes("open") ||
    (status?.badge || "").toLowerCase().includes("open");

  return (
    <>
      <button
        onClick={() => {
          void openApplyFlow();
        }}
        disabled={checkingKkProfile}
        className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
      >
        {checkingKkProfile ? "Checking KK profile..." : "Apply for SKEAP →"}
      </button>

      {showKkRequiredModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setShowKkRequiredModal(false)}
          />
          <div className="relative w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <p className="text-xs uppercase tracking-[0.28em] text-emerald-600">S K program access</p>
            <h3 className="mt-2 text-3xl font-semibold text-slate-900">KK Profiling required first</h3>
            <p className="mt-4 text-sm leading-7 text-slate-600">
              To apply for the SKEAP scholarship and register for community events, you must first complete the Katipunan ng Kabataan (KK) profiling. This ensures all local programs remain exclusive to verified residents of Barangay Pico.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowKkRequiredModal(false)}
                className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Maybe later
              </button>
              <Link
                href="/programs/kk-profiling"
                className="inline-flex justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Go to KK Profiling
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative flex h-full max-h-[84vh] w-full max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-slate-500">SKEAP Application</p>
                <h3 className="mt-2 text-2xl font-semibold text-[#0F3D5C]">Application</h3>
                <p className="mt-1 text-sm text-slate-600">
                  This is the official SKEAP application. Your KK profile details are auto-filled and locked; complete each section and upload the required documents to submit.
                </p>
              </div>
              <button
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100"
              >
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid h-full flex-1 gap-4 overflow-hidden px-6 py-6 lg:grid-cols-[0.56fr_1.44fr] xl:grid-cols-[0.52fr_1.48fr]">
              <aside className="min-w-0 flex min-h-0 flex-col overflow-hidden rounded-[2rem] bg-white p-4 shadow-sm">
                <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Program window</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {!loading && status ? (isOpen ? "Applications are open" : "Applications are closed") : "Checking application status"}
                  </p>
                  <p className="mt-2 text-sm text-slate-600">
                    {loading && "Loading program status..."}
                    {!loading && !status && "Unable to load status. You can retry in a moment."}
                    {!loading && status && status.summary}
                  </p>
                </div>

                {!loading && status && isOpen ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-4">
                    <p className="text-sm font-semibold text-slate-900">Checklist before submit</p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-700 list-disc list-inside leading-6">
                      {requirements.map((item, index) => (
                        <li key={`${item}-${index}`}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!loading && status && !isOpen ? (
                  <div className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
                    This cycle is currently closed. Watch announcements for the next application window.
                    <div className="mt-3">
                      <Link href="/announcements" className="font-semibold text-amber-900 underline">
                        View announcements
                      </Link>
                    </div>
                  </div>
                ) : null}
              </div>
            </aside>

            <section className="min-w-0 min-h-0 overflow-y-auto pr-0">
                {!loading && status && !isOpen ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
                    SKEAP applications are currently closed for this cycle.
                  </div>
                ) : (
                  <SkeapApplicationWizard onClose={() => setOpen(false)} requirements={requirements} />
                )}
              </section>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
