"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatUiMessage } from "@/app/components/chatbot/hooks/useChatSession";
import { MarkdownLite } from "@/app/components/chatbot/MarkdownLite";
import { TypingIndicator } from "@/app/components/chatbot/TypingIndicator";
import { ChatHistoryModal } from "@/app/components/chatbot/ChatHistoryModal";
import { Clock, X } from "lucide-react";

type PanelPosition = {
  left: number;
  top: number;
};

type Props = {
  isOpen: boolean;
  panelPosition: PanelPosition;
  isMobile: boolean;
  messages: ChatUiMessage[];
  isSending: boolean;
  isLoadingHistory: boolean;
  error: string | null;
  canSend: boolean;
  onClose: () => void;
  onSend: (value: string) => Promise<void> | void;
  onStartNewConversation: () => void;
};

export function ChatPanelCompact({
  isOpen,
  panelPosition,
  isMobile,
  messages,
  isSending,
  isLoadingHistory,
  error,
  canSend,
  onClose,
  onSend,
  onStartNewConversation,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    // scroll a bit after opening so input is visible at bottom
    const scrollTimeout = window.setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight ?? 0 });
    }, 120);

    return () => {
      window.clearTimeout(timeout);
      window.clearTimeout(scrollTimeout);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") {
        return;
      }

      const root = panelRef.current;
      if (!root) {
        return;
      }

      const focusables = root.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );

      if (focusables.length === 0) {
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  const messageList = useMemo(() => messages, [messages]);
  const recentWindow = 6;
  const recentMessages = useMemo(() => {
    if (showFullHistory) return messageList;
    return messageList.slice(-recentWindow);
  }, [messageList, showFullHistory]);

  const sendDraft = async () => {
    const value = draft.trim();
    if (!value || !canSend) {
      return;
    }

    setDraft("");
    await onSend(value);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await sendDraft();
  };

  const handleKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await sendDraft();
    }
  };

  useEffect(() => {
    // auto-scroll when messages change (keep view at bottom)
    scrollRef.current?.scrollTo({ top: scrollRef.current?.scrollHeight ?? 0 });
  }, [recentMessages.length, showFullHistory, isSending]);

  const baseClass =
    "fixed z-[70] rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 ease-out";

  if (!isOpen) {
    return null;
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="SKonnect multilingual assistant"
      className={
        isMobile
          ? `${baseClass} left-3 right-3 top-16 bottom-3 flex flex-col rounded-3xl`
          : `${baseClass} flex h-[520px] w-[360px] flex-col`
      }
      style={
        isMobile
          ? undefined
          : {
              left: panelPosition.left,
              top: panelPosition.top,
            }
      }
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-[#0F3D5C]">SKonnect Assistant</h2>
          <p className="text-xs text-slate-500">English, Filipino, Ilocano</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistoryModal(true)}
            className="rounded-md p-2 text-[#0F3D5C] transition hover:bg-slate-50 hover:text-[#0D2E47]"
            aria-label="Open conversation history"
            title="History"
          >
            <Clock className="h-5 w-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close chat"
            title="Close"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoadingHistory ? (
          <p className="text-xs text-slate-500">Loading recent messages...</p>
        ) : messageList.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Ask about SKEAP requirements, deadlines, submissions, or event registration steps.
          </p>
        ) : (
          <>
            {/* Compact dedicated history header - shows older messages as compact chips */}
            {messageList.length > recentWindow && !showFullHistory ? (
              <div className="mb-2">
                <div className="flex items-center gap-2 overflow-x-auto py-1">
                  {messageList.slice(0, Math.max(0, messageList.length - recentWindow)).map((m) => (
                    <div key={`hist-${m.id}`} className="relative group flex-shrink-0">
                      <button
                        onClick={() => setShowHistoryModal(true)}
                        className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                        aria-label={`Open history preview: ${m.content}`}
                      >
                        {m.content.length > 28 ? `${m.content.slice(0, 25)}...` : m.content}
                      </button>
                      <div className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-[280px] rounded-md bg-white p-2 text-sm text-slate-700 shadow-lg group-hover:block">
                        <div className="text-xs text-slate-400">{m.role} • {new Date(m.createdAt).toLocaleString()}</div>
                        <div className="mt-1 whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end">
                  <button onClick={() => setShowHistoryModal(true)} className="text-xs text-slate-500 underline">
                    View full history
                  </button>
                </div>
              </div>
            ) : null}

            {(showFullHistory ? messageList : recentMessages).map((message) => (
              <div
                key={message.id}
                data-chat-id={message.id}
                className={
                  message.role === "USER"
                    ? "ml-8 rounded-2xl bg-[#0F3D5C] px-3 py-2 text-sm text-white"
                    : "mr-8 rounded-2xl bg-slate-100 px-3 py-2"
                }
              >
                {message.role === "USER" ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                ) : (
                  <MarkdownLite content={message.content} />
                )}
              </div>
            ))}
            <ChatHistoryModal
              isOpen={showHistoryModal}
              onClose={() => setShowHistoryModal(false)}
              messages={messageList}
              onStartNewConversation={onStartNewConversation}
              onSelectMessage={(id) => {
                // when a message is selected in modal, close modal and scroll to it via simple showFullHistory
                setShowHistoryModal(false);
                setShowFullHistory(true);
                // small delay to allow panel to show
                setTimeout(() => {
                  const el = document.querySelector(`[data-chat-id=\"${id}\"]`);
                  if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
                }, 150);
              }}
            />
          </>
        )}

        {isSending ? <TypingIndicator /> : null}

        {error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        ) : null}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-slate-200 px-3 py-3">
        <label htmlFor="skonnect-chat-input" className="sr-only">
          Type your message
        </label>
        <textarea
          id="skonnect-chat-input"
          ref={inputRef}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={handleKeyDown}
          rows={isMobile ? 3 : 2}
          placeholder="Type your message..."
          className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-[#0F3D5C] focus:ring-2 focus:ring-[#0F3D5C]/20"
        />
        <div className="mt-2 flex items-center justify-end">
          <button
            type="submit"
            disabled={!canSend || !draft.trim()}
            className="rounded-lg bg-[#0F3D5C] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#0D2E47] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
