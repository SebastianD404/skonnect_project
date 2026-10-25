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
        error={null}
        canSend
        onClose={vi.fn()}
        onSend={vi.fn()}
        onStartNewConversation={vi.fn()}
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
});
