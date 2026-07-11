"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, History, Mail, Send, Search } from "lucide-react";

type InquiryHistoryItem = {
  id: string;
  subject: string;
  createdAt: string;
  isResolved: boolean;
  response: string | null;
};

function InquiryHistoryModal({
  inquiries,
  isLoading,
  onClose,
}: {
  inquiries: InquiryHistoryItem[];
  isLoading: boolean;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState("");
  const normalized = searchTerm.trim().toLowerCase();
  const filtered = normalized
    ? inquiries.filter((i) => i.subject.toLowerCase().includes(normalized))
    : inquiries;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Inquiry history"
      className="fixed inset-0 z-50 flex min-h-screen items-center justify-center overflow-auto bg-black/40 p-6"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Inquiry history</p>
            <h3 className="mt-2 text-xl font-semibold text-slate-900">Your recent support requests</h3>
          </div>
          <button
            aria-label="Close history"
            onClick={onClose}
            className="rounded-full bg-slate-100 p-2 text-slate-700 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="mt-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search your requests"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm text-slate-900 outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              />
            </div>
            <button
              onClick={() => setSearchTerm("")}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-100 px-3 py-2 text-sm text-slate-700 hover:bg-slate-200"
            >
              Clear
            </button>
          </div>

          <div className="mt-4 max-h-[65vh] overflow-auto">
            {isLoading ? (
              <div className="text-sm text-slate-500">Loading your inquiry history...</div>
            ) : filtered.length === 0 ? (
              <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm text-slate-600">No inquiries match your search.</div>
            ) : (
              <div className="space-y-4">
                {filtered.map((inquiry) => (
                  <div key={inquiry.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">{inquiry.subject}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {new Date(inquiry.createdAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                      </div>
                      <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${inquiry.isResolved ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {inquiry.isResolved ? "Resolved" : "Open"}
                      </span>
                    </div>
                    {inquiry.response ? (
                      <div className="mt-4 rounded-2xl bg-white p-3 text-sm text-slate-700 shadow-sm">
                        <p className="font-semibold text-slate-900">Admin response</p>
                        <p className="mt-1 whitespace-pre-wrap">{inquiry.response}</p>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ContactSupportPage() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<InquiryHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    async function loadHistory() {
      setIsLoadingHistory(true);
      try {
        const result = await fetch("/api/my/inquiries");
        const data = await result.json();
        const filtered = (data.inquiries ?? []).filter((item: any) => !/skeap application/i.test(item.subject));
        setInquiries(filtered);
      } catch {
        setInquiries([]);
      } finally {
        setIsLoadingHistory(false);
      }
    }

    loadHistory();
  }, []);

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ subject: subject.trim(), message: message.trim() }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? "Failed to send inquiry.");
      }

      router.push("/grantee-dashboard?alert=inquiry-submitted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send inquiry.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="px-6 pb-20 pt-12">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="flex items-start gap-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-3xl bg-sky-50 text-sky-700">
            <Mail className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Contact support</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">Ask SK officials for help</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Send a direct message to the SK team. Your request will be recorded as an inquiry and visible in the admin inbox.
            </p>
          </div>
        </div>
      </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="subject" className="text-sm font-medium text-slate-700">
              Subject
            </label>
            <input
              id="subject"
              name="subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              placeholder="What do you need help with?"
            />
          </div>

          <div>
            <label htmlFor="message" className="text-sm font-medium text-slate-700">
              Message
            </label>
            <textarea
              id="message"
              name="message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
              rows={6}
              className="mt-2 block w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
              placeholder="Describe your question or issue for the SK officials."
            />
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setShowHistory(true)}
              aria-label="Open inquiry history"
              className="inline-flex items-center gap-2 rounded-full bg-slate-100 p-3 text-sm font-medium text-slate-700 hover:bg-slate-200"
            >
              <History className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-3">
              <a href="/grantee-dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50">
                Cancel
              </a>
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-500"
              >
                <Send className="h-4 w-4" />
                {isSubmitting ? "Sending…" : "Send inquiry"}
              </button>
            </div>
          </div>
        </form>

        <div className="mt-10 rounded-3xl bg-slate-50 p-5 text-sm text-slate-600">
          <p className="font-semibold text-slate-900">What happens next?</p>
          <ul className="mt-3 space-y-2 list-disc pl-5">
            <li>Your message is saved as an inquiry for SK admins.</li>
            <li>Admins can reply and resolve it from the inquiry dashboard.</li>
            <li>Use this for support questions, issue reports, or account help.</li>
          </ul>
        </div>

        {showHistory && (
          <InquiryHistoryModal inquiries={inquiries} isLoading={isLoadingHistory} onClose={() => setShowHistory(false)} />
        )}
      </div>
    </main>
  );
}
