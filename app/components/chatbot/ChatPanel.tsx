"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChatUiMessage } from "@/app/components/chatbot/hooks/useChatSession";
import { MarkdownLite } from "@/app/components/chatbot/MarkdownLite";
import { TypingIndicator } from "@/app/components/chatbot/TypingIndicator";

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
};

export function ChatPanel({
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
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const timeout = window.setTimeout(() => {
      inputRef.current?.focus();
    }, 80);

    return () => window.clearTimeout(timeout);
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
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
        >
          Close
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {isLoadingHistory ? (
          <p className="text-xs text-slate-500">Loading recent messages...</p>
        ) : messageList.length === 0 ? (
          <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
            Ask about SKEAP requirements, deadlines, or submissions.
          </p>
        ) : (
          messageList.map((message) => (
            <div
              key={message.id}
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
          ))
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
