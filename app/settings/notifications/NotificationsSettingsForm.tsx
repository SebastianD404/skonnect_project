"use client";

import { useEffect, useState } from "react";
import FloatingFeedback from "@/app/components/FloatingFeedback";

type NotificationPreferences = {
  emailAlerts: boolean;
};

const defaultPreferences: NotificationPreferences = {
  emailAlerts: true,
};

export default function NotificationsSettingsForm() {
  const [preferences, setPreferences] = useState(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    let active = true;
    async function loadPreferences() {
      try {
        const response = await fetch("/api/my/notification-preferences", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to load notification preferences.");
        }
        if (active && typeof data?.emailNotifications === "boolean") {
          setPreferences({ emailAlerts: data.emailNotifications });
        }
      } catch (error) {
        if (active) {
          setFeedback({
            message: error instanceof Error ? error.message : "Unable to load notification preferences.",
            type: "error",
          });
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }

    void loadPreferences();

    return () => {
      active = false;
    };
  }, []);

  async function updateEmailPreference() {
    if (isSaving || isLoading) return;
    setIsSaving(true);
    setFeedback(null);
    const previousPreference = preferences.emailAlerts;
    const nextPreference = !previousPreference;
    setPreferences({ emailAlerts: nextPreference });

    try {
      const response = await fetch("/api/my/notification-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailNotifications: nextPreference }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Unable to update notification preferences.");
      }
      setFeedback({ message: "Notification preferences updated.", type: "success" });
    } catch (error) {
      setPreferences({ emailAlerts: previousPreference });
      setFeedback({
        message: error instanceof Error ? error.message : "Unable to update notification preferences.",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="flex-1 p-6 md:p-8">
      {feedback ? (
        <FloatingFeedback
          message={feedback.message}
          type={feedback.type}
          onDismiss={() => setFeedback(null)}
        />
      ) : null}
      <div className="flex flex-col gap-8">
        <section className="border-b border-slate-100 pb-6">
          <h3 className="mb-1 text-sm font-bold text-slate-900">In-App Notifications</h3>
          <p className="mb-5 text-xs text-slate-500">Core portal updates remain active so important grant information is never missed.</p>
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <p className="text-sm font-semibold text-slate-900">Portal notifications</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">Document reviews, assembly schedules, and direct messages.</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">Critical grant updates cannot be disabled in the portal.</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-[10px] font-bold uppercase text-slate-400">Required</span>
              <input type="checkbox" checked disabled aria-label="In-app notifications are required" className="h-5 w-5 accent-[#0F3D5C]" />
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-1 text-sm font-bold text-slate-900">Email Notifications</h3>
          <p className="mb-5 text-xs text-slate-500">Choose whether urgent portal updates should also arrive by email.</p>
          <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-6">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Receive email copies of urgent updates, document reviews, and assembly notices</p>
            </div>
            <div className="flex-shrink-0">
              <button
                type="button"
                role="switch"
                aria-checked={preferences.emailAlerts}
                aria-label="Receive email copies of urgent updates"
                disabled={isLoading || isSaving}
                onClick={() => void updateEmailPreference()}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center overflow-hidden rounded-full border-2 border-transparent p-0 transition-colors duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-60 ${preferences.emailAlerts ? "bg-[#0F3D5C]" : "bg-slate-300"}`}
              >
                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${preferences.emailAlerts ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
