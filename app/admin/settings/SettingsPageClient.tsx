"use client";

import { useEffect, useState } from "react";
import { Mail, Lock, Bell, Save, ShieldCheck } from "lucide-react";

const DEFAULT_STATE = {
  fullName: "",
  email: "",
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
  inquiryAlerts: true,
  submissionAlerts: true,
};

export default function SettingsPageClient({ dateLabel }: { dateLabel: string }) {
  const [formState, setFormState] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
        setFormState((prev) => ({
          ...prev,
          fullName: data.fullName ?? prev.fullName,
          email: data.email ?? prev.email,
          inquiryAlerts: data.settings?.inquiryAlerts ?? prev.inquiryAlerts,
          submissionAlerts: data.settings?.submissionAlerts ?? prev.submissionAlerts,
        }));
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

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/admin-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formState),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to save settings.");
      }
      setStatusMessage("Settings saved successfully.");
      setFormState((prev) => ({ ...prev, newPassword: "", confirmPassword: "" }));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FBFF]">
      <div className="mx-auto max-w-[1480px] px-6 py-10">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="mb-10 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.35em] text-[#0F3D5C]">{dateLabel}</p>
              <h1 className="mt-3 text-4xl font-black text-slate-950">SK Official settings</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Manage the core SK official account settings and essential admin notifications.
              </p>
            </div>
          </div>

          <div className="grid gap-8 xl:grid-cols-[1.4fr_0.6fr]">
            <form onSubmit={handleSubmit} className="space-y-8">
              <div className="rounded-[1.75rem] border border-slate-200 bg-[#F8FAFF] p-6">
                <div className="flex items-center gap-3 text-[#0F3D5C]">
                  <Mail className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-semibold">Admin profile</p>
                    <p className="text-xs text-slate-500">Your official SK contact details for portal access.</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2 text-sm text-slate-700">
                    Full name
                    <input
                      value={formState.fullName}
                      onChange={(event) => handleChange("fullName", event.target.value)}
                      placeholder="Juan Dela Cruz"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    Email address
                    <input
                      type="email"
                      value={formState.email}
                      onChange={(event) => handleChange("email", event.target.value)}
                      placeholder="sk.official@barangaypico.gov.ph"
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 text-[#0F3D5C]">
                  <Lock className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-semibold">Security</p>
                    <p className="text-xs text-slate-500">Update your password to keep the admin portal secure.</p>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-3">
                  <label className="space-y-2 text-sm text-slate-700">
                    Current password
                    <input
                      type="password"
                      value={formState.currentPassword}
                      onChange={(event) => handleChange("currentPassword", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    New password
                    <input
                      type="password"
                      value={formState.newPassword}
                      onChange={(event) => handleChange("newPassword", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                    />
                  </label>
                  <label className="space-y-2 text-sm text-slate-700">
                    Confirm password
                    <input
                      type="password"
                      value={formState.confirmPassword}
                      onChange={(event) => handleChange("confirmPassword", event.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
                    />
                  </label>
                </div>
              </div>

              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center gap-3 text-[#0F3D5C]">
                  <Bell className="h-5 w-5" />
                  <div>
                    <p className="text-sm font-semibold">Essential alerts</p>
                    <p className="text-xs text-slate-500">Only the most important SK notifications.</p>
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <label className="flex cursor-pointer items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 transition hover:border-slate-300">
                    <input
                      type="checkbox"
                      checked={formState.inquiryAlerts}
                      onChange={(event) => handleChange("inquiryAlerts", event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0F3D5C] focus:ring-[#0F3D5C]"
                    />
                    <span>New inquiry notifications</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-4 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700 transition hover:border-slate-300">
                    <input
                      type="checkbox"
                      checked={formState.submissionAlerts}
                      onChange={(event) => handleChange("submissionAlerts", event.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 text-[#0F3D5C] focus:ring-[#0F3D5C]"
                    />
                    <span>Pending submission notifications</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col gap-3 rounded-[1.75rem] border border-slate-200 bg-[#F8FAFF] p-6 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-950">Save essential changes</p>
                  <p className="text-sm text-slate-500">This page only includes SK official admin settings.</p>
                </div>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-[#0F3D5C] px-5 py-3 text-sm font-semibold text-white shadow-md transition hover:bg-[#0D2E47] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save className="h-4 w-4" />
                  {saving ? "Saving..." : "Save settings"}
                </button>
              </div>

              {statusMessage ? (
                <div className="rounded-3xl border border-emerald-100 bg-emerald-50 px-5 py-4 text-sm text-emerald-800 shadow-sm">
                  {statusMessage}
                </div>
              ) : null}
            </form>

            <aside className="space-y-6 rounded-[1.75rem] border border-slate-200 bg-[#F8FAFF] p-6">
              <div className="flex items-center gap-3 text-[#0F3D5C]">
                <ShieldCheck className="h-5 w-5" />
                <div>
                  <p className="text-sm font-semibold">SK admin essentials</p>
                  <p className="text-xs text-slate-500">Only the fields needed for SK official administration.</p>
                </div>
              </div>
              <div className="space-y-3 text-sm leading-6 text-slate-600">
                <p>Keep your official name and email current for reliable admin communication.</p>
                <p>Use a strong password and update it regularly to protect barangay access.</p>
                <p>Enable only inquiry and submission alerts to stay focused on urgent admin tasks.</p>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
