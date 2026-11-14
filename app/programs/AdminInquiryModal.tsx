"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Send, X } from "lucide-react";
import { useAuth } from "@/app/components/AuthProvider";
import { OPEN_ADMIN_INQUIRY_EVENT } from "@/lib/program-support-events";

export default function AdminInquiryModal({
  subject,
  returnTo,
}: {
  subject: string;
  returnTo: string;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [subjectValue, setSubjectValue] = useState(subject);
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOpen = () => {
      setSubjectValue(subject);
      setMessage("");
      setError(null);
      setIsOpen(true);
    };
    window.addEventListener(OPEN_ADMIN_INQUIRY_EVENT, handleOpen);
    return () => window.removeEventListener(OPEN_ADMIN_INQUIRY_EVENT, handleOpen);
  }, [subject]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isSubmitting) setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isSubmitting]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedMessage = message.trim();
    if (!trimmedMessage) {
      setError("Enter your question for Barangay Pico SK officials.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subjectValue.trim(), message: trimmedMessage }),
      });
      const responseBody: unknown = await response.json();
      const result =
        typeof responseBody === "object" && responseBody !== null
          ? responseBody as Record<string, unknown>
          : {};
      if (!response.ok) {
        throw new Error(
          typeof result.error === "string" ? result.error : "Unable to send your inquiry.",
        );
      }

      const inquiryId =
        typeof result.id === "string"
          ? result.id
          : typeof result.inquiryId === "string"
            ? result.inquiryId
            : null;
      setIsOpen(false);
      setMessage("");
      router.push(
        inquiryId
          ? `/youth-dashboard/inquiries?inquiryId=${encodeURIComponent(inquiryId)}&submitted=1`
          : "/youth-dashboard/inquiries?submitted=1",
      );
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to send your inquiry.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isSubmitting) setIsOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-inquiry-title"
            className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
          >
            <header className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-700">
                  <Mail className="h-5 w-5" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Direct SK Admin Inquiry</p>
                  <h2 id="admin-inquiry-title" className="mt-1 text-lg font-bold text-slate-900">
                    Ask Barangay Pico SK officials
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                disabled={isSubmitting}
                aria-label="Close inquiry form"
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </header>

            {loading ? (
              <p className="mt-5 text-sm text-slate-600" role="status">Loading your account details…</p>
            ) : !user ? (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                Sign in to send an inquiry to SK officials.
                <Link
                  href={`/login?next=${encodeURIComponent(returnTo)}`}
                  className="ml-1 font-semibold underline underline-offset-2"
                >
                  Sign in
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Applicant</span>
                  <input
                    readOnly
                    value={user.fullName || ""}
                    className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Email</span>
                  <input
                    readOnly
                    type="email"
                    value={user.email || ""}
                    className="mt-1 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Subject</span>
                  <input
                    required
                    value={subjectValue}
                    onChange={(event) => setSubjectValue(event.target.value)}
                    disabled={isSubmitting}
                    className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
                  />
                </label>
                <label className="block">
                  <span className="text-xs font-medium text-slate-600">Your question</span>
                  <textarea
                    autoFocus
                    required
                    rows={5}
                    value={message}
                    onChange={(event) => setMessage(event.target.value)}
                    disabled={isSubmitting}
                    placeholder="Type your question for Barangay Pico SK officials."
                    className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-100 disabled:opacity-60"
                  />
                </label>
                {error ? <p role="alert" className="text-sm text-rose-700">{error}</p> : null}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    disabled={isSubmitting}
                    className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !subjectValue.trim() || !message.trim()}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" aria-hidden="true" />
                    {isSubmitting ? "Sending…" : "Send inquiry"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </div>
      ) : null}
    </>
  );
}
