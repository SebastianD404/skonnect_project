"use client";

import { Suspense, useState } from "react";
import { useActionState } from "react";
import { login } from "@/app/actions/auth";
import { useSearchParams } from "next/navigation";
type LoginContentProps = {};

function LoginForm() {
  const [state, formAction, submitting] = useActionState(login, null);
  const search = useSearchParams();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-sm border border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Log in to SKonnect</h1>
        <p className="text-sm text-slate-500 mb-6">
          SK Barangay Pico Youth Services Portal
        </p>

        {/* Confirm-email notification removed per request */}

        {/* Access-denied notification removed per request */}

        {state?.error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          {search.get("next") && <input type="hidden" name="next" value={search.get("next") ?? ""} />}
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white shadow-lg transition duration-200 ease-out hover:-translate-y-0.5 hover:bg-blue-700 active:scale-95 active:bg-blue-800 disabled:cursor-not-allowed disabled:bg-slate-400 disabled:opacity-80 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/25 border-t-white"></span>
                Signing in...
              </>
            ) : (
              "Log In"
            )}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Don&apos;t have an account?{" "}
          <a href={`/signup${search.get("next") ? `?next=${encodeURIComponent(search.get("next") ?? "")}` : ""}`} className="text-blue-600 font-medium hover:underline">
            Sign up
          </a>
        </p>
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