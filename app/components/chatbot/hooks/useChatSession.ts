"use client";

import { useCallback, useMemo, useState } from "react";

type MessageRole = "USER" | "ASSISTANT";

type MessageLanguage = "ENGLISH" | "FILIPINO" | "ILOCANO";

export type ChatUiMessage = {
  id: string;
  role: MessageRole;
  content: string;
  language: MessageLanguage;
  createdAt: string;
  isPending?: boolean;
};

export function useChatSession() {
  const [messages, setMessages] = useState<ChatUiMessage[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [historyLoaded, setHistoryLoaded] = useState(false);

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

      setMessages((data.messages || []) as ChatUiMessage[]);
      setHistoryLoaded(true);
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : "Failed to load chat history");
    } finally {
      setIsLoadingHistory(false);
    }
  }, [historyLoaded]);

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
      const assistantMessage = data?.message as ChatUiMessage;

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
    sendMessage,
    startNewConversation,
  };
}
