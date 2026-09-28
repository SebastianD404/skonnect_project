"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, CircleDashed, Clock3, ArrowRight } from "lucide-react";

type ApplicationRecord = {
  id: string;
  isResolved: boolean;
  response: string | null;
  reviewStatus: string | null;
};

type ApplicationCardStatus = {
  label: string;
  tone: "emerald" | "amber" | "rose" | "slate";
};

const notStartedStatus: ApplicationCardStatus = { label: "Not started", tone: "slate" };

function getStatusTone(label: string): ApplicationCardStatus["tone"] {
  const normalized = label.toLowerCase();
  if (normalized.includes("approved") || normalized.includes("complete")) return "emerald";
  if (normalized.includes("return") || normalized.includes("action") || normalized.includes("reject")) return "rose";
  if (normalized.includes("pending") || normalized.includes("review") || normalized.includes("resubmit")) return "amber";
  return "slate";
}

function StatusIndicator({ status }: { status: ApplicationCardStatus }) {
  const Icon = status.tone === "emerald"
    ? CheckCircle2
    : status.tone === "amber"
    ? Clock3
    : status.tone === "rose"
    ? AlertCircle
    : CircleDashed;
  const colorClass = status.tone === "emerald"
    ? "bg-emerald-50 text-emerald-800 ring-emerald-200"
    : status.tone === "amber"
    ? "bg-amber-50 text-amber-800 ring-amber-200"
    : status.tone === "rose"
    ? "bg-rose-50 text-rose-800 ring-rose-200"
    : "bg-slate-100 text-slate-700 ring-slate-200";

  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-semibold ring-1 ring-inset ${colorClass}`}>
      <Icon className="h-4 w-4" aria-hidden="true" />
      {status.label}
    </span>
  );
}

export default function ApplicationsPage() {
  const [kkStatus, setKkStatus] = useState<ApplicationCardStatus | null>(null);
  const [skeapApplication, setSkeapApplication] = useState<ApplicationRecord | null>(null);
  const [skeapStatus, setSkeapStatus] = useState<ApplicationCardStatus | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStatuses() {
      const [kkResult, skeapResult] = await Promise.allSettled([
        fetch("/api/my/kk-profile", { cache: "no-store" }),
        fetch("/api/my/inquiries?skeapOnly=1", { cache: "no-store" }),
      ]);

      if (!active) return;

      if (kkResult.status === "fulfilled" && kkResult.value.ok) {
        const data = await kkResult.value.json();
        const label = typeof data.profile?.status === "string" ? data.profile.status : "Status unavailable";
        setKkStatus({ label, tone: getStatusTone(label) });
      } else if (kkResult.status === "fulfilled" && kkResult.value.status === 404) {
        setKkStatus(notStartedStatus);
      } else {
        setKkStatus({ label: "Status unavailable", tone: "slate" });
      }

      if (skeapResult.status === "fulfilled" && skeapResult.value.ok) {
        const data = await skeapResult.value.json();
        const latest = (data.inquiries ?? [])[0] as ApplicationRecord | undefined;
        if (latest) {
          const label = latest.reviewStatus || (latest.isResolved ? "Completed" : latest.response ? "Update available" : "Pending review");
          setSkeapApplication(latest);
          setSkeapStatus({ label, tone: getStatusTone(label) });
        } else {
          setSkeapStatus(notStartedStatus);
        }
      } else {
        setSkeapStatus({ label: "Status unavailable", tone: "slate" });
      }
    }

    void loadStatuses();
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#F3F7FB] px-4 py-12 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 border-b border-slate-200 pb-7">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#0F3D5C]">Application center</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">Applications</h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
            View your KK Profiling status or continue to the SKEAP scholarship application.
          </p>
        </header>

        <section aria-label="Your applications" className="grid gap-5 md:grid-cols-2">
          <article className="flex min-h-72 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">Youth registration</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">KK Profiling</h2>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0F3D5C] text-sm font-bold text-white" aria-hidden="true">KK</span>
            </div>
            <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">
              Track your youth registration review, submitted documents, and any next steps.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <div aria-live="polite">
                {kkStatus ? <StatusIndicator status={kkStatus} /> : <span className="text-sm text-slate-500">Checking status...</span>}
              </div>
              <Link
                href="/programs/kk-profiling/status"
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2"
              >
                View Status
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>

          <article className="flex min-h-72 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-800">Scholarship program</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">SKEAP</h2>
              </div>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-800 text-sm font-bold text-white" aria-hidden="true">SK</span>
            </div>
            <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">
              Apply for scholarship support or follow up on an application you have already submitted.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-5">
              <div aria-live="polite">
                {skeapStatus ? <StatusIndicator status={skeapStatus} /> : <span className="text-sm text-slate-500">Checking status...</span>}
              </div>
              <Link
                href={skeapApplication ? `/applications/${skeapApplication.id}` : "/programs/skeap-scholarship"}
                className="inline-flex items-center gap-2 rounded-lg bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2"
              >
                {skeapApplication ? "View Application" : "Apply Now"}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}