"use client";

import { useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useActionState } from "react";
import { secureAccount } from "./actions";

export default function SecureAccountForm({
  suggestedUsername,
  redirect,
  redirectLabel,
}: {
  suggestedUsername: string;
  redirect?: string | null;
  redirectLabel?: string | null;
}) {
  const [state, formAction, pending] = useActionState(secureAccount, null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const continuationText = redirectLabel
    ? `You requested access to ${redirectLabel}. Secure your account now, and we will return you there automatically.`
    : "Your KK profile account was created with a temporary credential. Set your permanent username and password to continue.";

  const usernamePattern = "^(?:[a-zA-Z0-9._-]+|[^\\s@]+@[^\\s@]+\\.[^\\s@]+)$";
  const errorMessage = state?.error;
  const passwordChecks = [
    { label: "8+ characters", met: password.length >= 8 },
    { label: "One lowercase letter", met: /[a-z]/.test(password) },
    { label: "One uppercase letter", met: /[A-Z]/.test(password) },
    { label: "One number", met: /\d/.test(password) },
  ];
  const matchedChecks = passwordChecks.filter((check) => check.met).length;
  const passwordStrengthLabel =
    matchedChecks <= 1 ? "Needs work" : matchedChecks === 2 ? "Getting there" : matchedChecks === 3 ? "Strong" : "Excellent";
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(15,61,92,0.10),_transparent_32%),linear-gradient(180deg,#f8fbff_0%,#f6f9fc_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-2 sm:px-6 lg:px-8 lg:py-3">
        <main className="flex flex-1 items-start pt-8 pb-4 lg:pt-10 lg:pb-6">
          <div className="grid w-full gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:items-start xl:gap-14">
            <section className="max-w-xl self-center pb-2 lg:pb-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.28em] text-sky-600 shadow-sm">
                <ShieldCheck className="h-4 w-4" />
                First login security check
              </div>

              <h1 className="mt-6 max-w-lg text-4xl leading-tight text-[#0D2E47] sm:text-5xl lg:text-[3.6rem] lg:leading-[1.02]" style={{ fontFamily: 'Georgia, Cambria, "Times New Roman", serif' }}>
                Secure your account.
              </h1>

              <p className="mt-5 max-w-xl text-base leading-8 text-slate-600 sm:text-lg">
                {continuationText}
              </p>

              <div className="mt-10 space-y-4">
                <div className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-[0_12px_36px_rgba(15,61,92,0.05)] backdrop-blur-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0F3D5C] shadow-sm">
                    <UserRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Choose a memorable username</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Letters, numbers, dot, underscore, and dash, or a valid email.</p>
                  </div>
                </div>

                <div className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-[0_12px_36px_rgba(15,61,92,0.05)] backdrop-blur-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0F3D5C] shadow-sm">
                    <LockKeyhole className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Use a strong password</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">At least 8 characters, mixing upper, lower case, and a number.</p>
                  </div>
                </div>

                <div className="flex gap-4 rounded-2xl border border-slate-200/80 bg-white/75 p-4 shadow-[0_12px_36px_rgba(15,61,92,0.05)] backdrop-blur-sm">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-[#0F3D5C] shadow-sm">
                    <KeyRound className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">Keep it private</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">SKonnect staff will never ask you to share your password.</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="rounded-[2rem] border border-slate-200/80 bg-white p-6 shadow-[0_24px_70px_rgba(15,61,92,0.10)] sm:p-8">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900">Account credentials</h2>
                  <p className="mt-1 text-sm text-slate-500">Set your permanent login details.</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-500">
                  Step 1 of 1
                </div>
              </div>

              {errorMessage ? (
                <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-950 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                      <AlertTriangle className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-rose-950">We couldn’t save your credentials</p>
                      <p className="mt-1 text-sm leading-6 text-rose-900/85">{errorMessage}</p>
                    </div>
                  </div>
                </div>
              ) : null}

              <form action={formAction} className="mt-6 space-y-5">
                {redirect ? <input type="hidden" name="redirect" value={redirect} /> : null}

                <div>
                  <label htmlFor="username" className="text-sm font-semibold text-slate-900">
                    New username
                  </label>
                  <div className="relative mt-2">
                    <UserRound className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="username"
                      name="username"
                      defaultValue={suggestedUsername}
                      required
                      pattern={usernamePattern}
                      title="Use letters, numbers, dots, underscores, dashes, or a valid email address."
                      autoComplete="username"
                      className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0F3D5C] focus:bg-white focus:ring-4 focus:ring-[#0F3D5C]/10"
                    />
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    You can use a regular username or a valid email address.
                  </p>
                </div>

                <div>
                  <label htmlFor="password" className="text-sm font-semibold text-slate-900">
                    New password
                  </label>
                  <div className="relative mt-2">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="At least 8 characters"
                      className="secure-account-password w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0F3D5C] focus:bg-white focus:ring-4 focus:ring-[#0F3D5C]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                      <span>Password strength</span>
                      <span className="text-slate-700">{passwordStrengthLabel}</span>
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-2">
                      {passwordChecks.map((check, index) => (
                        <div
                          key={check.label}
                          className={`h-1.5 rounded-full transition ${index < matchedChecks ? "bg-[#0F3D5C]" : "bg-slate-200"}`}
                        />
                      ))}
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {passwordChecks.map((check) => (
                        <div key={check.label} className="flex items-center gap-2 text-xs text-slate-500">
                          <CheckCircle2 className={`h-4 w-4 ${check.met ? "text-emerald-500" : "text-slate-300"}`} />
                          <span className={check.met ? "text-slate-700" : "text-slate-500"}>{check.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <label htmlFor="confirmPassword" className="text-sm font-semibold text-slate-900">
                    Confirm password
                  </label>
                  <div className="relative mt-2">
                    <LockKeyhole className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      id="confirmPassword"
                      name="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      required
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      autoComplete="new-password"
                      placeholder="Repeat the password"
                      className="secure-account-password w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0F3D5C] focus:bg-white focus:ring-4 focus:ring-[#0F3D5C]/10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                      aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 ? (
                    <p className={`mt-2 text-xs ${passwordsMatch ? "text-emerald-600" : "text-rose-600"}`}>
                      {passwordsMatch ? "Passwords match." : "Passwords do not match yet."}
                    </p>
                  ) : null}
                </div>

                <button
                  type="submit"
                  disabled={pending}
                  className="w-full rounded-2xl bg-[#0F3D5C] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_16px_30px_rgba(15,61,92,0.22)] transition hover:bg-[#0D2E47] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {pending ? "Saving..." : "Save credentials"}
                </button>
              </form>

              {redirect ? (
                <p className="mt-4 text-center text-xs leading-5 text-slate-500">
                  After saving, you&apos;ll be redirected to continue your application.
                </p>
              ) : null}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
