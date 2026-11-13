"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2 } from "lucide-react";

type Props = {
  open: boolean;
  signedIn: boolean;
  existingAccount: boolean;
  successCredentials: { username: string; temporaryPassword: string } | null;
  onClose: () => void;
};

export default function KkProfilingSuccessInterstitial({
  open,
  signedIn,
  existingAccount,
  successCredentials,
  onClose,
}: Props) {
  const router = useRouter();
  const [credentialsCopied, setCredentialsCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

  if (!open) return null;

  const continueTo = (destination: string) => {
    onClose();
    router.push(
      signedIn ? destination : `/login?next=${encodeURIComponent(destination)}`,
    );
  };

  const copyTemporaryPassword = async () => {
    if (!successCredentials) return;

    try {
      await navigator.clipboard.writeText(successCredentials.temporaryPassword);
      setCredentialsCopied(true);
      setCopyError(null);
    } catch {
      setCopyError("Unable to copy the temporary password. Select and copy it manually.");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/70 px-4 py-6">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="kk-profiling-success-title"
        className="my-auto w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl ring-1 ring-slate-200 sm:p-8"
      >
        <div className="flex flex-col items-center gap-5 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
          </div>
          <div>
            <h2
              id="kk-profiling-success-title"
              className="text-2xl font-bold text-slate-900 sm:text-3xl"
            >
              KK Profile Submitted Successfully!
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">
              Thank you for registering with the Katipunan ng Kabataan of Barangay Pico.
            </p>
          </div>
        </div>

        {successCredentials ? (
          <div className="mt-6 w-full rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700">
            <p className="font-semibold text-slate-900">Your default account credentials</p>
            <div className="mt-3 grid gap-2">
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                <span className="text-slate-600">Email</span>
                <span className="break-all font-medium text-slate-900">{successCredentials.username}</span>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                <span className="shrink-0 text-slate-600">Temporary password</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span className="min-w-0 break-all text-right font-medium text-slate-900">
                    {successCredentials.temporaryPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => void copyTemporaryPassword()}
                    className="shrink-0 rounded-lg border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    {credentialsCopied ? "Copied" : "Copy"}
                  </button>
                </span>
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Keep these credentials private. Secure your account after signing in.
            </p>
            {copyError ? (
              <p role="alert" className="mt-2 text-xs text-rose-700">
                {copyError}
              </p>
            ) : null}
          </div>
        ) : null}

        {!signedIn ? (
          <p className="mt-5 text-center text-sm text-slate-600">
            {existingAccount
              ? "An account already exists for this email. Sign in with your current password to continue."
              : "Your registration is complete. Sign in to continue to your next step."}
          </p>
        ) : null}

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => continueTo("/programs/skeap-scholarship?openApply=1")}
            className="inline-flex min-h-12 items-center justify-center rounded-xl bg-[#0F3D5C] px-4 py-3 text-center text-sm font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2"
          >
            Apply for SKEAP Scholarship
          </button>
          <button
            type="button"
            onClick={() => continueTo("/youth-dashboard")}
            className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            Go to My Dashboard
          </button>
        </div>

        {!signedIn ? (
          <p className="mt-5 text-center text-sm text-slate-600">
            Forgot your password?{" "}
            <Link
              href="/forgot-password"
              className="font-semibold text-[#0F3D5C] underline-offset-4 hover:underline"
              onClick={onClose}
            >
              Reset it
            </Link>
          </p>
        ) : null}
      </section>
    </div>
  );
}
