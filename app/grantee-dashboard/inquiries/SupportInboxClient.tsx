"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock3, Inbox, MessageSquarePlus, Send, Trash2, X } from "lucide-react";
import SupportRequestForm from "@/app/components/SupportRequestForm";

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

const INQUIRY_PAGE_SIZE = 15;

function getStatus(inquiry: InquirySummary) {
  if (inquiry.isResolved) {
    return {
      label: "Resolved",
      className: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: CheckCircle2,
    };
  }

  return {
    label: "Open",
    className: "bg-amber-50 text-amber-700 border-amber-200/80",
    icon: Clock3,
  };
}

export default function SupportInboxClient({ basePath, initialInquiryId, showSubmittedToast }: SupportInboxClientProps) {
  const router = useRouter();
  const [inquiries, setInquiries] = useState<InquirySummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState(initialInquiryId);
  const [selectedInquiry, setSelectedInquiry] = useState<InquiryDetail | null>(null);
  const conversationRef = useRef<HTMLDivElement>(null);
  const pollInquiriesRef = useRef<() => void>(() => {});
  const pollThreadRef = useRef<() => void>(() => {});
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectedForDelete, setSelectedForDelete] = useState<InquirySummary | null>(null);
  const [deletingInquiryIds, setDeletingInquiryIds] = useState<Set<string>>(new Set());
  const [deletedInquiryIds, setDeletedInquiryIds] = useState<Set<string>>(new Set());
  const [toastVisible, setToastVisible] = useState(showSubmittedToast);
  const [isNewInquiryModalOpen, setIsNewInquiryModalOpen] = useState(false);
  const newInquiryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isNewInquiryModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    const trigger = newInquiryButtonRef.current;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setIsNewInquiryModalOpen(false);
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
      trigger?.focus();
    };
  }, [isNewInquiryModalOpen]);

  useEffect(() => {
    let active = true;
    let hasLoadedInitially = false;
    let requestPending = false;

    async function loadInquiries() {
      if (requestPending) return;
      requestPending = true;
      if (!hasLoadedInitially) setIsLoadingList(true);
      try {
        const response = await fetch(`/api/my/inquiries?page=1&limit=${INQUIRY_PAGE_SIZE}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load inquiries.");
        if (!active) return;

        const nextInquiries = Array.isArray(data.inquiries) ? data.inquiries : [];
        setTotalCount(typeof data.totalCount === "number" ? data.totalCount : nextInquiries.length);
        setInquiries((current) => {
          const visibleInquiries = nextInquiries.filter((inquiry: InquirySummary) => !deletedInquiryIds.has(inquiry.id));
          const firstPageIds = new Set(visibleInquiries.map((inquiry: InquirySummary) => inquiry.id));
          return [
            ...visibleInquiries,
            ...current.filter((inquiry) => !deletedInquiryIds.has(inquiry.id) && !firstPageIds.has(inquiry.id)),
          ];
        });
        setSelectedId((selected) => selected ?? nextInquiries.find((inquiry: InquirySummary) => !deletedInquiryIds.has(inquiry.id))?.id ?? null);
      } catch (loadError) {
        if (active && !hasLoadedInitially) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load inquiries.");
        }
      } finally {
        requestPending = false;
        if (active && !hasLoadedInitially) {
          hasLoadedInitially = true;
          setIsLoadingList(false);
        }
      }
    }

    void loadInquiries();
    pollInquiriesRef.current = () => void loadInquiries();

    return () => {
      active = false;
      pollInquiriesRef.current = () => {};
    };
  }, [deletedInquiryIds]);

  async function loadMoreInquiries() {
    if (isLoadingMore || inquiries.length >= totalCount) return;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const nextPage = page + 1;
      const response = await fetch(`/api/my/inquiries?page=${nextPage}&limit=${INQUIRY_PAGE_SIZE}`, {
        cache: "no-store",
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to load older inquiries.");

      const nextInquiries: InquirySummary[] = Array.isArray(data.inquiries) ? data.inquiries : [];
      setInquiries((current) => {
        const existingIds = new Set(current.map((inquiry) => inquiry.id));
        return [...current, ...nextInquiries.filter((inquiry) => !existingIds.has(inquiry.id) && !deletedInquiryIds.has(inquiry.id))];
      });
      setTotalCount(typeof data.totalCount === "number" ? data.totalCount : totalCount);
      setPage(nextPage);
    } catch (loadError) {
      setLoadMoreError(loadError instanceof Error ? loadError.message : "Unable to load older inquiries.");
    } finally {
      setIsLoadingMore(false);
    }
  }

  useEffect(() => {
    if (!selectedId) return;

    let active = true;
    let requestPending = false;
    async function loadThread(showErrors = false) {
      if (requestPending) return;
      requestPending = true;
      try {
        const response = await fetch(`/api/my/inquiries/${selectedId}`, { cache: "no-store" });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error ?? "Unable to load inquiry.");
        if (!active || isSendingReply) return;
        const inquiry = data.inquiry ?? null;
        setSelectedInquiry((current) =>
          current && inquiry && JSON.stringify(current) === JSON.stringify(inquiry) ? current : inquiry
        );
        if (inquiry) {
          setInquiries((current) => current.map((item) => item.id === selectedId
            ? { ...item, isResolved: inquiry.isResolved, response: inquiry.response }
            : item));
        }
      } catch (loadError) {
        if (active && showErrors) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load inquiry.");
        }
      } finally {
        requestPending = false;
        if (active && showErrors) setIsLoadingThread(false);
      }
    }

    void loadThread(true);
    pollThreadRef.current = () => void loadThread();

    return () => {
      active = false;
      pollThreadRef.current = () => {};
    };
  }, [isSendingReply, selectedId]);

  useEffect(() => {
    let intervalId: number | undefined;

    const poll = () => {
      if (document.visibilityState !== "visible") return;
      router.refresh();
      pollInquiriesRef.current();
      pollThreadRef.current();
    };

    const startPolling = (refreshImmediately = false) => {
      if (document.visibilityState !== "visible" || intervalId !== undefined) return;
      if (refreshImmediately) poll();
      intervalId = window.setInterval(poll, 5_000);
    };

    const stopPolling = () => {
      if (intervalId === undefined) return;
      window.clearInterval(intervalId);
      intervalId = undefined;
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        startPolling(true);
      } else {
        stopPolling();
      }
    };

    startPolling();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  const conversationVersion = selectedInquiry?.thread
    .map((message) => `${message.id}:${message.createdAt}:${message.text}`)
    .join("|") ?? "";
  const selectedStatus = selectedInquiry ? getStatus(selectedInquiry) : null;
  const SelectedStatusIcon = selectedStatus?.icon;

  useEffect(() => {
    if (selectedInquiry?.id === selectedId && conversationRef.current) {
      conversationRef.current.scrollTop = conversationRef.current.scrollHeight;
    }
  }, [selectedId, selectedInquiry?.id, conversationVersion]);

  useEffect(() => {
    if (!toastVisible) return;
    const timeout = window.setTimeout(() => {
      setToastVisible(false);
      router.replace(selectedId ? `${basePath}/inquiries?inquiry=${selectedId}` : `${basePath}/inquiries`);
    }, 3500);

    return () => window.clearTimeout(timeout);
  }, [basePath, router, selectedId, toastVisible]);

  useEffect(() => {
    if (!selectedForDelete) return;
    const inquiryId = selectedForDelete.id;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !deletingInquiryIds.has(inquiryId)) {
        setSelectedForDelete(null);
      }
    }

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [deletingInquiryIds, selectedForDelete]);

  function selectInquiry(id: string) {
    setSelectedInquiry(null);
    setIsLoadingThread(true);
    setError(null);
    setReplyError(null);
    setSelectedId(id);
    router.replace(`${basePath}/inquiries?inquiry=${id}`);
  }

  function requestDeleteInquiry(event: React.MouseEvent<HTMLButtonElement>, inquiry: InquirySummary) {
    event.stopPropagation();
    if (deletingInquiryIds.has(inquiry.id)) return;
    setDeleteError(null);
    setSelectedForDelete(inquiry);
  }

  async function confirmDeleteInquiry(inquiry: InquirySummary) {
    if (deletingInquiryIds.has(inquiry.id)) return;

    setDeleteError(null);
    setDeletingInquiryIds((current) => new Set(current).add(inquiry.id));
    try {
      const response = await fetch(`/api/my/inquiries/${inquiry.id}`, { method: "DELETE" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to delete inquiry.");

      setDeletedInquiryIds((current) => new Set(current).add(inquiry.id));
      setInquiries((current) => current.filter((item) => item.id !== inquiry.id));
      setTotalCount((current) => Math.max(0, current - 1));
      setSelectedForDelete(null);

      if (selectedId === inquiry.id) {
        const remaining = inquiries.filter((item) => item.id !== inquiry.id);
        setSelectedInquiry(null);
        setIsLoadingThread(remaining.length > 0);
        setReplyError(null);
        setSelectedId(remaining[0]?.id ?? null);
        router.replace(remaining[0] ? `${basePath}/inquiries?inquiry=${remaining[0].id}` : `${basePath}/inquiries`);
      }
    } catch (deleteError) {
      setDeleteError(deleteError instanceof Error ? deleteError.message : "Unable to delete inquiry.");
    } finally {
      setDeletingInquiryIds((current) => {
        const next = new Set(current);
        next.delete(inquiry.id);
        return next;
      });
    }
  }

  function handleNewInquirySubmitted(inquiry: { id: string; subject: string }) {
    const createdAt = new Date().toISOString();
    setInquiries((current) => [
      {
        id: inquiry.id,
        subject: inquiry.subject,
        createdAt,
        isResolved: false,
        response: null,
      },
      ...current.filter((item) => item.id !== inquiry.id),
    ].slice(0, page * INQUIRY_PAGE_SIZE));
    setTotalCount((current) => current + 1);
    setSelectedInquiry(null);
    setIsLoadingThread(true);
    setSelectedId(inquiry.id);
    setIsNewInquiryModalOpen(false);
    setToastVisible(true);
    setError(null);
    router.replace(`${basePath}/inquiries?inquiry=${inquiry.id}`);
  }

  async function sendReply(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId || !replyText.trim() || isSendingReply) return;

    setIsSendingReply(true);
    setError(null);
    setReplyError(null);
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
      setReplyError(replyError instanceof Error ? replyError.message : "Unable to send reply.");
    } finally {
      setIsSendingReply(false);
    }
  }

  return (
    <main className="px-6 pb-20 pt-10 lg:px-10 lg:pt-14">
      {toastVisible && (
        <FloatingFeedback
          message="Inquiry submitted successfully."
          type="success"
          autoDismissMs={0}
          onDismiss={() => setToastVisible(false)}
        />
      )}

      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#0F3D5C]">Support inbox</p>
            <h1 className="mt-3 text-4xl font-black tracking-tight text-slate-950">My inquiries</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Track your support requests and continue the conversation with SK officials in one place.</p>
          </div>
          <button
            ref={newInquiryButtonRef}
            type="button"
            onClick={() => setIsNewInquiryModalOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 self-start rounded-xl bg-[#0a1f33] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#122e48] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0a1f33] focus-visible:ring-offset-2 sm:self-auto"
          >
            <MessageSquarePlus className="h-4 w-4" aria-hidden="true" />
            New Inquiry
          </button>
        </div>

        {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}

        <div className="grid h-[min(720px,calc(100dvh-14rem))] min-h-[480px] overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-[360px_1fr]">
          <aside className={`min-h-0 flex-col border-slate-200 bg-slate-50/70 lg:border-r ${selectedInquiry ? "hidden lg:flex" : "flex"}`}>
            <div className="border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <Inbox className="h-4 w-4 text-[#0F3D5C]" />
                All inquiries
                <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">{totalCount}</span>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
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
                    return (
                      <div
                        key={inquiry.id}
                        data-inquiry-card={inquiry.id}
                        className={`group relative w-full rounded-2xl border p-3.5 transition-all duration-200 ${
                          selectedId === inquiry.id
                            ? "border-[#0a1f33] bg-white shadow-sm ring-1 ring-[#0a1f33]/10"
                            : "border-slate-200/80 bg-slate-50/50 hover:border-slate-300 hover:bg-white hover:shadow-sm"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => selectInquiry(inquiry.id)}
                          className="w-full pr-7 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                          aria-current={selectedId === inquiry.id ? "true" : undefined}
                        >
                          <div className="flex min-w-0 items-start justify-between gap-3">
                            <p className={`min-w-0 flex-1 truncate text-sm font-bold transition-colors ${
                              selectedId === inquiry.id
                                ? "text-[#0a1f33]"
                                : "text-slate-800 group-hover:text-slate-900"
                            }`}>
                              {inquiry.subject}
                            </p>
                            <span className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-bold shadow-sm ${status.className}`}>
                              {inquiry.isResolved ? (
                                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" aria-hidden="true" />
                              )}
                              {status.label}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-400">
                            <Clock3 className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                            <span>
                              {new Date(inquiry.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
                            </span>
                          </div>
                        </button>
                        <button
                          type="button"
                          onClick={(event) => requestDeleteInquiry(event, inquiry)}
                          disabled={deletingInquiryIds.has(inquiry.id)}
                          title="Delete inquiry"
                          aria-label={`Delete inquiry: ${inquiry.subject}`}
                          className="absolute right-3 top-3 rounded-md p-1 text-slate-400 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 group-hover:opacity-100 disabled:cursor-wait disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                  {inquiries.length < totalCount ? (
                    <div className="space-y-2 pt-1">
                      {loadMoreError ? <p role="alert" className="px-1 text-xs text-rose-600">{loadMoreError}</p> : null}
                      <button
                        type="button"
                        onClick={() => void loadMoreInquiries()}
                        disabled={isLoadingMore}
                        className="w-full py-2.5 mt-4 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-xl border border-slate-200 transition-all disabled:cursor-wait disabled:opacity-60"
                      >
                        {isLoadingMore ? "Loading..." : "Load older inquiries"}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          </aside>

          <section className={`min-h-0 overflow-hidden ${selectedInquiry ? "block" : "hidden lg:block"}`}>
            {isLoadingThread || (selectedId !== null && selectedInquiry?.id !== selectedId) ? (
              <div className="flex h-full min-h-0 items-center justify-center text-sm text-slate-500">Loading conversation...</div>
            ) : selectedInquiry ? (
              <div className="flex h-full min-h-0 flex-col">
                <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-5 sm:px-8">
                  <button type="button" onClick={() => { setSelectedInquiry(null); setSelectedId(null); router.replace(`${basePath}/inquiries`); }} className="mt-1 rounded-full p-2 text-slate-500 hover:bg-slate-100 lg:hidden" aria-label="Back to inquiries">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#0F3D5C]">Support conversation</p>
                    <h2 className="mt-2 text-xl font-bold text-slate-900">{selectedInquiry.subject}</h2>
                    <p className="mt-1 text-xs text-slate-500">Submitted {new Date(selectedInquiry.createdAt).toLocaleString()}</p>
                  </div>
                  {selectedStatus && SelectedStatusIcon ? (
                    <span className={`ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${selectedStatus.className}`}>
                      <SelectedStatusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                      {selectedStatus.label}
                    </span>
                  ) : null}
                </div>

                <div ref={conversationRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto bg-slate-50/50 px-5 py-6 sm:px-8">
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
                  {replyError ? <p role="alert" className="mb-3 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{replyError}</p> : null}
                  <textarea id="inquiry-reply" value={replyText} onChange={(event) => setReplyText(event.target.value)} onKeyDown={(event) => {
                    if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) return;
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }} rows={3} placeholder="Reply to SK officials..." disabled={isSendingReply} className="w-full resize-none rounded-2xl border border-slate-300 p-3 text-sm text-slate-900 outline-none focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/15 disabled:bg-slate-50" />
                  <div className="mt-3 flex justify-end">
                    <button type="submit" disabled={isSendingReply || !replyText.trim()} className="inline-flex items-center gap-2 rounded-xl bg-[#0F3D5C] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0D2E47] disabled:cursor-not-allowed disabled:opacity-50">
                      <Send className="h-4 w-4" />
                      {isSendingReply ? "Sending..." : "Send reply"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="flex h-full min-h-0 flex-col items-center justify-center px-6 text-center">
                <Inbox className="h-10 w-10 text-slate-300" />
                <h2 className="mt-4 text-lg font-semibold text-slate-900">Select an inquiry</h2>
                <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">Choose a support request to view the conversation and reply to SK officials.</p>
              </div>
            )}
          </section>
        </div>

        {isNewInquiryModalOpen ? (
          <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setIsNewInquiryModalOpen(false);
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="new-inquiry-title"
              className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl sm:p-7"
            >
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0F3D5C]">Support inbox</p>
                  <h2 id="new-inquiry-title" className="mt-1 text-xl font-bold text-slate-900">Create New Inquiry</h2>
                  <p className="mt-1 text-sm text-slate-500">Send a support request to SK officials.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsNewInquiryModalOpen(false)}
                  className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-500"
                  aria-label="Close new inquiry form"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <SupportRequestForm
                dashboardPath={basePath}
                inboxPath={`${basePath}/inquiries`}
                embedded
                onCancel={() => setIsNewInquiryModalOpen(false)}
                onSubmitted={handleNewInquirySubmitted}
              />
            </section>
          </div>
        ) : null}

        {selectedForDelete ? (
          <div
            className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs animate-in fade-in duration-150"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget && !deletingInquiryIds.has(selectedForDelete.id)) {
                setSelectedForDelete(null);
                setDeleteError(null);
              }
            }}
          >
            <section
              role="dialog"
              aria-modal="true"
              aria-labelledby="delete-inquiry-title"
              aria-describedby="delete-inquiry-description"
              className="relative w-full max-w-[340px] rounded-2xl border border-slate-200/80 bg-white p-5 text-center shadow-xl animate-in zoom-in-95 duration-150"
            >
              <button
                type="button"
                onClick={() => {
                  setSelectedForDelete(null);
                  setDeleteError(null);
                }}
                disabled={deletingInquiryIds.has(selectedForDelete.id)}
                className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Close delete confirmation"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <div className="mx-auto mb-2.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-rose-100 bg-rose-50 text-rose-600 shadow-2xs">
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              </div>
              <h2 id="delete-inquiry-title" className="mb-1 text-sm font-bold text-slate-900">Delete inquiry?</h2>
              <p id="delete-inquiry-description" className="px-1 text-[11px] leading-normal text-slate-500">
                Are you sure you want to delete <span className="font-bold text-slate-800">&ldquo;{selectedForDelete.subject}&rdquo;</span>? This permanently removes the inquiry and its support message history.
              </p>
              <p className="mt-1 text-[10px] text-slate-400">
                Submitted {new Date(selectedForDelete.createdAt).toLocaleDateString(undefined, { dateStyle: "medium" })}
              </p>
              {deleteError ? <p role="alert" className="mt-3 text-center text-xs font-medium text-rose-600">{deleteError}</p> : null}

              <div className="mt-4 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedForDelete(null);
                    setDeleteError(null);
                  }}
                  disabled={deletingInquiryIds.has(selectedForDelete.id)}
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void confirmDeleteInquiry(selectedForDelete)}
                  disabled={deletingInquiryIds.has(selectedForDelete.id)}
                  className="h-8 w-full rounded-lg bg-rose-600 text-[11px] font-bold text-white shadow-2xs transition-all hover:bg-rose-700 active:scale-[0.98] disabled:cursor-wait disabled:opacity-50"
                >
                  {deletingInquiryIds.has(selectedForDelete.id) ? "Deleting..." : "Delete inquiry"}
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </main>
  );
}
