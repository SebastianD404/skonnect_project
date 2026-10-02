"use client";

import { useRouter } from "next/navigation";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function GranteeDetailErrorState({ onRetry }: { onRetry?: () => void }) {
  const router = useRouter();

  return (
    <section
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-50 text-amber-700">
        <AlertTriangle className="h-6 w-6" aria-hidden="true" />
      </span>
      <h1 className="mt-4 text-xl font-semibold text-slate-950">Grantee details unavailable</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        We couldn&apos;t load this grantee&apos;s profile right now. Check your connection and try again.
      </p>
      <button
        type="button"
        onClick={() => (onRetry ? onRetry() : router.refresh())}
        className="mt-6 inline-flex h-10 items-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-medium text-white transition-colors hover:bg-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500 focus-visible:ring-offset-2"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        Retry
      </button>
    </section>
  );
}
