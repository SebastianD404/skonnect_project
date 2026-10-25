// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
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

describe("ChatWidget", () => {
  beforeEach(() => {
    vi.mocked(usePathname).mockReturnValue("/");
  });

  it("renders its launcher and opens the assistant when clicked", async () => {
    const user = userEvent.setup();

    const { rerender } = render(<ChatWidget />);

    const launcher = screen.getByRole("button", {
      name: "Open SKonnect assistant",
    });
    expect(launcher).toBeInTheDocument();
    expect(launcher).toHaveClass("fixed", "cursor-grab");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.hover(launcher);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(launcher);

    expect(screen.getByRole("dialog")).toHaveTextContent(
      "SKonnect assistant panel",
    );

    vi.mocked(usePathname).mockReturnValue("/grantee-dashboard/documents");
    rerender(<ChatWidget />);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("does not render on administrative routes", () => {
    vi.mocked(usePathname).mockReturnValue("/admin/dashboard");

    render(<ChatWidget />);

    expect(
      screen.queryByRole("button", { name: "Open SKonnect assistant" }),
    ).not.toBeInTheDocument();
  });

  it("does not open the chat after dragging the launcher", () => {
    render(<ChatWidget />);

    const launcher = screen.getByRole("button", {
      name: "Open SKonnect assistant",
    });

    fireEvent.pointerDown(launcher, {
      pointerId: 1,
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(launcher, {
      pointerId: 1,
      clientX: 125,
      clientY: 125,
    });
    fireEvent.pointerUp(launcher, {
      pointerId: 1,
      clientX: 125,
      clientY: 125,
    });
    fireEvent.click(launcher);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
