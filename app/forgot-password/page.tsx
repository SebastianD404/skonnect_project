"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import { SkLogo } from "@/app/components/SkLogo";

export default function ForgotPasswordPage() {
  const [state, formAction, pending] = useActionState(requestPasswordReset, null);
  const [email, setEmail] = useState("");

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
            <h1 className="text-3xl font-semibold tracking-tight text-[#0D2E47]">Forgot password?</h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Enter your account email and we&apos;ll send a secure recovery link if an account exists.
            </p>
          </div>

          <form action={formAction} className="mt-6 space-y-5">
            {state?.error ? (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-800">
                {state.error}
              </p>
            ) : null}
            {state?.message ? (
              <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3 text-sm leading-6 text-emerald-800">
                {state.message}
              </p>
            ) : null}

            <div>
              <label htmlFor="recovery-email" className="mb-2 block text-sm font-semibold text-slate-800">
                Email
              </label>
              <input
                id="recovery-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-[#0F3D5C] focus:bg-white focus:ring-4 focus:ring-[#0F3D5C]/10"
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0F3D5C] px-4 py-3.5 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,61,92,0.18)] transition hover:bg-[#0D2E47] disabled:cursor-wait disabled:opacity-70"
            >
              {pending ? "Sending..." : <>Send recovery link <ArrowRight className="h-4 w-4" /></>}
            </button>

            <p className="text-center text-sm text-slate-500">
              Remember your password?{" "}
              <Link href="/login" className="font-semibold text-[#0F3D5C] hover:underline">
                Back to sign in
              </Link>
            </p>
          </form>
        </section>

        <div className="flex items-center gap-2 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4" />
          Secure, encrypted account recovery
        </div>
      </div>
    </main>
  );
}
