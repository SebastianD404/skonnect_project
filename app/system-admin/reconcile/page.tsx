"use client";

import { useState } from "react";
import { CheckCircle2, RefreshCw, Users } from "lucide-react";

type ReconcileSummary = {
  totalAuthUsers: number;
  skippedNoEmail: number;
  alreadyLinked: number;
  wouldRelink: number;
  wouldCreate: number;
  relinked: number;
  created: number;
  errors: number;
  changes: ReconcileChange[];
};

type ReconcileChange = {
  action: "relink" | "create";
  email: string;
  profileName?: string;
};

type ReconcileResult = {
  summary: ReconcileSummary;
  applied: boolean;
};

export default function SystemAdminReconcilePage() {
  const [result, setResult] = useState<ReconcileResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function runReconciliation(apply: boolean) {
    if (apply && !window.confirm("Apply the previewed Auth profile links and create missing user profiles?")) {
      return;
    }

    setIsRunning(true);
    setError(null);
    try {
      const response = await fetch("/api/system-admin/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apply }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.error || "Unable to reconcile Auth users.");
      }
      const summary =
        payload && typeof payload.summary === "object" && payload.summary !== null
          ? payload.summary as Partial<ReconcileSummary>
          : {};
      setResult({
        summary: {
          totalAuthUsers: Number(summary.totalAuthUsers ?? 0),
          skippedNoEmail: Number(summary.skippedNoEmail ?? 0),
          alreadyLinked: Number(summary.alreadyLinked ?? 0),
          wouldRelink: Number(summary.wouldRelink ?? 0),
          wouldCreate: Number(summary.wouldCreate ?? 0),
          relinked: Number(summary.relinked ?? 0),
          created: Number(summary.created ?? 0),
          errors: Number(summary.errors ?? 0),
          changes: Array.isArray(summary.changes) ? summary.changes : [],
        },
        applied: Boolean(payload.applied),
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to reconcile Auth users.");
    } finally {
      setIsRunning(false);
    }
  }

  const summaryItems = result
    ? result.applied
      ? [
          { label: "Profiles relinked", value: result.summary.relinked },
          { label: "Profiles created", value: result.summary.created },
          { label: "Already linked", value: result.summary.alreadyLinked },
          { label: "Errors", value: result.summary.errors },
        ]
      : [
          { label: "Auth users scanned", value: result.summary.totalAuthUsers },
          { label: "Would relink", value: result.summary.wouldRelink },
          { label: "Would create", value: result.summary.wouldCreate },
          { label: "Already linked", value: result.summary.alreadyLinked },
          { label: "Skipped without email", value: result.summary.skippedNoEmail },
          { label: "Errors", value: result.summary.errors },
        ]
    : [];

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
      <header>
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span>System Admin</span>
          <span aria-hidden="true">/</span>
          <span className="text-slate-900">Reconcile Auth Users</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">Reconcile Auth Users</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
          Preview links between Supabase Auth identities and application profiles, then apply missing links or profiles.
        </p>
      </header>

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-start gap-4 p-5 sm:p-6">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-cyan-50 text-cyan-700">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-slate-900">Identity reconciliation</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              The preview is read-only. Applying will relink profiles by email or create a YOUTH profile when no matching profile exists. Every applied change is recorded in the audit log.
            </p>
          </div>
        </div>

        {error ? <p role="alert" className="border-t border-rose-100 px-5 py-3 text-sm font-medium text-rose-600 sm:px-6">{error}</p> : null}

        {result ? (
          <div role="status" aria-live="polite" className="border-t border-slate-100 px-5 py-4 sm:px-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              {result.applied ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <RefreshCw className="h-4 w-4 text-slate-500" />}
              {result.applied ? "Reconciliation applied" : "Preview complete"}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {summaryItems.map((item) => (
                <div key={item.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <dt className="text-xs text-slate-500">{item.label}</dt>
                  <dd className="mt-1 text-lg font-semibold tabular-nums text-slate-900">{item.value}</dd>
                </div>
              ))}
            </dl>
            {result.summary.changes.length > 0 ? (
              <div className="mt-4 overflow-hidden rounded-lg border border-amber-200 bg-amber-50">
                <div className="border-b border-amber-200 px-3 py-2 text-sm font-semibold text-amber-950">
                  {result.applied ? "Changes processed" : "Accounts requiring attention"}
                </div>
                <ul className="divide-y divide-amber-200/70">
                  {result.summary.changes.map((change) => (
                    <li
                      key={`${change.action}-${change.email}`}
                      className="flex flex-col gap-1 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="font-medium text-slate-900">{change.email}</span>
                      <span className="text-xs text-amber-900">
                        {change.action === "create"
                          ? `Create YOUTH profile${change.profileName ? ` (${change.profileName})` : ""}`
                          : `Relink to ${change.profileName || "existing profile"}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/70 px-5 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => runReconciliation(false)}
            disabled={isRunning}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {isRunning ? "Scanning..." : "Preview sync"}
          </button>
          {result && !result.applied && result.summary.errors === 0 ? (
            <button
              type="button"
              onClick={() => runReconciliation(true)}
              disabled={isRunning || (result.summary.wouldRelink === 0 && result.summary.wouldCreate === 0)}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isRunning ? <RefreshCw className="h-4 w-4 animate-spin" /> : null}
              {isRunning ? "Syncing..." : "Apply sync"}
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}