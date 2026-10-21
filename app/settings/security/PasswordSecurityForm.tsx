"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Monitor } from "lucide-react";
import { changePassword, type ProfileState } from "@/app/actions/profile";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { createBrowserClient } from "@/lib/supabase/browser";

const initialState: ProfileState = null;

function detectDeviceInfo(userAgent: string) {
  let operatingSystem = "Unknown device";
  let browser = "Unknown browser";

  if (/iPhone|iPad|iPod/i.test(userAgent)) {
    operatingSystem = "iOS";
  } else if (/Android/i.test(userAgent)) {
    operatingSystem = "Android";
  } else if (/Windows/i.test(userAgent)) {
    operatingSystem = "Windows PC";
  } else if (/Macintosh|Mac OS X/i.test(userAgent)) {
    operatingSystem = "Mac";
  } else if (/Linux/i.test(userAgent)) {
    operatingSystem = "Linux";
  }

  if (/EdgA?|EdgiOS/i.test(userAgent)) {
    browser = "Edge";
  } else if (/OPR|Opera/i.test(userAgent)) {
    browser = "Opera";
  } else if (/CriOS|Chrome/i.test(userAgent)) {
    browser = "Chrome";
  } else if (/FxiOS|Firefox/i.test(userAgent)) {
    browser = "Firefox";
  } else if (/Safari/i.test(userAgent)) {
    browser = "Safari";
  }

  return `${operatingSystem} • ${browser}`;
}

export default function PasswordSecurityForm() {
  const [state, formAction, isPending] = useActionState(changePassword, initialState);
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [deviceInfo, setDeviceInfo] = useState("Detecting session...");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setDeviceInfo(detectDeviceInfo(navigator.userAgent));
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  async function handleLogout() {
    setIsLoggingOut(true);
    setFeedback(null);
    try {
      const supabase = createBrowserClient();
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "Unable to log out of this session.");
      setIsLoggingOut(false);
    }
  }

  return (
    <form action={formAction} onSubmit={() => setDismissedMessage(null)} className="flex flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-10 overflow-y-auto p-6 md:p-8">
        <section className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          <div className="md:col-span-1">
            <h3 className="text-sm font-bold text-slate-900">Change password</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Ensure your account uses a long, random password to stay secure.
            </p>
          </div>

          <div className="flex max-w-md flex-col gap-4 md:col-span-2">
            <div>
              <label htmlFor="currentPassword" className="mb-1.5 block text-xs font-semibold text-slate-700">Current password</label>
              <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" placeholder="Enter current password" required className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900 transition-colors focus:border-slate-900 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="newPassword" className="mb-1.5 block text-xs font-semibold text-slate-700">New password</label>
              <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" placeholder="Enter new password" required className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900 transition-colors focus:border-slate-900 focus:outline-none" />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="mb-1.5 block text-xs font-semibold text-slate-700">Confirm password</label>
              <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Confirm new password" required className="h-9 w-full rounded-lg border border-slate-200 px-3 text-xs text-slate-900 transition-colors focus:border-slate-900 focus:outline-none" />
            </div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">
              Use at least 8 characters, including uppercase and lowercase letters and a number.
            </p>
            {state?.error && state.error !== dismissedMessage ? <p role="alert" className="text-sm font-medium text-rose-600">{state.error}</p> : null}
            <div className="pt-2">
              <button type="submit" disabled={isPending} className="h-8 w-fit rounded-lg bg-slate-900 px-4 text-xs font-bold text-white shadow-2xs transition-all hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60">
                {isPending ? "Saving..." : "Save password"}
              </button>
            </div>
          </div>
        </section>

        <hr className="border-slate-100" />

        <section className="grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-8">
          <div className="md:col-span-1">
            <h3 className="text-sm font-bold text-slate-900">Active sessions</h3>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              View this browser session and sign out securely.
            </p>
          </div>

          <div className="md:col-span-2">
            <div className="flex max-w-md items-center justify-between gap-4 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
              <div className="flex items-center gap-3">
                <Monitor className="h-5 w-5 shrink-0 text-emerald-700" aria-hidden="true" />
                <div>
                  <h4 className="text-xs font-bold text-slate-900">{deviceInfo}</h4>
                  <p className="mt-0.5 text-[11px] text-slate-500">Currently signed-in session</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleLogout()}
                disabled={isLoggingOut}
                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
                {isLoggingOut ? "Logging out..." : "Log out"}
              </button>
            </div>
            {feedback ? <p role="alert" className="mt-3 text-sm font-medium text-rose-600">{feedback}</p> : null}
          </div>
        </section>
      </div>
      {state?.message && state.message !== dismissedMessage ? <FloatingFeedback message={state.message} type="success" onDismiss={() => setDismissedMessage(state.message ?? null)} /> : null}
    </form>
  );
}
