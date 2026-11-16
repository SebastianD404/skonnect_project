"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";

export default function MemberRecordsError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex min-h-[50vh] w-full max-w-2xl items-center justify-center">
      <section
        role="alert"
        className="w-full rounded-3xl border border-rose-200/80 bg-white p-6 shadow-sm sm:p-8"
      >
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-700">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h1 className="mt-4 text-lg font-bold tracking-tight text-slate-900">
          Archived records couldn’t load
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          A server or database issue prevented this page from loading. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 focus-visible:ring-offset-2"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Retry
        </button>
      </section>
    </div>
  );
}
