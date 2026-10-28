"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Component, type ErrorInfo, type ReactNode } from "react";
import { MessageCircle } from "lucide-react";
import { motion, useMotionValue, type PanInfo } from "framer-motion";
import { usePathname } from "next/navigation";
import { createPortal } from "react-dom";
import { ChatPanelCompact as ChatPanel } from "@/app/components/chatbot/ChatPanelCompact";
import { useChatSession } from "@/app/components/chatbot/hooks/useChatSession";

const BUTTON_SIZE = 56;
const VIEWPORT_MARGIN = 24;
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
    <ChatWidgetErrorBoundary>
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
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [launcherPosition, setLauncherPosition] = useState<PanelPosition | null>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const constraintsRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  const {
    messages,
    error,
    isLoadingHistory,
    isLoadingOlderHistory,
    totalHistoryMessages,
    isSending,
    canSend,
    loadHistory,
    loadOlderHistory,
    sendMessage,
    startNewConversation,
  } = useChatSession();

  useEffect(() => {
    const portalFrame = window.requestAnimationFrame(() => {
      setPortalContainer(document.body);
    });

    const onResize = () => {
      setIsMobile(window.innerWidth < 768);
      setViewportSize({ width: window.innerWidth, height: window.innerHeight });
      setLauncherPosition((position) =>
        position
          ? {
              left: clamp(position.left, VIEWPORT_MARGIN, window.innerWidth - BUTTON_SIZE - VIEWPORT_MARGIN),
              top: clamp(position.top, TOP_BOUNDARY, window.innerHeight - BUTTON_SIZE - VIEWPORT_MARGIN),
            }
          : null,
      );
    };

    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      window.cancelAnimationFrame(portalFrame);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    loadHistory();
  }, [isOpen, loadHistory]);

  const panelPosition = useMemo(() => {
    if (!viewportSize.width || !viewportSize.height) {
      return { left: VIEWPORT_MARGIN, top: TOP_BOUNDARY };
    }

    return computePanelPosition({
      buttonX: launcherPosition?.left ?? viewportSize.width - BUTTON_SIZE - VIEWPORT_MARGIN,
      buttonY: launcherPosition?.top ?? viewportSize.height - BUTTON_SIZE - VIEWPORT_MARGIN,
      viewportWidth: viewportSize.width,
      viewportHeight: viewportSize.height,
    });
  }, [launcherPosition, viewportSize]);

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    isDraggingRef.current ||= info.offset.x !== 0 || info.offset.y !== 0;
    setLauncherPosition({
      left: clamp(info.point.x - BUTTON_SIZE / 2, VIEWPORT_MARGIN, viewportSize.width - BUTTON_SIZE - VIEWPORT_MARGIN),
      top: clamp(info.point.y - BUTTON_SIZE / 2, TOP_BOUNDARY, viewportSize.height - BUTTON_SIZE - VIEWPORT_MARGIN),
    });
    dragX.set(0);
    dragY.set(0);
  };

  const widget = (
    <>
      <div
        ref={constraintsRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-x-6 bottom-6 top-[84px]"
      />
      <motion.button
        type="button"
        aria-label="Open SKonnect assistant"
        drag={!isOpen}
        dragConstraints={constraintsRef}
        dragElastic={0}
        dragMomentum={false}
        onPointerDown={(event) => {
          isDraggingRef.current = false;
          pointerStartRef.current = { x: event.clientX, y: event.clientY };
        }}
        onPointerMove={(event) => {
          const pointerStart = pointerStartRef.current;
          if (
            pointerStart &&
            (Math.abs(event.clientX - pointerStart.x) > 5 ||
              Math.abs(event.clientY - pointerStart.y) > 5)
          ) {
            isDraggingRef.current = true;
          }
        }}
        onDragStart={() => {
          isDraggingRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (isDraggingRef.current) {
            isDraggingRef.current = false;
            return;
          }
          setIsOpen((prev) => !prev);
        }}
        className={`fixed z-50 grid h-14 w-14 place-items-center rounded-full bg-[#0F3D5C] text-white shadow-xl ring-4 ring-white/70 transition-colors duration-200 ease-out hover:bg-[#0D2E47] ${
          isOpen ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        }`}
        style={{
          left: launcherPosition?.left,
          top: launcherPosition?.top,
          right: launcherPosition ? "auto" : 24,
          bottom: launcherPosition ? "auto" : 24,
          x: dragX,
          y: dragY,
          touchAction: "none",
        }}
        whileHover={isOpen ? undefined : { scale: 1.06 }}
        whileTap={isOpen ? undefined : { scale: 0.96 }}
      >
        <MessageCircle className="h-6 w-6" />
      </motion.button>
      {portalContainer && createPortal(
        <ChatPanel
          isOpen={isOpen}
          panelPosition={panelPosition}
          isMobile={isMobile}
          messages={messages}
          isLoadingHistory={isLoadingHistory}
          isLoadingOlderHistory={isLoadingOlderHistory}
          totalHistoryMessages={totalHistoryMessages}
          isSending={isSending}
          error={error}
          canSend={canSend}
          onClose={() => setIsOpen(false)}
          onSend={sendMessage}
          onStartNewConversation={() => startNewConversation()}
          onLoadOlderHistory={loadOlderHistory}
        />,
        portalContainer,
      )}
    </>
  );

  return widget;
}
