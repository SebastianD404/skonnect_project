"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, Loader2, Send, X } from "lucide-react";

type Grantee = { id: string; fullName: string; email: string };
type AudienceType = "ALL" | "CUSTOM";
type BroadcastDraft = {
  subject: string;
  message: string;
  audienceType: AudienceType;
  granteeIds: string[];
};

const BROADCAST_DRAFT_KEY = "skonnect.admin.broadcast.draft";

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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const granteeSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const restoreTimer = window.setTimeout(() => {
      const savedDraft = window.localStorage.getItem(BROADCAST_DRAFT_KEY);
      if (!savedDraft) return;

      try {
        const draft = JSON.parse(savedDraft) as Partial<BroadcastDraft>;
        if (typeof draft.subject === "string") setSubject(draft.subject);
        if (typeof draft.message === "string") setMessage(draft.message);
        if (draft.audienceType === "ALL" || draft.audienceType === "CUSTOM") {
          setAudienceType(draft.audienceType);
        }
        if (Array.isArray(draft.granteeIds)) {
          setSelectedGranteeIds(draft.granteeIds.filter((id): id is string => typeof id === "string"));
        }
      } catch {
        window.localStorage.removeItem(BROADCAST_DRAFT_KEY);
      }
    }, 0);

    return () => window.clearTimeout(restoreTimer);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setGranteeMenuOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setGranteeMenuOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

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
      window.localStorage.removeItem(BROADCAST_DRAFT_KEY);
      setSuccess(`Broadcast sent to ${data.sent ?? 0} active grantee${data.sent === 1 ? "" : "s"}.`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to send broadcast.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleSaveDraft() {
    setError(null);
    try {
      window.localStorage.setItem(BROADCAST_DRAFT_KEY, JSON.stringify({
        subject,
        message,
        audienceType,
        granteeIds: selectedGranteeIds,
      } satisfies BroadcastDraft));
      setSuccess("Draft saved in this browser.");
    } catch {
      setError("Unable to save this draft in your browser.");
    }
  }

  function toggleGrantee(grantee: Grantee) {
    setSelectedGranteeIds((ids) => ids.includes(grantee.id)
      ? ids.filter((id) => id !== grantee.id)
      : [...ids, grantee.id]);
    setGranteeSearch("");
    granteeSearchInputRef.current?.focus();
  }

  function removeGrantee(granteeId: string) {
    setSelectedGranteeIds((ids) => ids.filter((id) => id !== granteeId));
    granteeSearchInputRef.current?.focus();
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 pb-12">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Communication</span>
        <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Broadcast Messages</h1>
        <p className="text-sm leading-relaxed text-slate-500">
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

      <div className="flex flex-col rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <form onSubmit={handleSubmit}>
          <div className="flex flex-col gap-8 p-6 sm:p-8">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Target Audience</span>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {(["ALL", "CUSTOM"] as const).map((option) => {
                  const isSelected = audienceType === option;
                  return (
                    <label
                      key={option}
                      className={`group relative flex cursor-pointer gap-3 rounded-2xl border p-4 shadow-sm transition-all ${
                        isSelected
                          ? "border-cyan-500 bg-cyan-50/30"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex h-5 items-center">
                        <input
                          type="radio"
                          name="audienceType"
                          value={option}
                          checked={isSelected}
                          onChange={() => setAudienceType(option)}
                          className="h-4 w-4 border-slate-300 text-cyan-600 focus:ring-cyan-500"
                          disabled={submitting}
                        />
                      </div>
                      <div className="flex flex-col">
                        <span className={`text-sm font-semibold ${isSelected ? "text-cyan-900" : "text-slate-700 transition-colors group-hover:text-slate-900"}`}>
                          {option === "ALL" ? "All Active Grantees" : "Specific Grantees"}
                        </span>
                        <span className={`mt-0.5 text-[11px] ${isSelected ? "text-cyan-700/70" : "text-slate-500"}`}>
                          {option === "ALL" ? "Send to everyone currently enrolled." : "Hand-pick recipients from a list."}
                        </span>
                      </div>
                      {isSelected ? (
                        <span aria-hidden="true" className="pointer-events-none absolute -inset-px rounded-2xl border border-cyan-500 opacity-50 ring-1 ring-inset ring-cyan-500" />
                      ) : null}
                    </label>
                  );
                })}
              </div>

              {audienceType === "CUSTOM" ? (
                <div ref={dropdownRef} className="relative z-50 mt-2 flex flex-col gap-2 animate-fadeIn">
                  <label htmlFor="grantee-search" className="text-xs font-bold uppercase tracking-widest text-slate-400">Select Recipients</label>
                  <div
                    className="flex min-h-[48px] w-full cursor-text flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 transition-all focus-within:border-cyan-500 focus-within:bg-white focus-within:ring-4 focus-within:ring-cyan-500/10"
                    onClick={() => granteeSearchInputRef.current?.focus()}
                  >
                    {selectedGrantees.map((grantee) => (
                      <span key={grantee.id} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-200/60 bg-cyan-50 px-2.5 py-1 text-xs font-semibold text-cyan-900 shadow-sm">
                        {grantee.fullName}
                        <button
                          type="button"
                          aria-label={`Remove ${grantee.fullName}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            removeGrantee(grantee.id);
                          }}
                          className="rounded-md p-0.5 text-cyan-600 transition-colors hover:bg-cyan-100 hover:text-cyan-900"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                    <input
                      ref={granteeSearchInputRef}
                      id="grantee-search"
                      type="text"
                      role="combobox"
                      aria-autocomplete="list"
                      aria-controls="grantee-search-results"
                      aria-expanded={granteeMenuOpen}
                      placeholder={selectedGrantees.length === 0 ? "Search by name or email..." : ""}
                      value={granteeSearch}
                      onFocus={() => setGranteeMenuOpen(true)}
                      onChange={(event) => {
                        setGranteeSearch(event.target.value);
                        setGranteeMenuOpen(true);
                      }}
                      disabled={submitting || loadingGrantees}
                      className="min-w-[120px] flex-1 border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
                    />
                  </div>
                  {granteeMenuOpen ? (
                    <div id="grantee-search-results" role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-60 overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200/80 bg-white shadow-xl">
                      {loadingGrantees ? (
                        <p className="px-4 py-3 text-sm text-slate-500">Loading grantees...</p>
                      ) : filteredGrantees.length ? filteredGrantees.map((grantee) => {
                        const isSelected = selectedGranteeIds.includes(grantee.id);
                        return (
                          <button
                            key={grantee.id}
                            type="button"
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => toggleGrantee(grantee)}
                            className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-3 text-left transition-colors last:border-0 hover:bg-slate-50"
                          >
                            <span className="flex min-w-0 flex-col">
                              <span className="truncate text-sm font-semibold text-slate-900">{grantee.fullName}</span>
                              <span className="truncate text-xs text-slate-500">{grantee.email}</span>
                            </span>
                            {isSelected ? <Check className="ml-3 h-4 w-4 shrink-0 text-cyan-600" aria-hidden="true" /> : null}
                          </button>
                        );
                      }) : (
                        <p className="px-4 py-3 text-sm text-slate-500">No active grantees found.</p>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <hr className="border-slate-100" />

            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <label htmlFor="broadcast-subject" className="text-xs font-bold uppercase tracking-widest text-slate-400">Subject Line</label>
                <input
                  id="broadcast-subject"
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder="e.g., Important: Semester 2 Requirements"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                  disabled={submitting}
                />
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="broadcast-message" className="text-xs font-bold uppercase tracking-widest text-slate-400">Message Body</label>
                <textarea
                  id="broadcast-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write your announcement here..."
                  rows={8}
                  className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                  disabled={submitting}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 rounded-b-3xl border-t border-slate-100 bg-slate-50/80 px-6 py-4">
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={submitting}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition-all hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Save as Draft
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Send className="h-4 w-4" aria-hidden="true" />}
              <span>{submitting ? "Sending..." : "Send Broadcast"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}