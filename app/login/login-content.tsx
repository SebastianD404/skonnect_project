"use client";

import { Suspense, useState } from "react";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail, Lock, ShieldCheck, ArrowRight } from "lucide-react";

function LoginForm() {
  const [state, formAction, submitting] = useActionState(login, null);
  const search = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const next = search.get("next") ?? "";
  const kkProfilingHref = `/programs/kk-profiling${next ? `?redirect=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,61,92,0.08),_transparent_35%),linear-gradient(180deg,#f7f9fc_0%,#f4f7fb_100%)] px-4 py-10 text-slate-900">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl flex-col items-center justify-center gap-8">
        <div className="flex items-center gap-3 text-left">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#0F3D5C] text-sm font-bold text-white shadow-[0_14px_28px_rgba(15,61,92,0.22)]">
            SK
          </div>
          <div>
            <div className="text-xl font-semibold tracking-tight text-[#0D2E47]">SKonnect</div>
            <div className="text-sm text-slate-500">Barangay Pico Youth Services Portal</div>
          </div>
        </div>

        <div className="w-full max-w-[430px] rounded-[2rem] border border-slate-200 bg-white p-7 shadow-[0_28px_70px_rgba(15,61,92,0.10)] sm:p-8">
          <div className="text-center">
            <h1 className="text-3xl font-semibold tracking-tight text-[#0D2E47]">Welcome back</h1>
            <p className="mt-2 text-sm text-slate-500">Sign in to access your SKonnect account</p>
          </div>

          {state?.error ? (
            <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {state.error}
            </div>
          ) : null}

          <form action={formAction} className="mt-6 space-y-5">
            {next ? <input type="hidden" name="next" value={next} /> : null}

            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-slate-800">
                Email
              </label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="you@example.com"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0F3D5C] focus:bg-white focus:ring-4 focus:ring-[#0F3D5C]/10"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-slate-800">
                Password
              </label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="Enter your password"
                  className="secure-login-password w-full rounded-2xl border border-slate-200 bg-slate-50 py-3.5 pl-11 pr-12 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#0F3D5C] focus:bg-white focus:ring-4 focus:ring-[#0F3D5C]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-2 text-slate-900 transition hover:bg-slate-100 hover:text-[#0F3D5C]"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between gap-4 text-sm">
              <label className="inline-flex items-center gap-2 text-slate-700">
                <input type="checkbox" name="remember" className="h-4 w-4 rounded border-slate-300 text-[#0F3D5C] focus:ring-[#0F3D5C]" />
                Remember me
              </label>
              <span className="font-medium text-[#14A9D6]">Forgot password?</span>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F3D5C] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,61,92,0.18)] transition hover:bg-[#0D2E47] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white" />
                  Signing in...
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-slate-300">
              <span className="h-px flex-1 bg-slate-200" />
              <span className="text-slate-400">or</span>
              <span className="h-px flex-1 bg-slate-200" />
            </div>

            <div className="text-center text-sm text-slate-500">
              Not yet profiled?{" "}
              <Link href={kkProfilingHref} className="font-semibold text-[#0F3D5C] hover:underline">
                Register via KK Profiling
              </Link>
            </div>
          </form>
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4" />
          Secure, encrypted login
        </div>
      </div>
    </div>
  );
}

export default function LoginContentWrapper() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center">Loading...</div>}>
      <LoginForm />
    </Suspense>
  );
}