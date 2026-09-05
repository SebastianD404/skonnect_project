"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Loader2, Radio, Search, Send } from "lucide-react";

type Grantee = { id: string; fullName: string; email: string };
type AudienceType = "ALL" | "CUSTOM";

async function readJsonResponse(response: Response) {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error("The server returned an invalid response.");
  }

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error("The server returned an invalid response.");
  }
}

export default function BroadcastPage() {
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("ALL");
  const [grantees, setGrantees] = useState<Grantee[]>([]);
  const [selectedGranteeIds, setSelectedGranteeIds] = useState<string[]>([]);
  const [granteeSearch, setGranteeSearch] = useState("");
  const [granteeMenuOpen, setGranteeMenuOpen] = useState(false);
  const [loadingGrantees, setLoadingGrantees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!success) return;

    const dismissTimer = window.setTimeout(() => {
      setSuccess(null);
    }, 3000);

    return () => window.clearTimeout(dismissTimer);
  }, [success]);

  useEffect(() => {
    async function loadGrantees() {
      setLoadingGrantees(true);
      try {
        const response = await fetch("/api/admin/broadcast", { cache: "no-store" });
        const data = await readJsonResponse(response) as { grantees?: Grantee[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Failed to load grantees.");
        setGrantees(data.grantees ?? []);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "Failed to load grantees.");
      } finally {
        setLoadingGrantees(false);
      }
    }

    loadGrantees();
  }, []);

  const filteredGrantees = useMemo(() => {
    const query = granteeSearch.trim().toLowerCase();
    if (!query) return grantees;
    return grantees.filter((grantee) => `${grantee.fullName} ${grantee.email}`.toLowerCase().includes(query));
  }, [granteeSearch, grantees]);

  const selectedGrantees = grantees.filter((grantee) => selectedGranteeIds.includes(grantee.id));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!subject.trim() || !message.trim()) {
      setError("Subject and message content are required.");
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body: message, audienceType, granteeIds: selectedGranteeIds }),
      });
      const data = await readJsonResponse(response) as { error?: string; sent?: number };

      if (!response.ok) {
        throw new Error(data.error || "Failed to send broadcast.");
      }

      setSubject("");
      setMessage("");
      setAudienceType("ALL");
      setSelectedGranteeIds([]);
      setSuccess(`Broadcast sent to ${data.sent ?? 0} active grantee${data.sent === 1 ? "" : "s"}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to send broadcast.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl py-4">
      <div className="mb-8">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F3D5C] text-white">
          <Radio className="h-6 w-6" aria-hidden="true" />
        </div>
        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0F3D5C]">Communication</p>
        <h1 className="mt-2 text-4xl font-black tracking-tight text-slate-950">Broadcast Messages</h1>
        <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
          Send instant in-app messages and automated emails to all active SKEAP grantees.
        </p>
      </div>

      {error ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="fixed right-6 top-6 z-10 flex items-start gap-3 rounded-2xl border border-emerald-200 bg-white p-4 text-sm text-emerald-800 shadow-lg" role="status">
          <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-emerald-600" aria-hidden="true" />
          <span>{success}</span>
        </div>
      ) : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-8 rounded-2xl border border-sky-100 bg-sky-50 p-4">
          <div className="flex items-center gap-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-[#0F3D5C] shadow-sm">
            <Radio className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Audience</p>
            <p className="mt-1 font-semibold text-slate-900">
              {audienceType === "ALL" ? "Target: All Active Grantees" : `${selectedGranteeIds.length} specific grantee${selectedGranteeIds.length === 1 ? "" : "s"} selected`}
            </p>
          </div>
          </div>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            {(["ALL", "CUSTOM"] as const).map((option) => (
              <label key={option} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm font-semibold transition ${audienceType === option ? "border-[#0F3D5C] bg-white text-[#0F3D5C]" : "border-sky-100 bg-transparent text-slate-700 hover:bg-white/70"}`}>
                <input
                  type="radio"
                  name="audienceType"
                  value={option}
                  checked={audienceType === option}
                  onChange={() => setAudienceType(option)}
                  className="h-4 w-4 accent-[#0F3D5C]"
                  disabled={submitting}
                />
                {option === "ALL" ? "All Active Grantees" : "Specific Grantees"}
              </label>
            ))}
          </div>
          {audienceType === "CUSTOM" ? (
            <div className="relative mt-4">
              <button type="button" onClick={() => setGranteeMenuOpen((open) => !open)} disabled={submitting || loadingGrantees} className="flex w-full items-center justify-between rounded-xl border border-slate-300 bg-white px-4 py-3 text-left text-sm text-slate-700">
                <span className="truncate">{loadingGrantees ? "Loading grantees..." : selectedGrantees.length ? selectedGrantees.map((grantee) => grantee.fullName).join(", ") : "Search and select grantees"}</span>
                <ChevronDown className="ml-3 h-4 w-4 flex-shrink-0" aria-hidden="true" />
              </button>
              {granteeMenuOpen ? (
                <div className="absolute z-10 mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 shadow-xl">
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 px-3">
                    <Search className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    <input value={granteeSearch} onChange={(event) => setGranteeSearch(event.target.value)} placeholder="Search by name or email" className="w-full py-2 text-sm outline-none" autoFocus />
                  </div>
                  <div className="mt-2 max-h-56 overflow-y-auto">
                    {filteredGrantees.length ? filteredGrantees.map((grantee) => {
                      const selected = selectedGranteeIds.includes(grantee.id);
                      return <button key={grantee.id} type="button" onClick={() => setSelectedGranteeIds((ids) => selected ? ids.filter((id) => id !== grantee.id) : [...ids, grantee.id])} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-slate-50"><span className={`flex h-5 w-5 items-center justify-center rounded border ${selected ? "border-[#0F3D5C] bg-[#0F3D5C] text-white" : "border-slate-300"}`}>{selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-slate-800">{grantee.fullName}</span><span className="block truncate text-xs text-slate-500">{grantee.email}</span></span></button>;
                    }) : <p className="px-2 py-4 text-center text-sm text-slate-500">No active grantees found.</p>}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="broadcast-subject" className="mb-2 block text-sm font-semibold text-slate-800">Subject</label>
            <input
              id="broadcast-subject"
              type="text"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Enter a clear subject"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/15"
              disabled={submitting}
            />
          </div>

          <div>
            <label htmlFor="broadcast-message" className="mb-2 block text-sm font-semibold text-slate-800">Message Content</label>
            <textarea
              id="broadcast-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Write the announcement body"
              rows={9}
              className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-slate-900 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/15"
              disabled={submitting}
            />
          </div>

          <div className="flex justify-end border-t border-slate-100 pt-6">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#0F3D5C] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0b3048] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              {submitting ? "Sending..." : "Send Broadcast"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}