"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail, Send } from "lucide-react";

type SupportRequestFormProps = {
  dashboardPath: string;
  inboxPath: string;
};

export default function SupportRequestForm({ dashboardPath, inboxPath }: SupportRequestFormProps) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!subject.trim() || !message.trim()) {
      setError("Please fill out both fields.");
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Failed to send inquiry.");

      router.push(`${inboxPath}?inquiry=${result.inquiryId}&submitted=1`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to send inquiry.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="px-6 pb-20 pt-12">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <button type="button" onClick={() => router.back()} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="mt-8 flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-50 text-sky-700">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Contact support</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Ask SK officials for help</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Send a request to the SK team. Your inquiry and replies will stay together in Support Inbox.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

          <div>
            <label htmlFor="subject" className="text-sm font-medium text-slate-700">Subject</label>
            <input id="subject" name="subject" value={subject} onChange={(event) => setSubject(event.target.value)} required className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="What do you need help with?" />
          </div>

          <div>
            <label htmlFor="message" className="text-sm font-medium text-slate-700">Message</label>
            <textarea id="message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} required rows={6} className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200" placeholder="Describe your question or issue for the SK officials." />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-sm text-slate-500">Your inquiry will appear in Support Inbox.</span>
            <div className="flex items-center gap-3">
              <Link href={dashboardPath} className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">Cancel</Link>
              <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500">
                <Send className="h-4 w-4" />
                {isSubmitting ? "Sending..." : "Send inquiry"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-10 rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">What happens next?</p>
          <ul className="mt-3 list-disc space-y-2 pl-5">
            <li>Your message is saved as an inquiry for SK officials.</li>
            <li>Replies and follow-up messages stay in the same thread.</li>
            <li>You can track the status from Support Inbox.</li>
          </ul>
        </div>
      </div>
    </main>
  );
}
