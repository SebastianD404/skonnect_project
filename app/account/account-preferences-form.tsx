"use client";

import { useEffect, useState } from "react";

type AccountPreferencesFormProps = {
  fullName: string;
  email: string;
  role: string;
  languagePref: string;
};

type ThemePreference = "system" | "light" | "dark";

function broadcastThemeUpdate(theme: ThemePreference) {
  window.dispatchEvent(new CustomEvent("skonnect-theme-updated", { detail: { theme } }));
}

function applyTheme(theme: ThemePreference) {
  const root = document.documentElement;
  const useDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  root.classList.toggle("dark", useDark);
  root.dataset.theme = useDark ? "dark" : theme;
  root.style.colorScheme = useDark ? "dark" : "light";
}

export function AccountPreferencesForm({ fullName, email, role, languagePref }: AccountPreferencesFormProps) {
  const [theme, setTheme] = useState<ThemePreference>("system");

  useEffect(() => {
    const storedTheme = (localStorage.getItem("skonnect-theme") as ThemePreference | null) || "system";
    setTheme(storedTheme);
    applyTheme(storedTheme);

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleSystemThemeChange = () => {
      if ((localStorage.getItem("skonnect-theme") as ThemePreference | null) === "system") {
        applyTheme("system");
        broadcastThemeUpdate("system");
      }
    };

    mediaQuery.addEventListener("change", handleSystemThemeChange);
    return () => mediaQuery.removeEventListener("change", handleSystemThemeChange);
  }, []);

  function handleThemeChange(nextTheme: ThemePreference) {
    setTheme(nextTheme);
    localStorage.setItem("skonnect-theme", nextTheme);
    applyTheme(nextTheme);
    broadcastThemeUpdate(nextTheme);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0F3D5C]">Current account</p>

        <div className="mt-6 space-y-4 rounded-3xl bg-slate-50 p-5 transition-colors dark:bg-slate-800/70">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Name</p>
            <p className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">{fullName}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Email</p>
            <p className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">{email}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Role</p>
            <p className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">{role}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">Language</p>
            <p className="mt-1 text-base font-semibold text-slate-800 dark:text-slate-100">{languagePref}</p>
          </div>
        </div>
      </section>

      <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-700 dark:bg-slate-900">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0F3D5C]">Appearance</p>
        <div className="mt-6 space-y-4">
          <ThemeOption
            title="System"
            description="Follow the device preference automatically."
            checked={theme === "system"}
            onClick={() => handleThemeChange("system")}
          />
          <ThemeOption
            title="Light"
            description="Keep the interface bright and readable."
            checked={theme === "light"}
            onClick={() => handleThemeChange("light")}
          />
          <ThemeOption
            title="Dark"
            description="Use a darker interface for low-light use."
            checked={theme === "dark"}
            onClick={() => handleThemeChange("dark")}
          />
        </div>

        <div className="mt-6 rounded-3xl border border-[#0F3D5C]/10 bg-gradient-to-r from-[#0F3D5C]/5 to-[#00B4E5]/5 p-5 text-sm text-slate-600 transition-colors dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Your theme choice is saved on this browser and applied immediately.
        </div>
      </section>
    </div>
  );
}

function ThemeOption({
  title,
  description,
  checked,
  onClick,
}: {
  title: string;
  description: string;
  checked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded-2xl border p-4 text-left transition ${checked ? "border-[#0F3D5C] bg-[#0F3D5C]/5" : "border-slate-200 bg-white hover:border-[#0F3D5C]/30"}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-[#0F3D5C]">{title}</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">{description}</p>
        </div>
        <span className={`mt-1 inline-flex h-5 w-5 items-center justify-center rounded-full border ${checked ? "border-[#0F3D5C] bg-[#0F3D5C]" : "border-slate-300 bg-white"}`}>
          {checked && <span className="h-2.5 w-2.5 rounded-full bg-white" />}
        </span>
      </div>
    </button>
  );
}