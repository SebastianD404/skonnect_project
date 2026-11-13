"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ProgramError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Failed to render program page:", error);
  }, [error]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center bg-slate-50 px-4 py-12">
      <section
        role="alert"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-lg"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="mt-5 text-xl font-bold text-slate-900">
          Failed to load this program page
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The application form or program details could not be loaded. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2"
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Try Again
        </button>
      </section>
    </main>
  );
}
