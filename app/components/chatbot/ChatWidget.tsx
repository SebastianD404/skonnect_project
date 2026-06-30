"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { MessageCircle } from "lucide-react";
import { usePathname } from "next/navigation";
import { ChatPanelCompact as ChatPanel } from "@/app/components/chatbot/ChatPanelCompact";
import { useChatSession } from "@/app/components/chatbot/hooks/useChatSession";
import { useDraggablePosition } from "@/app/components/chatbot/hooks/useDraggablePosition";

const BUTTON_SIZE = 56;
const VIEWPORT_MARGIN = 16;
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
  const openLeft = buttonX - PANEL_WIDTH - gap;
  const openRight = buttonX + BUTTON_SIZE + gap;
  const shouldOpenLeft = openRight + PANEL_WIDTH > viewportWidth - VIEWPORT_MARGIN;

  const openAbove = buttonY - PANEL_HEIGHT - gap;
  const openBelow = buttonY + BUTTON_SIZE + gap;
  const shouldOpenAbove = openBelow + PANEL_HEIGHT > viewportHeight - VIEWPORT_MARGIN;

  const left = clamp(
    shouldOpenLeft ? openLeft : openRight,
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
  const forceDefaultPosition = pathname?.startsWith("/applications") ?? false;
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  const { position, isDragging, hasHydrated, isDefaultPosition, dragHandlers, consumeDragged } = useDraggablePosition({
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

  if (
    pathname.startsWith("/admin") ||
    pathname.startsWith("/system-admin") ||
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname === "/logout"
  ) {
    return null;
  }

  const [portalEl, setPortalEl] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const id = "skonnect-chat-portal";
    let el = document.getElementById(id) as HTMLElement | null;
    if (!el) {
      el = document.createElement("div");
      el.id = id;
      document.body.appendChild(el);
    }
    setPortalEl(el);
    return () => {
      // keep the portal element for future navigations; do not remove it to avoid flicker
      setPortalEl(null);
    };
  }, []);

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
        className={`fixed z-[9999] grid place-items-center rounded-full bg-[#0F3D5C] text-white shadow-xl ring-4 ring-white/70 transition ${
          isDragging ? "cursor-grabbing scale-105" : "cursor-grab hover:bg-[#0D2E47]"
        }`}
        style={
          hasHydrated && !isDefaultPosition && !forceDefaultPosition
            ? {
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${BUTTON_SIZE}px`,
                height: `${BUTTON_SIZE}px`,
                touchAction: "none",
              }
            : {
              right: "124px",
              bottom: "124px",
                width: `${BUTTON_SIZE}px`,
                height: `${BUTTON_SIZE}px`,
                touchAction: "none",
              }
        }
        {...dragHandlers}
      >
        <MessageCircle className="h-6 w-6" />
      </button>

      <div className="fixed inset-0 z-[9998] pointer-events-none" aria-hidden={!isOpen}>
        <div className="pointer-events-auto">
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
        </div>
      </div>
    </>
  );

  if (portalEl) {
    return createPortal(widget, portalEl);
  }

  return widget;
}
