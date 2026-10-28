"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type MessageRole = "USER" | "ASSISTANT";

type MessageLanguage = "ENGLISH" | "FILIPINO" | "ILOCANO";

export type ChatUiMessage = {
  id: string;
  role: MessageRole;
  content: string;
  language: MessageLanguage;
  createdAt: string;
  isPending?: boolean;
  sources?: string[];
};

export function useChatSession() {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [totalHistoryMessages, setTotalHistoryMessages] = useState(0);
  const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);
  const historyCursor = useRef<string | null>(null);

  const loadHistory = useCallback(async () => {
    if (historyLoaded) {
      return;
    }

    setIsLoadingHistory(true);
    setError(null);

    try {
      const response = await fetch("/api/chat/messages?limit=20", {
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to load chat history");
      }

      const loadedMessages = (data.messages || []) as ChatUiMessage[];
      historyCursor.current = loadedMessages.at(-1)?.id ?? null;
      setMessages(loadedMessages.reverse());
      setTotalHistoryMessages(
        typeof data.totalConversations === "number" ? data.totalConversations : 0
      );
      setHistoryLoaded(true);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load chat history");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyLoaded]);

  const loadOlderHistory = useCallback(async () => {
    if (!historyCursor.current || isLoadingOlderHistory) return;

    setIsLoadingOlderHistory(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/chat/messages?limit=20&cursor=${encodeURIComponent(historyCursor.current)}`,
        { cache: "no-store" },
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to load older chat history");
      }

      const olderMessages = (data.messages || []) as ChatUiMessage[];
      if (olderMessages.length > 0) {
        historyCursor.current = olderMessages.at(-1)?.id ?? historyCursor.current;
        const chronologicalMessages = olderMessages.reverse();
        setMessages((current) => {
          const existingIds = new Set(current.map((message) => message.id));
          return [...chronologicalMessages.filter((message) => !existingIds.has(message.id)), ...current]
            .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime());
        });
      } else {
        historyCursor.current = null;
      }
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load older chat history");
    } finally {
      setIsLoadingOlderHistory(false);
    }
  }, [isLoadingOlderHistory]);

  const sendMessage = useCallback(async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) {
      return;
    }

    setError(null);

    const optimisticMessage: ChatUiMessage = {
      id: `temp-${Date.now()}`,
      role: "USER",
      content: trimmed,
      language: "ENGLISH",
      createdAt: new Date().toISOString(),
      isPending: true,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setIsSending(true);

    try {
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error || "Failed to send message");
      }

      const userMessage = data?.userMessage as ChatUiMessage;
      const assistantMessage = {
        ...data?.message,
        sources: Array.isArray(data?.sources) ? data.sources.filter((source: unknown): source is string => typeof source === "string") : [],
      } as ChatUiMessage;

      setMessages((prev) => {
        const withoutPending = prev.filter((item) => item.id !== optimisticMessage.id);
        return [...withoutPending, userMessage, assistantMessage];
      });
    } catch (sendError) {
      setMessages((prev) => prev.filter((item) => item.id !== optimisticMessage.id));
      setError(sendError instanceof Error ? sendError.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  }, [isSending]);

  const canSend = useMemo(() => !isSending, [isSending]);

  const startNewConversation = useCallback(() => {
    // keep historyLoaded true so we don't re-fetch automatically;
    // clear in-memory session for immediate new conversation view
    setMessages([]);
    setError(null);
  }, []);

  return {
    messages,
    error,
    isLoadingHistory,
    isSending,
    canSend,
    loadHistory,
    loadOlderHistory,
    totalHistoryMessages,
    isLoadingOlderHistory,
    sendMessage,
    startNewConversation,
  };
}
