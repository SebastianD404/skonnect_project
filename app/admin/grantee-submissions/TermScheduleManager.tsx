"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightLeft,
  AlertTriangle,
  CalendarDays,
  Loader2,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { MAX_SCHEDULED_TERMS } from "@/lib/academic-term-schedule-constants";
import {
  getAcademicSemesterOrder,
  getCurrentManilaAcademicSemester,
  getNextAcademicSemester,
} from "@/lib/semester-progress";

type Schedule = {
  id?: string;
  semester: string;
  opensAt: string;
  closesAt: string;
};

type AssignedTerm = {
  term: string;
  count: number;
  grantees: Array<{ id: string; fullName: string }>;
};
type SettingsData = {
  error?: string;
  fullName?: string;
  email?: string;
  settings?: { inquiryAlerts?: boolean; submissionAlerts?: boolean };
  reminderSettings?: { skeapReminderOffsets?: string };
  waitlistOfferDays?: number;
  activeSkeapEducationLevels?: string[];
  academicTermSchedules?: Array<{
    id: string;
    semester: string;
    opensAt: string;
    closesAt: string;
  }>;
  activeGranteeTerms?: AssignedTerm[];
  updatedCount?: number;
  success?: boolean;
};

const INPUT_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20";

function toManilaDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const manilaDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${manilaDate.getUTCFullYear()}-${pad(manilaDate.getUTCMonth() + 1)}-${pad(manilaDate.getUTCDate())}T${pad(manilaDate.getUTCHours())}:${pad(manilaDate.getUTCMinutes())}`;
}

function localDateTimeValue(date: Date) {
  const manilaDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${manilaDate.getUTCFullYear()}-${pad(manilaDate.getUTCMonth() + 1)}-${pad(manilaDate.getUTCDate())}T${pad(manilaDate.getUTCHours())}:${pad(manilaDate.getUTCMinutes())}`;
}

function getStatus(schedule: Schedule, now: number) {
  const opensAt = new Date(`${schedule.opensAt}:00+08:00`).getTime();
  const closesAt = new Date(`${schedule.closesAt}:00+08:00`).getTime();
  if (now < opensAt) return "Scheduled";
  if (now <= closesAt) return "Open";
  return "Closed";
}

function getTermYearAndSemester(term: string) {
  const match = /^(\d{4})-\d{4}\s+(First Semester|Second Semester)$/.exec(term);
  return match ? { year: match[1], semester: match[2] } : null;
}

async function readResponse(response: Response): Promise<SettingsData> {
  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`The schedule service returned an invalid response (HTTP ${response.status}).`);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("The schedule service returned an invalid response.");
  }
  return data as SettingsData;
}

