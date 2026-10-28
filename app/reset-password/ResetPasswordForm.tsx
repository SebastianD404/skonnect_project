"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AlertCircle, ArrowRight, CheckCircle2, Eye, EyeOff, LockKeyhole, ShieldCheck } from "lucide-react";
import { resetPassword } from "@/app/actions/auth";
import { SkLogo } from "@/app/components/SkLogo";

export default function ResetPasswordForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(resetPassword, null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    if (!state?.redirectTo) return;

    const timer = window.setTimeout(() => {
      router.replace(state.redirectTo!);
      router.refresh();
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [router, state?.redirectTo]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,61,92,0.08),_transparent_35%),linear-gradient(180deg,#f7f9fc_0%,#f4f7fb_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col items-center justify-center gap-8">
        <div className="flex items-center gap-3 text-left">
          <SkLogo className="h-12 w-12" />
          <div>
            <div className="text-xl font-semibold tracking-tight text-[#0D2E47]">SKonnect</div>
            <div className="text-sm text-slate-500">Barangay Pico Youth Services Portal</div>
          </div>
        </div>

        <section className="w-full max-w-[430px] rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_28px_70px_rgba(15,61,92,0.10)] sm:p-8">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0D2E47]">Choose a new password</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Use at least 8 characters, including uppercase, lowercase, and a number.
            </p>
          </div>

          {state?.redirectTo ? (
            <div
              role="status"
              aria-live="polite"
              className="mt-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm text-emerald-800"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden="true" />
              <span className="flex-1 font-medium">Password updated successfully.</span>
              <span className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-emerald-700/25 border-t-emerald-700" aria-label="Redirecting" />
              <span className="sr-only">Redirecting to your account.</span>
            </div>
          ) : null}

          <form action={formAction} className="mt-6 space-y-5">
            {state?.error ? (
              <p role="alert" className="flex items-start gap-1.5 text-xs leading-4 text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {state.error}
              </p>
            ) : null}

            <fieldset disabled={pending || Boolean(state?.redirectTo)} className="space-y-5 disabled:opacity-70">
            <div>
              <label htmlFor="new-password" className="mb-2 block text-sm font-semibold text-slate-800">
                New password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="new-password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm outline-none transition focus:border-[#0F3D5C] focus:bg-white focus:ring-4 focus:ring-[#0F3D5C]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 hover:bg-slate-100"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirm-new-password" className="mb-2 block text-sm font-semibold text-slate-800">
                Confirm new password
              </label>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="confirm-new-password"
                  name="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm outline-none transition focus:border-[#0F3D5C] focus:bg-white focus:ring-4 focus:ring-[#0F3D5C]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((visible) => !visible)}
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-500 hover:bg-slate-100"
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={pending || Boolean(state?.redirectTo)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F3D5C] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,61,92,0.18)] transition hover:bg-[#0D2E47] disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                  Updating password...
                </>
              ) : state?.redirectTo ? (
                "Password updated"
              ) : (
                <>Update password <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
            </fieldset>

            <p className="text-center text-sm text-slate-500">
              <Link href="/login" className="font-semibold text-[#0F3D5C] hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        </section>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4" />
          Secure, encrypted password update
        </div>
      </div>
    </main>
  );
}
