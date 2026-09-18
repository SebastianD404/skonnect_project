"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock3, Inbox, Send } from "lucide-react";

type InquirySummary = {
  id: string;
  subject: string;
  createdAt: string;
  isResolved: boolean;
  response: string | null;
};

type ThreadMessage = {
  id: string;
  role: "admin" | "applicant";
  createdAt: string;
  text: string;
};

type InquiryDetail = InquirySummary & {
  message: string;
  thread: ThreadMessage[];
};

type SupportInboxClientProps = {
  basePath: string;
  initialInquiryId: string | null;
  showSubmittedToast: boolean;
};

function getStatus(inquiry: InquirySummary) {
  if (inquiry.isResolved) {
    return { label: "Resolved", className: "bg-slate-100 text-slate-700", icon: CheckCircle2 };
  }

  if (inquiry.response) {
    return { label: "Answered", className: "bg-emerald-100 text-emerald-800", icon: CheckCircle2 };
  }

  return { label: "Awaiting reply", className: "bg-amber-100 text-amber-800", icon: Clock3 };
}

export default function SupportInboxClient({ basePath, initialInquiryId, showSubmittedToast }: SupportInboxClientProps) {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);
  const [selectedId, setSelectedId] = useState(initialInquiryId);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryDetail | null>(null);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toastVisible, setToastVisible] = useState(showSubmittedToast);

  useEffect(() => {
    let active = true;

    async function loadInquiries() {
      setIsLoadingList(true);
      try {
        const response = await fetch("/api/my/inquiries", { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load inquiries.");
        if (!active) return;

        const nextInquiries = Array.isArray(data.inquiries) ? data.inquiries : [];
        setInquiries(nextInquiries);
        setSelectedId((current) => {
          if (current && nextInquiries.some((inquiry: InquirySummary) => inquiry.id === current)) return current;
          return nextInquiries[0]?.id ?? null;
        });
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load inquiries.");
      } finally {
        if (active) setIsLoadingList(false);
      }
    }

    void loadInquiries();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedId) return;

    let active = true;
    async function loadThread() {
      try {
        const response = await fetch(`/api/my/inquiries/${selectedId}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load inquiry.");
        if (active) setSelectedInquiry(data.inquiry ?? null);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : "Unable to load inquiry.");
      } finally {
        if (active) setIsLoadingThread(false);
      }
    }

    void loadThread();
    return () => {
      active = false;
    };
  }, [selectedId]);

  useEffect(() => {
    if (!toastVisible) return;
    const timeout = window.setTimeout(() => {
      setToastVisible(false);
      router.replace(selectedId ? `${basePath}/inquiries?inquiry=${selectedId}` : `${basePath}/inquiries`);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [basePath, router, selectedId, toastVisible]);

  function selectInquiry(id: string) {
    setSelectedInquiry(null);
    setIsLoadingThread(true);
    setError(null);
    setSelectedId(id);
    router.replace(`${basePath}/inquiries?inquiry=${id}`);
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !replyText.trim() || isSendingReply) return;

    setIsSendingReply(true);
    setError(null);
    try {
      const response = await fetch(`/api/my/inquiries/${selectedId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: replyText.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to send reply.");

      setSelectedInquiry((current) => current ? {
        ...current,
        message: replyText.trim(),
        response: null,
        isResolved: false,
        thread: [...current.thread, data.reply],
      } : current);
      setInquiries((current) => current.map((inquiry) => inquiry.id === selectedId ? { ...inquiry, response: null, isResolved: false } : inquiry));
      setReplyText("");
    } catch (replyError) {
      setError(replyError instanceof Error ? replyError.message : "Unable to send reply.");
    } finally {
      setIsSendingReply(false);
    }
  }

  return (
    <main className="px-6 pb-20 pt-10 lg:px-10 lg:pt-14">
      {toastVisible && (
        <div className="fixed right-6 top-24 z-50 rounded-2xl bg-emerald-700 px-4 py-3 text-sm font-semibold text-white shadow-xl" role="status">
          Inquiry submitted successfully.
        </div>
      )}

      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#0F3D5C]">Support inbox</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">My inquiries</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Track your support requests and continue the conversation with SK officials in one place.</p>
          </div>
          <Link href={`${basePath}/contact-support`} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#0F3D5C] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0D2E47]">
            <Send className="h-4 w-4" />
            New inquiry
          </Link>
        </div>

        {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid min-h-[560px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-[360px_1fr]">
          <aside className={`border-slate-200 bg-slate-50/70 lg:border-r ${selectedInquiry ? "hidden lg:block" : "block"}`}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Inbox className="h-4 w-4 text-[#0F3D5C]" />
                All inquiries
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{inquiries.length}</span>
              </div>
            </div>
            <div className="max-h-[620px] overflow-y-auto p-3">
              {isLoadingList ? (
                <p className="px-3 py-8 text-sm text-slate-500">Loading your inquiries...</p>
              ) : inquiries.length === 0 ? (
                <div className="px-3 py-10 text-center">
                  <Inbox className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-3 text-sm font-semibold text-slate-700">No inquiries yet</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">Your support requests will appear here.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {inquiries.map((inquiry) => {
                    const status = getStatus(inquiry);
                    const StatusIcon = status.icon;
                    return (
                      <button key={inquiry.id} type="button" onClick={() => selectInquiry(inquiry.id)} className={`w-full rounded-2xl p-4 text-left transition ${selectedId === inquiry.id ? "bg-white shadow-sm ring-1 ring-slate-200" : "hover:bg-white/80"}`}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="line-clamp-2 text-sm font-semibold text-slate-900">{inquiry.subject}</p>
                          <StatusIcon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                        </div>
                        <p className="mt-2 text-xs text-slate-500">{new Date(inquiry.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}</p>
                        <span className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}>{status.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>

          <section className={`${selectedInquiry ? "block" : "hidden lg:block"}`}>
            {isLoadingThread || (selectedId !== null && selectedInquiry?.id !== selectedId) ? (
              <div className="flex h-full min-h-[560px] items-center justify-center text-sm text-slate-500">Loading conversation...</div>
            ) : selectedInquiry ? (
              <div className="flex h-full min-h-[560px] flex-col">
                <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-5 sm:px-8">
                  <button type="button" onClick={() => { setSelectedInquiry(null); setSelectedId(null); router.replace(`${basePath}/inquiries`); }} className="mt-1 rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back to inquiries">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#0F3D5C]">Support conversation</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">{selectedInquiry.subject}</h2>
                    <p className="mt-1 text-xs text-slate-500">Submitted {new Date(selectedInquiry.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`ml-auto shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${getStatus(selectedInquiry).className}`}>{getStatus(selectedInquiry).label}</span>
                </div>

                <div className="flex-1 space-y-5 overflow-y-auto bg-slate-50/50 px-5 py-6 sm:px-8">
                  {selectedInquiry.thread.map((message) => (
                    <div key={message.id} className={`max-w-[90%] rounded-2xl p-4 ${message.role === "admin" ? "bg-white text-slate-800 shadow-sm ring-1 ring-slate-200" : "ml-auto bg-[#0F3D5C] text-white"}`}>
                      <p className="text-xs font-semibold uppercase tracking-wide opacity-70">{message.role === "admin" ? "SK officials" : "You"}</p>
                      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{message.text}</p>
                      <p className="mt-3 text-[11px] opacity-60">{new Date(message.createdAt).toLocaleString()}</p>
                    </div>
                  ))}
                </div>

                <form onSubmit={sendReply} className="border-t border-slate-200 bg-white px-5 py-4 sm:px-8">
                  <label htmlFor="inquiry-reply" className="sr-only">Reply to inquiry</label>
                  <textarea id="inquiry-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} rows={3} placeholder="Reply to SK officials..." disabled={isSendingReply} className="w-full resize-none rounded-2xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/15 disabled:bg-slate-50" />
                  <div className="mt-3 flex justify-end">
                    <button type="submit" disabled={isSendingReply || !replyText.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0D2E47] disabled:cursor-not-allowed disabled:opacity-50">
                      <Send className="h-4 w-4" />
                      {isSendingReply ? "Sending..." : "Send reply"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex h-full min-h-[560px] flex-col items-center justify-center px-6 text-center">
                <Inbox className="h-10 w-10 text-slate-300" />
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Select an inquiry</h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Choose a support request to view the conversation and reply to SK officials.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
