"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatUiMessage } from "@/app/components/chatbot/hooks/useChatSession";
import { MarkdownLite } from "@/app/components/chatbot/MarkdownLite";
import { TypingIndicator } from "@/app/components/chatbot/TypingIndicator";
import { Clock, X } from "lucide-react";

const SUGGESTED_QUESTIONS = [
  "Manu ti mabalin a scholar ti maysa a balay?",
  "Can I submit my requirements at Pico Hall?",
  "Sino ang pwedeng mag-apply?",
];

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
  const [showHistory, setShowHistory] = useState(false);
  const [showFullHistory, setShowFullHistory] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    // scroll a bit after opening so input is visible at bottom
    const scrollTimeout = window.setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
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
  const historyMessages = useMemo(
    () => messageList.filter((message) => message.role === "USER"),
    [messageList],
  );

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
    if (scrollRef.current && !showHistory) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [recentMessages.length, showFullHistory, isSending, showHistory]);

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
      className={`${baseClass} flex h-[520px] w-[360px] max-w-[calc(100vw-24px)] flex-col`}
      style={{
        left: panelPosition.left,
        top: panelPosition.top,
      }}
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div>
          <h2 className="text-sm font-bold text-[#0F3D5C]">SKonnect Assistant</h2>
          <p className="text-xs text-slate-500">English, Filipino, Ilocano</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistory((current) => !current)}
            className={`rounded-md p-2 transition ${
              showHistory
                ? "bg-slate-100 text-[#0F3D5C]"
                : "text-[#0F3D5C] hover:bg-slate-50 hover:text-[#0D2E47]"
            }`}
            aria-label={showHistory ? "Return to chat" : "Open conversation history"}
            aria-pressed={showHistory}
            title={showHistory ? "Return to chat" : "History"}
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

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4">
        {showHistory ? (
          <div className="flex flex-col gap-2">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Past Conversations
              </span>
              <button
                type="button"
                onClick={() => {
                  onStartNewConversation();
                  setShowHistory(false);
                  setShowFullHistory(false);
                }}
                className="text-xs font-medium text-[#0F3D5C] hover:underline"
              >
                Start new chat
              </button>
            </div>
            {isLoadingHistory ? (
              <p className="text-sm text-slate-500">Loading conversation history...</p>
            ) : historyMessages.length === 0 ? (
              <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-500">
                No past conversations yet.
              </p>
            ) : (
              historyMessages.map((message) => (
                <button
                  key={message.id}
                  type="button"
                  onClick={() => {
                    setShowHistory(false);
                    setShowFullHistory(true);
                    window.setTimeout(() => {
                      const element = document.querySelector(`[data-chat-id="${message.id}"]`);
                      element?.scrollIntoView?.({ behavior: "smooth", block: "center" });
                    }, 0);
                  }}
                  className="w-full rounded-lg border border-slate-100 bg-slate-50 p-3 text-left text-sm text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <span className="block whitespace-pre-wrap break-words">{message.content}</span>
                  <span className="mt-1 block text-xs text-slate-400">
                    {new Date(message.createdAt).toLocaleString()}
                  </span>
                </button>
              ))
            )}
          </div>
        ) : isLoadingHistory ? (
          <p className="text-xs text-slate-500">Loading recent messages...</p>
        ) : messageList.length === 0 ? (
          <div>
            <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              Ask about SKEAP requirements, deadlines, or submissions.
            </p>
            <div className="mt-3 flex flex-wrap gap-2" aria-label="Suggested questions">
              {SUGGESTED_QUESTIONS.map((question) => (
                <button
                  key={question}
                  type="button"
                  disabled={!canSend}
                  onClick={() => void onSend(question)}
                  className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-left text-xs text-slate-600 transition hover:border-[#0F3D5C]/30 hover:bg-slate-50 disabled:opacity-50"
                >
                  {question}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {(showFullHistory ? messageList : recentMessages).map((message) => (
              <div
                key={message.id}
                data-chat-id={message.id}
                className={
                  message.role === "USER"
                    ? "mb-3 ml-8 rounded-2xl bg-[#0F3D5C] px-3 py-2 text-sm text-white"
                    : "mb-3 mr-8 rounded-2xl bg-slate-100 px-3 py-2"
                }
              >
                {message.role === "USER" ? (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                ) : (
                  <MarkdownLite content={message.content} />
                )}
              </div>
            ))}
          </>
        )}

        {!showHistory && isSending ? <TypingIndicator /> : null}

        {!showHistory && error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>
        ) : null}
      </div>

      {!showHistory ? (
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
      ) : null}
    </div>
  );
}
