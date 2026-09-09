"use client";

import { useActionState } from "react";
import { changePassword, type ProfileState } from "@/app/actions/profile";

const initialState: ProfileState = null;

export default function PasswordSecurityForm() {
  const [state, formAction, isPending] = useActionState(changePassword, initialState);

  return (
    <form action={formAction} className="max-w-2xl space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div>
        <h2 className="text-xl font-bold text-[#0F3D5C]">Password &amp; Security</h2>
        <p className="mt-1 text-sm leading-6 text-slate-500">Use a strong password to keep your account secure.</p>
      </div>
      <div>
        <label htmlFor="currentPassword" className="mb-2 block text-sm font-medium text-slate-700">Current password</label>
        <input id="currentPassword" name="currentPassword" type="password" autoComplete="current-password" required className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10" />
      </div>
      <div>
        <label htmlFor="newPassword" className="mb-2 block text-sm font-medium text-slate-700">New password</label>
        <input id="newPassword" name="newPassword" type="password" autoComplete="new-password" required className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10" />
      </div>
      <div>
        <label htmlFor="confirmPassword" className="mb-2 block text-sm font-medium text-slate-700">Confirm password</label>
        <input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required className="h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/10" />
      </div>
      {state?.error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">{state.error}</p>}
      {state?.message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{state.message}</p>}
      <button type="submit" disabled={isPending} className="rounded-xl bg-[#0F3D5C] px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60">
        {isPending ? "Updating..." : "Update Password"}
      </button>
    </form>
  );
}
