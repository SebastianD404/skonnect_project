"use client";

import { useEffect, useMemo, useState } from "react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { ChatPanelCompact as ChatPanel } from "@/app/components/chatbot/ChatPanelCompact";
import { useChatSession } from "@/app/components/chatbot/hooks/useChatSession";
import { useDraggablePosition } from "@/app/components/chatbot/hooks/useDraggablePosition";

const BUTTON_SIZE = 56;
// Increase margin so the floating icon isn't pushed too far to the right
const VIEWPORT_MARGIN = 48;
const TOP_BOUNDARY = 84;
const PANEL_WIDTH = 360;
const PANEL_HEIGHT = 520;

type PanelPosition = {
  left: number;
  top: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function computePanelPosition(params: {
  buttonX: number;
  buttonY: number;
  viewportWidth: number;
  viewportHeight: number;
}): PanelPosition {
  const { buttonX, buttonY, viewportWidth, viewportHeight } = params;

  const gap = 12;
  // Keep the panel visually attached to the widget by default.
  const attachedLeft = buttonX + BUTTON_SIZE - PANEL_WIDTH;
  const openAbove = buttonY - PANEL_HEIGHT - gap;
  const openBelow = buttonY + BUTTON_SIZE + gap;
  const shouldOpenAbove = openBelow + PANEL_HEIGHT > viewportHeight - VIEWPORT_MARGIN;

  const left = clamp(
    attachedLeft,
    VIEWPORT_MARGIN,
    viewportWidth - PANEL_WIDTH - VIEWPORT_MARGIN
  );

  const top = clamp(
    shouldOpenAbove ? openAbove : openBelow,
    TOP_BOUNDARY,
    viewportHeight - PANEL_HEIGHT - VIEWPORT_MARGIN
  );

  return { left, top };
}

export function ChatWidget() {
  const pathname = usePathname();

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/system-admin") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/logout"
  ) {
    return null;
  }

  return (
    <ChatWidgetErrorBoundary key={pathname}>
      <ChatWidgetContent />
    </ChatWidgetErrorBoundary>
  );
}

type ChatWidgetErrorBoundaryState = {
  hasError: boolean;
};

class ChatWidgetErrorBoundary extends Component<
  { children: ReactNode },
  ChatWidgetErrorBoundaryState
> {
  state: ChatWidgetErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ChatWidgetErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Chat assistant failed to render:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          className="fixed bottom-5 right-5 z-[9999] max-w-xs rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 shadow-xl"
        >
          <p>The assistant is temporarily unavailable.</p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="mt-2 font-semibold text-[#0F3D5C] underline underline-offset-2"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

function ChatWidgetContent() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { position, isDragging, hasHydrated, dragHandlers, consumeDragged } = useDraggablePosition({
    storageKey: "skonnect.chat.widget.position.v2",
    buttonSize: BUTTON_SIZE,
    viewportMargin: VIEWPORT_MARGIN,
    topBoundary: TOP_BOUNDARY,
  });

  const { messages, error, isLoadingHistory, isSending, canSend, loadHistory, sendMessage, startNewConversation } = useChatSession();

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    loadHistory();
  }, [isOpen, loadHistory]);

  const panelPosition = useMemo(() => {
    if (typeof window === "undefined") {
      return { left: VIEWPORT_MARGIN, top: TOP_BOUNDARY };
    }

    return computePanelPosition({
      buttonX: position.x,
      buttonY: position.y,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    });
  }, [position.x, position.y]);

  const widget = (
    <>
      <button
        type="button"
        aria-label="Open SKonnect assistant"
        onClick={() => {
          if (consumeDragged()) {
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        className={`fixed z-[9999] grid place-items-center rounded-full bg-[#0F3D5C] text-white shadow-xl ring-4 ring-white/70 ${
          isDragging
            ? "cursor-grabbing scale-105 transition-none"
            : "cursor-grab transition-[left,top,transform,background-color] duration-200 ease-out hover:bg-[#0D2E47]"
        }`}
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${BUTTON_SIZE}px`,
          height: `${BUTTON_SIZE}px`,
          touchAction: "none",
          visibility: hasHydrated ? "visible" : "hidden",
        }}
        {...dragHandlers}
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <ChatPanel
        isOpen={isOpen}
        panelPosition={panelPosition}
        isMobile={isMobile}
        messages={messages}
        isLoadingHistory={isLoadingHistory}
        isSending={isSending}
        error={error}
        canSend={canSend}
        onClose={() => setIsOpen(false)}
        onSend={sendMessage}
        onStartNewConversation={() => startNewConversation()}
      />
    </>
  );

  return widget;
}
