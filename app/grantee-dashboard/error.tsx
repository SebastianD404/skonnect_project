"use client";

import { useEffect } from "react";

export default function GranteeDashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Grantee dashboard failed to render:", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center justify-center px-6 py-16">
      <section className="w-full rounded-2xl border border-rose-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">Unable to load your dashboard</h1>
        <p className="mt-2 text-sm text-slate-600">
          Something went wrong while loading this page. Please try again.
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-6 rounded-xl bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0D2E47]"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
