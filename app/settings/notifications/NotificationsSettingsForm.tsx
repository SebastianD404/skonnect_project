"use client";

import { useEffect, useState } from "react";

type NotificationPreferences = {
  emailAlerts: boolean;
};

const defaultPreferences: NotificationPreferences = {
  emailAlerts: true,
};

export default function NotificationsSettingsForm() {
  const [preferences, setPreferences] = useState(defaultPreferences);

  useEffect(() => {
    let active = true;
    fetch("/api/my/notification-preferences", { cache: "no-store" })
      .then((response) => response.ok ? response.json() : null)
      .then((data) => {
        if (active && typeof data?.emailNotifications === "boolean") {
          setPreferences({ emailAlerts: data.emailNotifications });
        }
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, []);

  function updateEmailPreference() {
    setPreferences((current) => {
      const next = { ...current, emailAlerts: !current.emailAlerts };
      void fetch("/api/my/notification-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: next.emailAlerts }),
      }).catch(() => undefined);
      return next;
    });
  }

  return (
    <div className="max-w-2xl space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-bold text-[#0F3D5C]">In-App Notifications</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Core portal updates remain active so important grant information is never missed.</p>
        <div className="mt-6 flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm font-semibold text-slate-900">Portal notifications</p>
            <p className="mt-1 text-sm leading-5 text-slate-500">Document reviews, assembly schedules, and direct messages.</p>
            <p className="mt-2 text-xs leading-5 text-slate-500">Critical grant updates cannot be disabled in the portal.</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">Required</span>
            <input type="checkbox" checked disabled aria-label="In-app notifications are required" className="h-5 w-5 accent-[#0F3D5C]" />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-xl font-bold text-[#0F3D5C]">Email Notifications</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Choose whether urgent portal updates should also arrive by email.</p>
        <div className="mt-6 flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-slate-900">Receive email copies of urgent updates, document reviews, and assembly notices</p>
          </div>
          <div className="flex-shrink-0">
            <button
              type="button"
              role="switch"
              aria-checked={preferences.emailAlerts}
              aria-label="Receive email copies of urgent updates"
              onClick={updateEmailPreference}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center overflow-hidden rounded-full border-2 border-transparent p-0 transition-colors duration-200 ease-in-out ${preferences.emailAlerts ? "bg-[#0F3D5C]" : "bg-slate-300"}`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${preferences.emailAlerts ? "translate-x-5" : "translate-x-0"}`} />
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
