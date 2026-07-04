"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
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

  const continuationText = redirectLabel
    ? `You requested access to ${redirectLabel}. Secure your account now, and we will return you there automatically.`
    : "Your KK profile account was created with a temporary credential. Set your permanent username and password to continue.";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0F2B44] to-slate-900 px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-xl rounded-3xl border border-slate-700/70 bg-slate-900/70 p-8 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">First Login Security Check</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Secure your account</h1>
        <p className="mt-3 text-sm text-slate-300">
          {continuationText}
        </p>

        {state?.error ? (
          <div className="mt-5 rounded-xl border border-rose-400/40 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
            {state.error}
          </div>
        ) : null}

        <form action={formAction} className="mt-6 space-y-4">
          {redirect ? <input type="hidden" name="redirect" value={redirect} /> : null}
          <div>
            <label htmlFor="username" className="text-sm font-medium text-slate-200">
              New username
            </label>
            <input
              id="username"
              name="username"
              defaultValue={suggestedUsername}
              required
              pattern="^[a-zA-Z0-9._-]+$"
              title="Only letters, numbers, dots, underscores, and dashes are allowed."
              autoComplete="username"
              className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 text-sm text-white outline-none ring-cyan-400/50 transition focus:ring-2"
            />
            <p className="mt-1 text-xs text-slate-400">
              Only letters, numbers, dot, underscore, and dash. Do not enter your email address here.
            </p>
          </div>

          <div>
            <label htmlFor="password" className="text-sm font-medium text-slate-200">
              New password
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 pr-10 text-sm text-white outline-none ring-cyan-400/50 transition focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-slate-400">Use at least 8 characters with uppercase, lowercase, and number.</p>
          </div>

          <div>
            <label htmlFor="confirmPassword" className="text-sm font-medium text-slate-200">
              Confirm password
            </label>
            <div className="relative mt-1">
              <input
                id="confirmPassword"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                className="w-full rounded-xl border border-slate-600 bg-slate-950/60 px-3 py-2 pr-10 text-sm text-white outline-none ring-cyan-400/50 transition focus:ring-2"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((value) => !value)}
                className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-slate-300 transition hover:bg-slate-800/80 hover:text-white"
                aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={pending}
            className="mt-2 w-full rounded-xl bg-cyan-500 px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {pending ? "Saving..." : "Save credentials"}
          </button>
        </form>
        {redirect ? (
          <p className="mt-3 text-xs text-slate-300">After saving, you'll be redirected to continue your application.</p>
        ) : null}
      </div>
    </div>
  );
}