export default function TermScheduleManager() {
  const router = useRouter();
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [savedSchedules, setSavedSchedules] = useState<Schedule[]>([]);
  const [assignedTerms, setAssignedTerms] = useState<AssignedTerm[]>([]);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [focusedDateField, setFocusedDateField] = useState<string | null>(null);
  const [newTermOverride, setNewTermOverride] = useState<{
    year: string;
    semester: string;
  } | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const response = await fetch("/api/admin-settings");
        const data = await readResponse(response);
        if (!response.ok) throw new Error(data.error || "Unable to load term schedules.");
        const loaded = (data.academicTermSchedules ?? []).map((schedule) => ({
          id: schedule.id,
          semester: schedule.semester,
          opensAt: toManilaDateTimeLocal(schedule.opensAt),
          closesAt: toManilaDateTimeLocal(schedule.closesAt),
        }));
        if (active) {
          setSchedules(loaded);
          setSavedSchedules(loaded);
          setAssignedTerms(data.activeGranteeTerms ?? []);
          setSettings(data);
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load term schedules.");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, []);

  const unscheduledTerms = useMemo(
    () => assignedTerms.filter(({ term }) =>
      !schedules.some((schedule) => schedule.semester === term && getStatus(schedule, now) === "Open"),
    ),
    [assignedTerms, now, schedules],
  );
  const openTerm = schedules.find((schedule) => getStatus(schedule, now) === "Open")?.semester ?? null;
  const termFloor = openTerm ?? getCurrentManilaAcademicSemester(new Date(now));
  const defaultNextTerm = getNextAcademicSemester(termFloor);
  const newTerm =
    (defaultNextTerm ? getTermYearAndSemester(defaultNextTerm) : null) ??
    { year: String(new Date().getFullYear()), semester: "First Semester" };
  const selectedNewTerm = newTermOverride ?? newTerm;
  const termFloorOrder = getAcademicSemesterOrder(termFloor);
  const selectedAcademicTerm = `${selectedNewTerm.year}-${Number(selectedNewTerm.year) + 1} ${selectedNewTerm.semester}`;
  const selectedTermOrder = getAcademicSemesterOrder(selectedAcademicTerm);
  const selectedTermIsPastOrCurrent =
    selectedTermOrder !== null &&
    termFloorOrder !== null &&
    selectedTermOrder <= termFloorOrder;
  const selectedTermAlreadyExists = schedules.some(
    (schedule) => schedule.semester === selectedAcademicTerm,
  );
  const hasChanges = JSON.stringify(schedules) !== JSON.stringify(savedSchedules) || deletedIds.length > 0;

  async function saveSchedules(nextSchedules: Schedule[], nextDeletedIds = deletedIds, successMessage = "Academic schedules saved.") {
    if (!settings) {
      setError("Schedule settings are unavailable. Reload this page and try again.");
      return;
    }
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: settings.fullName,
          email: settings.email,
          inquiryAlerts: settings.settings?.inquiryAlerts ?? true,
          submissionAlerts: settings.settings?.submissionAlerts ?? true,
          skeapReminderOffsets: settings.reminderSettings?.skeapReminderOffsets ?? "7, 3, 1",
          waitlistOfferDays: settings.waitlistOfferDays ?? 7,
          activeSkeapEducationLevels: settings.activeSkeapEducationLevels,
          academicTermSchedules: nextSchedules,
          deletedAcademicTermScheduleIds: nextDeletedIds,
        }),
      });
      const data = await readResponse(response);
      if (!response.ok) throw new Error(data.error || "Unable to save academic schedules.");
      const saved = (data.academicTermSchedules ?? []).map((schedule) => ({
        id: schedule.id,
        semester: schedule.semester,
        opensAt: toManilaDateTimeLocal(schedule.opensAt),
        closesAt: toManilaDateTimeLocal(schedule.closesAt),
      }));
      setSchedules(saved);
      setSavedSchedules(saved);
      setDeletedIds([]);
      setAssignedTerms(data.activeGranteeTerms ?? assignedTerms);
      setSettings((current) => current ? { ...current, ...data } : data);
      setMessage(successMessage);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save academic schedules.");
    } finally {
      setSaving(false);
    }
  }

  function openAssignedTerm(term: string) {
    const start = new Date();
    start.setSeconds(0, 0);
    const close = new Date(start.getTime() + 30 * 24 * 60 * 60 * 1000);
    const existing = schedules.find((schedule) => schedule.semester === term);
    const next = existing
      ? schedules.map((schedule) => schedule.semester === term
          ? { ...schedule, opensAt: localDateTimeValue(start), closesAt: localDateTimeValue(close) }
          : schedule)
      : [...schedules, {
          semester: term,
          opensAt: localDateTimeValue(start),
          closesAt: localDateTimeValue(close),
        }];
    void saveSchedules(next, deletedIds, `${term} submission schedule is open.`);
  }

  async function syncGranteesToOpenTerm(fromTerm: string) {
    if (!openTerm) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/admin/grantee-submissions/sync-entry-terms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromTerm, toTerm: openTerm }),
      });
      const result = await readResponse(response);
      if (!response.ok) throw new Error(result.error || "Unable to sync grantee entry terms.");

      const refreshedResponse = await fetch("/api/admin-settings", { cache: "no-store" });
      const refreshed = await readResponse(refreshedResponse);
      if (!refreshedResponse.ok) {
        throw new Error("Grantee terms were synced, but the schedule warning could not be refreshed. Reload the page.");
      }
      setAssignedTerms(refreshed.activeGranteeTerms ?? []);
      setMessage(
        `Synced ${result.updatedCount ?? 0} grantee${result.updatedCount === 1 ? "" : "s"} to ${openTerm}.`,
      );
      router.refresh();
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Unable to sync grantee entry terms.");
    } finally {
      setSaving(false);
    }
  }

  function removeSchedule(index: number) {
    const removed = schedules[index];
    if (removed.id) setDeletedIds((current) => [...current, removed.id!]);
    setSchedules((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  function addSchedule() {
    const startYear = Number(selectedNewTerm.year);
    if (!Number.isInteger(startYear) || startYear < 2000 || startYear > 9998) {
      setError("Enter a valid academic year start.");
      return;
    }
    const semester = `${startYear}-${startYear + 1} ${selectedNewTerm.semester}`;
    const selectedOrder = getAcademicSemesterOrder(semester);
    if (selectedOrder === null || selectedOrder <= (termFloorOrder ?? Number.NEGATIVE_INFINITY)) {
      setError(`Choose a term after ${termFloor}. Past or current terms cannot be scheduled.`);
      return;
    }
    if (schedules.some((schedule) => schedule.semester === semester)) {
      setError(`A schedule already exists for ${semester}.`);
      return;
    }
    setSchedules((current) => [...current, { semester, opensAt: "", closesAt: "" }]);
    setError(null);
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6" aria-busy={loading || saving}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Academic term & submission schedule</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
              Set the opening window and deadline for each semester’s grantee document submissions. Times use Philippine time (Asia/Manila).
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          {schedules.length}/{MAX_SCHEDULED_TERMS} terms
        </span>
      </div>

      {unscheduledTerms.length > 0 ? (
        <div className="mt-5 space-y-2">
          {unscheduledTerms.map(({ term, count, grantees }) => (
            <div key={term} className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5 text-sm text-amber-900">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                <p>
                  <strong>{term}</strong> is assigned to {count} active grantee{count === 1 ? "" : "s"}
                  {grantees.length ? ` (${grantees.map((grantee) => grantee.fullName).join(", ")})` : ""}
                  {" "}but has no open submission schedule.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openTerm ? void syncGranteesToOpenTerm(term) : openAssignedTerm(term)}
                disabled={loading || saving || !settings || (schedules.length >= MAX_SCHEDULED_TERMS && !schedules.some((item) => item.semester === term))}
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-800 px-4 text-sm font-semibold text-white transition hover:bg-amber-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : openTerm ? <ArrowRightLeft className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
                {openTerm
                  ? `Sync ${count} Grantee${count === 1 ? "" : "s"} to ${openTerm}`
                  : `Create & Open Schedule for ${term}`}
              </button>
            </div>
          ))}
          <p className="text-xs text-amber-800">The one-click schedule opens immediately and uses a 30-day deadline. You can adjust the dates below.</p>
        </div>
      ) : null}

      {error ? <p role="alert" className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
      {message ? <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{message}</p> : null}

      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="text-sm text-slate-500">Loading schedules…</p>
        ) : schedules.length ? schedules.map((schedule, index) => {
          const status = getStatus(schedule, now);
          const academicYearStart = schedule.semester.match(/^(\d{4})-/)?.[1];
          const calendarAnchor = academicYearStart ? `${academicYearStart}-01-01T00:00` : "";
          const minimumDateTime = academicYearStart ? `${academicYearStart}-01-01T00:00` : undefined;
          const statusClass = status === "Open"
            ? "bg-emerald-50 text-emerald-700"
            : status === "Scheduled"
              ? "bg-sky-50 text-sky-700"
              : "bg-slate-100 text-slate-600";
          return (
            <article key={schedule.id ?? schedule.semester} className="rounded-xl border border-slate-200 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">{schedule.semester}</h3>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>{status}</span>
                </div>
                <button
                  type="button"
                  onClick={() => removeSchedule(index)}
                  disabled={saving || !settings}
                  aria-label={`Remove ${schedule.semester} schedule`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-slate-700">
                  Opens on
                  <input
                    type="datetime-local"
                    value={schedule.opensAt || (focusedDateField === `${schedule.semester}:opensAt` ? calendarAnchor : "")}
                    min={minimumDateTime}
                    onFocus={() => setFocusedDateField(`${schedule.semester}:opensAt`)}
                    onBlur={() => setFocusedDateField(null)}
                    onChange={(event) => setSchedules((current) => current.map((item, rowIndex) =>
                      rowIndex === index ? { ...item, opensAt: event.target.value } : item))}
                    disabled={saving || !settings}
                    className={`${INPUT_CLASSES} mt-1.5`}
                  />
                </label>
                <label className="text-xs font-semibold text-slate-700">
                  Submission deadline
                  <input
                    type="datetime-local"
                    value={schedule.closesAt || (focusedDateField === `${schedule.semester}:closesAt` ? calendarAnchor : "")}
                    min={minimumDateTime}
                    onFocus={() => setFocusedDateField(`${schedule.semester}:closesAt`)}
                    onBlur={() => setFocusedDateField(null)}
                    onChange={(event) => setSchedules((current) => current.map((item, rowIndex) =>
                      rowIndex === index ? { ...item, closesAt: event.target.value } : item))}
                    disabled={saving || !settings}
                    className={`${INPUT_CLASSES} mt-1.5`}
                  />
                </label>
              </div>
            </article>
          );
        }) : (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">No academic submission windows have been scheduled.</p>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-4 border-t border-slate-100 pt-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-x-6 sm:gap-y-4">
        <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-700 sm:w-44">
          Academic year start
          <input
            type="number"
            min="2000"
            max="9998"
            value={selectedNewTerm.year}
            onChange={(event) => {
              setNewTermOverride((current) => ({
                ...(current ?? newTerm),
                year: event.target.value,
              }));
              setError(null);
            }}
            disabled={loading || saving || !settings}
            className={`${INPUT_CLASSES} w-full`}
          />
        </label>
        <label className="flex min-w-0 flex-col gap-2 text-xs font-semibold text-slate-700 sm:w-56">
          Semester
          <select
            value={selectedNewTerm.semester}
            onChange={(event) => {
              setNewTermOverride((current) => ({
                ...(current ?? newTerm),
                semester: event.target.value,
              }));
              setError(null);
            }}
            disabled={loading || saving || !settings}
            className={`${INPUT_CLASSES} w-full`}
          >
            <option>First Semester</option>
            <option>Second Semester</option>
          </select>
        </label>
        <button
          type="button"
          onClick={addSchedule}
          disabled={
            loading ||
            saving ||
            !settings ||
            schedules.length >= MAX_SCHEDULED_TERMS ||
            !Number.isInteger(Number(selectedNewTerm.year)) ||
            selectedTermIsPastOrCurrent ||
            selectedTermAlreadyExists
          }
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        >
          <Plus className="h-4 w-4" aria-hidden="true" /> Add term
        </button>
        <button
          type="button"
          onClick={() => void saveSchedules(schedules)}
          disabled={!hasChanges || loading || saving || !settings}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50 sm:ml-auto"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Save className="h-4 w-4" aria-hidden="true" />}
          Save schedule changes
        </button>
      </div>
      {selectedTermIsPastOrCurrent ? (
        <p role="status" className="mt-3 text-xs font-medium text-amber-800">
          The next term must be after {termFloor}. Choose a later academic year or semester.
        </p>
      ) : selectedTermAlreadyExists ? (
        <p role="status" className="mt-3 text-xs font-medium text-amber-800">
          A schedule already exists for {selectedAcademicTerm}.
        </p>
      ) : null}
    </section>
  );
}
