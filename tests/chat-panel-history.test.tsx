// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatPanelCompact } from "@/app/components/chatbot/ChatPanelCompact";
import type { ChatUiMessage } from "@/app/components/chatbot/hooks/useChatSession";

vi.mock("@/app/components/chatbot/MarkdownLite", () => ({
  MarkdownLite: ({ content }: { content: string }) => <p>{content}</p>,
}));

vi.mock("@/app/components/chatbot/TypingIndicator", () => ({
  TypingIndicator: () => <div>Assistant is typing</div>,
}));

const messages: ChatUiMessage[] = [
  {
    id: "user-1",
    role: "USER",
    content: "How do I submit my requirements?",
    language: "ENGLISH",
    createdAt: "2026-10-25T10:00:00.000Z",
  },
  {
    id: "assistant-1",
    role: "ASSISTANT",
    content: "Upload them from the requirements page.",
    language: "ENGLISH",
    createdAt: "2026-10-25T10:00:10.000Z",
  },
];

function createConversationMessages(count: number): ChatUiMessage[] {
  return Array.from({ length: count }, (_, index) => {
    const sequence = index + 1;
    const createdAt = new Date(Date.UTC(2026, 9, sequence, 10)).toISOString();
    return {
      id: `user-${sequence}`,
      role: "USER",
      content: `Conversation ${sequence}`,
      language: "ENGLISH",
      createdAt,
    };
  });
}

describe("ChatPanelCompact history view", () => {
  it("toggles history from the header clock button and removes the composer", async () => {
    const user = userEvent.setup();

    render(
      <ChatPanelCompact
        isOpen
        panelPosition={{ left: 24, top: 84 }}
        isMobile={false}
        messages={messages}
        isSending={false}
        isLoadingHistory={false}
        isLoadingOlderHistory={false}
        totalHistoryMessages={1}
        error={null}
        canSend
        onClose={vi.fn()}
        onSend={vi.fn()}
        onStartNewConversation={vi.fn()}
        onLoadOlderHistory={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open conversation history" }));

    expect(screen.getByText("Past Conversations")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /How do I submit my requirements/ })).toBeInTheDocument();
    expect(screen.queryByLabelText("Type your message")).not.toBeInTheDocument();
    expect(document.querySelector(".overflow-x-auto")).toBeNull();

    await user.click(screen.getByRole("button", { name: /How do I submit my requirements/ }));
    expect(screen.getByText("Upload them from the requirements page.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open conversation history" }));
    await user.click(screen.getByRole("button", { name: "Return to chat" }));

    expect(screen.getByLabelText("Type your message")).toBeInTheDocument();
    expect(screen.getByText("Upload them from the requirements page.")).toBeInTheDocument();
  });

  it("shows the latest ten conversations first and reveals older ones on demand", async () => {
    const user = userEvent.setup();
    const onLoadOlderHistory = vi.fn();

    render(
      <ChatPanelCompact
        isOpen
        panelPosition={{ left: 24, top: 84 }}
        isMobile={false}
        messages={createConversationMessages(12)}
        isSending={false}
        isLoadingHistory={false}
        isLoadingOlderHistory={false}
        totalHistoryMessages={12}
        error={null}
        canSend
        onClose={vi.fn()}
        onSend={vi.fn()}
        onStartNewConversation={vi.fn()}
        onLoadOlderHistory={onLoadOlderHistory}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open conversation history" }));
    const conversationButtons = screen.getAllByRole("button", { name: /Conversation \d+/ });
    expect(conversationButtons).toHaveLength(10);
    expect(conversationButtons[0]).toHaveTextContent("Conversation 12");
    expect(conversationButtons[9]).toHaveTextContent("Conversation 3");
    expect(screen.getByRole("button", { name: "Load older conversations (2 remaining)" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Load older conversations (2 remaining)" }));

    expect(screen.getAllByRole("button", { name: /Conversation \d+/ })).toHaveLength(12);
    expect(screen.getAllByRole("button", { name: /Conversation \d+/ })[10]).toHaveTextContent("Conversation 2");
    expect(onLoadOlderHistory).not.toHaveBeenCalled();
  });

  it("fetches another page when loading older conversations not yet in memory", async () => {
    const user = userEvent.setup();
    const onLoadOlderHistory = vi.fn();

    render(
      <ChatPanelCompact
        isOpen
        panelPosition={{ left: 24, top: 84 }}
        isMobile={false}
        messages={createConversationMessages(10)}
        isSending={false}
        isLoadingHistory={false}
        isLoadingOlderHistory={false}
        totalHistoryMessages={12}
        error={null}
        canSend
        onClose={vi.fn()}
        onSend={vi.fn()}
        onStartNewConversation={vi.fn()}
        onLoadOlderHistory={onLoadOlderHistory}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Open conversation history" }));
    await user.click(screen.getByRole("button", { name: "Load older conversations (2 remaining)" }));

    expect(onLoadOlderHistory).toHaveBeenCalledOnce();
  });
});
