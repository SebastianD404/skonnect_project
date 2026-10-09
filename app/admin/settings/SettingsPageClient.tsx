"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Save } from "lucide-react";

const DEFAULT_STATE = {
  fullName: "",
  email: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  inquiryAlerts: true,
  submissionAlerts: true,
  skeapReminderOffsets: "7, 3, 1",
  skeapDeadline: "",
};

const INPUT_CLASSES =
  "w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/20 disabled:cursor-wait disabled:bg-slate-100";

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toDeadlineIso(value: string) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("Enter a valid SKEAP submission deadline.");
  return date.toISOString();
}

export default function SettingsPageClient({ dateLabel }: { dateLabel: string }) {
  const [formState, setFormState] = useState(DEFAULT_STATE);
  const [savedState, setSavedState] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!statusMessage) return;

    const dismissTimer = window.setTimeout(() => setStatusMessage(null), 3000);
    return () => window.clearTimeout(dismissTimer);
  }, [statusMessage]);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setErrorMessage(null);
      try {
        const response = await fetch("/api/admin-settings");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || "Unable to load settings.");
        }
        const loadedState = {
          ...DEFAULT_STATE,
          fullName: data.fullName ?? DEFAULT_STATE.fullName,
          email: data.email ?? DEFAULT_STATE.email,
          inquiryAlerts: data.settings?.inquiryAlerts ?? DEFAULT_STATE.inquiryAlerts,
          submissionAlerts: data.settings?.submissionAlerts ?? DEFAULT_STATE.submissionAlerts,
          skeapReminderOffsets: data.reminderSettings?.skeapReminderOffsets ?? DEFAULT_STATE.skeapReminderOffsets,
          skeapDeadline: toDateTimeLocal(data.reminderSettings?.skeapDeadline),
        };
        setFormState(loadedState);
        setSavedState(loadedState);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Unable to load settings.");
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleChange = (field: keyof typeof formState, value: string | boolean) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const hasUnsavedChanges = JSON.stringify(formState) !== JSON.stringify(savedState);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formState,
          skeapDeadline: toDeadlineIso(formState.skeapDeadline),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings.");
      }
      window.dispatchEvent(
        new CustomEvent("admin-profile-updated", {
          detail: { fullName: formState.fullName, email: formState.email },
        })
      );
      setStatusMessage("Your settings are saved and up to date.");
      const nextState = { ...formState, newPassword: "", confirmPassword: "" };
      setFormState(nextState);
      setSavedState(nextState);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FBFF]">
      <main className="mx-auto max-w-5xl px-4 pb-8 sm:px-6">
        <header className="border-b border-slate-200 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#0F3D5C]">{dateLabel}</p>
          <h1 className="mt-3 text-3xl font-black text-slate-950 sm:text-4xl">SK Official settings</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
            Manage your account details, security, alerts, and SKEAP reminders.
          </p>
        </header>

        {errorMessage ? (
          <div role="alert" className="mt-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {errorMessage}
          </div>
        ) : null}
        {statusMessage ? (
          <div
            role="status"
            aria-live="polite"
            className="fixed bottom-6 right-6 z-50 flex max-w-sm items-center gap-3 rounded-xl border border-slate-200 border-l-4 border-l-emerald-500 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-lg"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
            <span>{statusMessage}</span>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} aria-busy={loading || saving} className="divide-y divide-slate-200">
          <section className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Admin profile</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Your official SK contact details for portal access and communications.
              </p>
            </div>
            <div className="flex flex-col gap-5 md:col-span-2">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                  Full name
                  <input
                    value={formState.fullName}
                    onChange={(event) => handleChange("fullName", event.target.value)}
                    placeholder="Juan Dela Cruz"
                    disabled={loading}
                    className={`${INPUT_CLASSES} disabled:opacity-60`}
                  />
                </label>
                <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                  Email address
                  <input
                    type="email"
                    value={formState.email}
                    onChange={(event) => handleChange("email", event.target.value)}
                    placeholder="sk.official@barangaypico.gov.ph"
                    disabled={loading}
                    className={`${INPUT_CLASSES} disabled:opacity-60`}
                  />
                </label>
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Security</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Leave password fields blank to keep your current password.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 md:col-span-2">
              <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                Current password
                <input
                  type="password"
                  value={formState.currentPassword}
                  onChange={(event) => handleChange("currentPassword", event.target.value)}
                  disabled={loading}
                  className={`${INPUT_CLASSES} disabled:opacity-60`}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                New password
                <input
                  type="password"
                  value={formState.newPassword}
                  onChange={(event) => handleChange("newPassword", event.target.value)}
                  disabled={loading}
                  className={`${INPUT_CLASSES} disabled:opacity-60`}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                Confirm password
                <input
                  type="password"
                  value={formState.confirmPassword}
                  onChange={(event) => handleChange("confirmPassword", event.target.value)}
                  disabled={loading}
                  className={`${INPUT_CLASSES} disabled:opacity-60`}
                />
              </label>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Essential alerts</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Choose which important updates you receive.
              </p>
            </div>
            <div className="flex flex-col gap-3 md:col-span-2">
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700">New inquiry notifications</span>
                <span className="relative inline-flex shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={formState.inquiryAlerts}
                    onChange={(event) => handleChange("inquiryAlerts", event.target.checked)}
                    disabled={loading}
                    className="peer sr-only"
                  />
                  <span aria-hidden="true" className="h-6 w-11 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-transform peer-checked:bg-cyan-600 peer-checked:after:translate-x-5 peer-checked:after:border-white peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-100 peer-disabled:opacity-50" />
                </span>
              </label>
              <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:bg-slate-50">
                <span className="text-sm font-medium text-slate-700">Pending submission notifications</span>
                <span className="relative inline-flex shrink-0 items-center">
                  <input
                    type="checkbox"
                    checked={formState.submissionAlerts}
                    onChange={(event) => handleChange("submissionAlerts", event.target.checked)}
                    disabled={loading}
                    className="peer sr-only"
                  />
                  <span aria-hidden="true" className="h-6 w-11 rounded-full bg-slate-200 transition-colors after:absolute after:left-0.5 after:top-0.5 after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-transform peer-checked:bg-cyan-600 peer-checked:after:translate-x-5 peer-checked:after:border-white peer-focus-visible:outline-none peer-focus-visible:ring-4 peer-focus-visible:ring-cyan-100 peer-disabled:opacity-50" />
                </span>
              </label>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-8 py-8 md:grid-cols-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Reminder settings</h2>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Configure automatic reminders for the SKEAP submission deadline.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 md:col-span-2">
              <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                SKEAP submission deadline
                <input
                  type="datetime-local"
                  value={formState.skeapDeadline}
                  onChange={(event) => handleChange("skeapDeadline", event.target.value)}
                  disabled={loading}
                  className={`${INPUT_CLASSES} disabled:opacity-60`}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-xs font-bold text-slate-700">
                SKEAP reminder offsets
                <input
                  value={formState.skeapReminderOffsets}
                  onChange={(event) => handleChange("skeapReminderOffsets", event.target.value)}
                  placeholder="7, 3, 1"
                  disabled={loading}
                  className={`${INPUT_CLASSES} disabled:opacity-60`}
                />
                <span className="text-xs font-normal text-slate-500">Days before the deadline, separated by commas.</span>
              </label>
            </div>
          </section>

          <footer className="sticky bottom-0 z-10 -mx-4 mt-8 border-t border-slate-200 bg-slate-50/90 px-4 py-4 backdrop-blur-md sm:-mx-6 sm:px-6">
            <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
              <span className="text-sm text-slate-500" aria-live="polite">
                {loading ? "Loading settings..." : saving ? "Saving changes..." : hasUnsavedChanges ? "Unsaved changes" : "All changes saved"}
              </span>
              <button
                type="submit"
                disabled={saving || loading || !hasUnsavedChanges}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-600 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                {saving ? "Saving..." : "Save settings"}
              </button>
            </div>
          </footer>
        </form>
      </main>
    </div>
  );
}
