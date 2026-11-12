"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Check, Loader2, Send, X } from "lucide-react";
import FloatingFeedback from "@/app/components/FloatingFeedback";

type Grantee = { id: string; fullName: string; email: string };
type AudienceType = "ALL" | "CUSTOM";
type MessageType = "PAYOUT_ASSEMBLY" | "CUSTOM";
type BroadcastProgressEvent =
  | { type: "progress"; completed: number; total: number }
  | { type: "complete"; sent: number; emailed: number; emailFailed: number; emailSkipped: number }
  | { type: "error"; error: string };
type BroadcastDraft = {
  subject: string;
  messageType: MessageType;
  assemblyDate: string;
  assemblyTime: string;
  location: string;
  customMessage: string;
  audienceType: AudienceType;
  granteeIds: string[];
};

const BROADCAST_DRAFT_KEY = "skonnect.admin.broadcast.payout-assembly.draft.v2";
const DEFAULT_BROADCAST_SUBJECT = "SK Educational Assistance Payout Notice";
const DEFAULT_ASSEMBLY_LOCATION = "Barangay Pico Hall";

const PAYOUT_ASSEMBLY_COPY = {
  greeting: "Greetings, SKEAP Scholars!",
  announcement:
    "We are pleased to announce the upcoming Katipunan ng Kabataan Assembly. Your educational assistance payout will be distributed during this event.",
  reminder:
    "To claim your payout, please bring a photocopy of your Student ID bearing three (3) signatures. Please ensure you have this ready, as we cannot release payouts without valid identification.",
  closing: "We look forward to seeing you there!",
  signature: "SK Council of Barangay Pico",
} as const;

