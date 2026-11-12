"use client";

import Link from "next/link";
import { LockKeyhole, X } from "lucide-react";

type AccountRequiredModalProps = {
  open: boolean;
  title: string;
  description: string;
  nextPath: string;
  onClose: () => void;
};

export default function AccountRequiredModal({
  open,
  title,
  description,
  nextPath,
  onClose,
}: AccountRequiredModalProps) {
  if (!open) return null;

  const encodedNextPath = encodeURIComponent(nextPath);

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default bg-slate-950/60 backdrop-blur-sm"
        aria-label="Close account required dialog"
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-required-title"
        aria-describedby="account-required-description"
        className="relative w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl"
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C]"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <div className="flex flex-row items-center gap-3">
          <div className="flex items-center justify-center rounded-xl bg-sky-50 p-2 text-[#0F3D5C]">
            <LockKeyhole className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 id="account-required-title" className="text-2xl font-bold tracking-tight text-slate-900">
            {title}
          </h2>
        </div>
        <p id="account-required-description" className="mt-3 text-sm leading-7 text-slate-600">
          {description}
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link
            href={`/signup?next=${encodedNextPath}`}
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-[#0F3D5C] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2"
          >
            Create Account
          </Link>
          <Link
            href={`/login?next=${encodedNextPath}`}
            onClick={onClose}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2"
          >
            Sign In
          </Link>
        </div>
      </section>
    </div>
  );
}
