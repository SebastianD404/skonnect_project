// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usePathname } from "next/navigation";
import { ChatWidget } from "@/app/components/chatbot/ChatWidget";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(),
}));

vi.mock("@/app/components/chatbot/ChatPanelCompact", () => ({
  ChatPanelCompact: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div role="dialog">SKonnect assistant panel</div> : null,
}));

vi.mock("@/app/components/chatbot/hooks/useChatSession", () => ({
  useChatSession: () => ({
    messages: [],
    error: null,
    isLoadingHistory: false,
    isSending: false,
    canSend: true,
    loadHistory: vi.fn(),
    sendMessage: vi.fn(),
    startNewConversation: vi.fn(),
  }),
}));

vi.mock("@/app/components/chatbot/hooks/useDraggablePosition", () => ({
  useDraggablePosition: () => ({
    position: { x: 24, y: 100 },
    isDragging: false,
    hasHydrated: true,
    dragHandlers: {},
    consumeDragged: vi.fn(() => false),
  }),
}));

describe("ChatWidget", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("renders its launcher and opens the assistant when clicked", async () => {
    const user = userEvent.setup();

    render(<ChatWidget />);

    const launcher = screen.getByRole("button", {
      name: "Open SKonnect assistant",
    });
    expect(launcher).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(launcher);

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "SKonnect assistant panel",
    );
  });

  it("does not render on administrative routes", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/dashboard");

    render(<ChatWidget />);

    expect(
      screen.queryByRole("button", { name: "Open SKonnect assistant" }),
    ).not.toBeInTheDocument();
  });
});