function formatRecipientCount(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatAssemblyDate(value: string) {
  if (!value) return "Select a date";
  const [year, month, day] = value.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}

function formatAssemblyTime(value: string) {
  if (!value) return "Select a time";
  const [hours, minutes] = value.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2000, 0, 1, hours, minutes)));
}

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
  const [subject, setSubject] = useState(DEFAULT_BROADCAST_SUBJECT);
  const [messageType, setMessageType] = useState<MessageType>("PAYOUT_ASSEMBLY");
  const [assemblyDate, setAssemblyDate] = useState("");
  const [assemblyTime, setAssemblyTime] = useState("");
  const [location, setLocation] = useState(DEFAULT_ASSEMBLY_LOCATION);
  const [customMessage, setCustomMessage] = useState("");
  const [audienceType, setAudienceType] = useState<AudienceType>("ALL");
  const [grantees, setGrantees] = useState<Grantee[]>([]);
  const [selectedGranteeIds, setSelectedGranteeIds] = useState<string[]>([]);
  const [granteeSearch, setGranteeSearch] = useState("");
  const [granteeMenuOpen, setGranteeMenuOpen] = useState(false);
  const [loadingGrantees, setLoadingGrantees] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sendProgress, setSendProgress] = useState({ completed: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
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
        if (draft.messageType === "PAYOUT_ASSEMBLY" || draft.messageType === "CUSTOM") {
          setMessageType(draft.messageType);
        }
        if (typeof draft.assemblyDate === "string") setAssemblyDate(draft.assemblyDate);
        if (typeof draft.assemblyTime === "string") setAssemblyTime(draft.assemblyTime);
        if (typeof draft.location === "string") setLocation(draft.location);
        if (typeof draft.customMessage === "string") setCustomMessage(draft.customMessage);
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
    async function loadGrantees() {
      setLoadingGrantees(true);
      try {
        const response = await fetch("/api/admin/broadcast", { cache: "no-store" });
        const data = await readJsonResponse(response) as { grantees?: Grantee[]; error?: string };
        if (!response.ok) throw new Error(data.error || "Failed to load grantees.");
        setGrantees(data.grantees ?? []);
      } catch (loadError) {
        setLoadError(loadError instanceof Error ? loadError.message : "Failed to load grantees.");
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
  const formattedAssemblyDate = formatAssemblyDate(assemblyDate);
  const formattedAssemblyTime = formatAssemblyTime(assemblyTime);
  const payoutAssemblyMessage = [
    PAYOUT_ASSEMBLY_COPY.greeting,
    "",
    PAYOUT_ASSEMBLY_COPY.announcement,
    "",
    `When: ${formattedAssemblyDate} at ${formattedAssemblyTime}`,
    `Where: ${location.trim() || "Enter a location"}`,
    "",
    `Important Reminder: ${PAYOUT_ASSEMBLY_COPY.reminder}`,
    "",
    PAYOUT_ASSEMBLY_COPY.closing,
    "",
    "Warm regards,",
    PAYOUT_ASSEMBLY_COPY.signature,
  ].join("\n");
  const finalMessage = messageType === "PAYOUT_ASSEMBLY" ? payoutAssemblyMessage : customMessage;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setError(null);
    setSuccess(null);
    setValidationError(null);

    if (!subject.trim() || !finalMessage.trim()) {
      setValidationError("Subject and message body are required.");
      return;
    }
    if (
      messageType === "PAYOUT_ASSEMBLY" &&
      (!assemblyDate || !assemblyTime || !location.trim())
    ) {
      setValidationError("Assembly date, assembly time, and location are required.");
      return;
    }

    setSubmitting(true);
    setSendProgress({
      completed: 0,
      total: audienceType === "ALL" ? grantees.length : selectedGranteeIds.length,
    });

    try {
      const response = await fetch("/api/admin/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body: finalMessage, audienceType, granteeIds: selectedGranteeIds }),
      });
      if (!response.ok) {
        const data = await readJsonResponse(response) as { error?: string };
        throw new Error(data.error || "Failed to send broadcast.");
      }

      if (!response.body) {
        throw new Error("The server did not return broadcast progress.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const completion: {
        value: Extract<BroadcastProgressEvent, { type: "complete" }> | null;
      } = { value: null };
      const processEvent = (line: string) => {
        if (!line.trim()) return;
        const update = JSON.parse(line) as BroadcastProgressEvent;
        if (update.type === "progress") {
          setSendProgress({ completed: update.completed, total: update.total });
        } else if (update.type === "complete") {
          completion.value = update;
          setSendProgress({ completed: update.sent, total: update.sent });
        } else {
          throw new Error(update.error || "Broadcast sending failed.");
        }
      };

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (value) buffer += decoder.decode(value, { stream: !done });
          if (done) buffer += decoder.decode();

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex >= 0) {
            processEvent(buffer.slice(0, newlineIndex));
            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf("\n");
          }

          if (done) break;
        }
        if (buffer.trim()) processEvent(buffer);
      } finally {
        reader.releaseLock();
      }

      if (!completion.value) {
        throw new Error("The server closed the progress stream before completing the broadcast.");
      }

      const data = completion.value;

      setSubject(DEFAULT_BROADCAST_SUBJECT);
      setMessageType("PAYOUT_ASSEMBLY");
      setAssemblyDate("");
      setAssemblyTime("");
      setLocation(DEFAULT_ASSEMBLY_LOCATION);
      setCustomMessage("");
      setAudienceType("ALL");
      setSelectedGranteeIds([]);
      window.localStorage.removeItem(BROADCAST_DRAFT_KEY);
      const sent = data.sent;

      if (sent === 0) {
        setSuccess("No active grantees were found. Nothing was sent.");
      } else {
        const emailDetails = [
          data.emailed > 0 ? `Email sent to ${formatRecipientCount(data.emailed, "grantee", "grantees")}.` : "",
          data.emailSkipped > 0
            ? `Email not sent to ${formatRecipientCount(data.emailSkipped, "grantee", "grantees")} because email notifications are off.`
            : "",
          data.emailFailed > 0
            ? `Email could not be sent to ${formatRecipientCount(data.emailFailed, "grantee", "grantees")}. Check your Gmail settings and try again.`
            : "",
        ].filter(Boolean);

        if (emailDetails.length === 0) {
          emailDetails.push("Email sending status is unavailable.");
        }

        setSuccess(
          `Broadcast successfully sent to ${formatRecipientCount(sent, "grantee", "grantees")}! ${
            sent === 1 ? "In-app message sent." : `In-app messages sent to ${formatRecipientCount(sent, "grantee", "grantees")}.`
          } ${emailDetails.join(" ")}`
        );
      }
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
        messageType,
        assemblyDate,
        assemblyTime,
        location,
        customMessage,
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
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8 pb-12">
      <div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Communication</span>
        <h1 className="mb-1.5 mt-0.5 text-2xl font-bold tracking-tight text-slate-900">Broadcast Messages</h1>
        <p className="text-sm leading-relaxed text-slate-500">
          Send instant in-app messages and automated emails to all active SKEAP grantees.
        </p>
      </div>

      {loadError ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : null}
      {success ? <FloatingFeedback message={success} type="success" autoDismissMs={6000} onDismiss={() => setSuccess(null)} /> : null}

      <div className="flex flex-col rounded-3xl border border-slate-200/80 bg-white shadow-sm">
        <form onSubmit={handleSubmit}>
          {error ? <p role="alert" className="mx-6 mt-6 text-sm font-medium text-rose-600 sm:mx-8">{error}</p> : null}
          {validationError ? <p role="alert" className="mx-6 mt-6 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 sm:mx-8">{validationError}</p> : null}
          <div className="flex flex-col gap-6 p-4 sm:gap-8 sm:p-8">
            <div className="flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Target Audience</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                {(["ALL", "CUSTOM"] as const).map((option) => {
                  const isSelected = audienceType === option;
                  return (
                    <label
                      key={option}
                      className={`group relative flex min-w-0 cursor-pointer gap-3 rounded-2xl border p-3.5 shadow-sm transition-all sm:p-4 ${
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
                      <div className="flex min-w-0 flex-col">
                        <span className={`text-sm font-semibold ${isSelected ? "text-cyan-900" : "text-slate-700 transition-colors group-hover:text-slate-900"}`}>
                          {option === "ALL" ? "All Active Grantees" : "Specific Grantees"}
                        </span>
                        <span className={`mt-0.5 break-words text-[11px] ${isSelected ? "text-cyan-700/70" : "text-slate-500"}`}>
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
                          disabled={submitting}
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
                            disabled={submitting}
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

            <section aria-labelledby="message-type-title">
              <fieldset>
                <legend id="message-type-title" className="mb-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  Message Type
                </legend>
                <div className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                  {(["PAYOUT_ASSEMBLY", "CUSTOM"] as const).map((option) => {
                    const isSelected = messageType === option;
                    return (
                      <label key={option} className="cursor-pointer">
                        <input
                          type="radio"
                          name="messageType"
                          value={option}
                          checked={isSelected}
                          onChange={() => setMessageType(option)}
                          className="peer sr-only"
                          disabled={submitting}
                        />
                        <span className={`inline-flex min-h-9 items-center rounded-lg px-3 text-sm font-medium transition-colors peer-focus-visible:outline-none peer-focus-visible:ring-2 peer-focus-visible:ring-cyan-500 peer-focus-visible:ring-offset-1 ${
                          isSelected
                            ? "bg-white text-cyan-800 shadow-sm"
                            : "text-slate-600 hover:text-slate-900"
                        }`}>
                            {option === "PAYOUT_ASSEMBLY" ? "Payout Assembly Notice" : "Custom Message"}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            </section>

            <hr className="border-slate-100" />

            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="broadcast-subject" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Subject Line
                </label>
                <input
                  id="broadcast-subject"
                  type="text"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition-all placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                  disabled={submitting}
                />
              </div>

              {messageType === "PAYOUT_ASSEMBLY" ? (
                <>
                  <section aria-labelledby="payout-template-builder-title" className="space-y-4">
                    <div>
                      <h2 id="payout-template-builder-title" className="text-sm font-semibold text-slate-800">
                        Payout Assembly Template Builder
                      </h2>
                      <p className="mt-1 text-xs text-slate-500">
                        Set the event details to update the message preview.
                      </p>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                        <span>Assembly Date</span>
                        <input
                          type="date"
                          value={assemblyDate}
                          onChange={(event) => setAssemblyDate(event.target.value)}
                          disabled={submitting}
                          required
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/10 disabled:bg-slate-50"
                        />
                      </label>
                      <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                        <span>Assembly Time</span>
                        <input
                          type="time"
                          value={assemblyTime}
                          onChange={(event) => setAssemblyTime(event.target.value)}
                          disabled={submitting}
                          required
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/10 disabled:bg-slate-50"
                        />
                      </label>
                      <label className="space-y-1.5 text-xs font-semibold text-slate-600">
                        <span>Location</span>
                        <input
                          type="text"
                          value={location}
                          onChange={(event) => setLocation(event.target.value)}
                          disabled={submitting}
                          required
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/10 disabled:bg-slate-50"
                        />
                      </label>
                    </div>
                  </section>

                  <section aria-labelledby="message-preview-title" className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
                    <div className="border-b border-slate-200 bg-white px-4 py-3">
                      <h2 id="message-preview-title" className="text-xs font-bold uppercase tracking-wider text-slate-600">
                        Message Preview
                      </h2>
                      <p className="mt-1 truncate text-xs text-slate-400">Subject: {subject || "—"}</p>
                    </div>
                    <div className="space-y-4 px-4 py-5 text-sm leading-6 text-slate-700 sm:px-6">
                      <p>{PAYOUT_ASSEMBLY_COPY.greeting}</p>
                      <p>{PAYOUT_ASSEMBLY_COPY.announcement}</p>
                      <p>
                        <strong className="font-semibold text-slate-900">When:</strong>{" "}
                        {formattedAssemblyDate} at {formattedAssemblyTime}
                        <br />
                        <strong className="font-semibold text-slate-900">Where:</strong>{" "}
                        {location.trim() || "Enter a location"}
                      </p>
                      <p>
                        <strong className="font-semibold text-slate-900">Important Reminder:</strong>{" "}
                        {PAYOUT_ASSEMBLY_COPY.reminder}
                      </p>
                      <p>{PAYOUT_ASSEMBLY_COPY.closing}</p>
                      <p>
                        Warm regards,
                        <br />
                        {PAYOUT_ASSEMBLY_COPY.signature}
                      </p>
                    </div>
                  </section>
                </>
              ) : (
                <div className="space-y-2">
                  <label htmlFor="custom-broadcast-message" className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Message Body
                  </label>
                  <textarea
                    id="custom-broadcast-message"
                    value={customMessage}
                    onChange={(event) => setCustomMessage(event.target.value)}
                    placeholder="Write your message here..."
                    rows={12}
                    required
                    disabled={submitting}
                    className="min-h-[320px] w-full resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-900 transition-all placeholder:text-slate-400 focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10 disabled:bg-slate-50"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-b-3xl border-t border-slate-100 bg-slate-50/80 px-6 py-4">
            {submitting ? (
              <div aria-live="polite" className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 text-xs font-medium text-slate-600">
                  <span>Sending broadcast emails</span>
                  <span>{sendProgress.completed} / {sendProgress.total}</span>
                </div>
                <div
                  role="progressbar"
                  aria-label="Broadcast email progress"
                  aria-valuemin={0}
                  aria-valuemax={Math.max(sendProgress.total, 1)}
                  aria-valuenow={Math.min(sendProgress.completed, sendProgress.total)}
                  aria-valuetext={`${sendProgress.completed} of ${sendProgress.total} recipients processed`}
                  className="h-2 overflow-hidden rounded-full bg-slate-200"
                >
                  <div
                    className="h-full rounded-full bg-cyan-600 transition-[width] duration-300 ease-out"
                    style={{
                      width: `${sendProgress.total > 0
                        ? Math.min(100, (sendProgress.completed / sendProgress.total) * 100)
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
            ) : null}
            <div className="flex items-center justify-end gap-3">
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
                <span>{submitting
                  ? `Sending... (${sendProgress.completed} / ${sendProgress.total})`
                  : "Send Broadcast"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}