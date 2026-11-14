"use client";

import type { ReactNode } from "react";
import { OPEN_ADMIN_INQUIRY_EVENT, OPEN_CHATBOT_EVENT } from "@/lib/program-support-events";

type ProgramActionButtonProps = {
  action: "chatbot" | "admin-inquiry";
  className: string;
  children: ReactNode;
  "aria-label"?: string;
};

export default function ProgramActionButton({
  action,
  className,
  children,
  "aria-label": ariaLabel,
}: ProgramActionButtonProps) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      className={className}
      onClick={() => {
        const eventName = action === "chatbot" ? OPEN_CHATBOT_EVENT : OPEN_ADMIN_INQUIRY_EVENT;
        window.dispatchEvent(new Event(eventName));
      }}
    >
      {children}
    </button>
  );
}
