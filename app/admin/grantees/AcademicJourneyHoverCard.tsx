"use client";

import { createPortal } from "react-dom";
import { useLayoutEffect, useRef, useState } from "react";
import type { AcademicJourneyNode } from "@/lib/academic-journey";
import AcademicJourneyStepper from "./AcademicJourneyStepper";

type JourneyStepperNode = Pick<
  AcademicJourneyNode,
  "index" | "semester" | "yearNumber" | "semesterNumber" | "academicTermCaption" | "status"
>;

type Position = {
  left: number;
  top: number;
};

export default function AcademicJourneyHoverCard({
  id,
  fullName,
  anchor,
  nodes,
  validatedCount,
  configured,
}: {
  id: string;
  fullName: string;
  anchor: HTMLTableRowElement | null;
  nodes: JourneyStepperNode[];
  validatedCount: number;
  configured: boolean;
}) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<Position | null>(null);

  useLayoutEffect(() => {
    if (!anchor) return;

    const updatePosition = () => {
      const bounds = anchor.getBoundingClientRect();
      const popover = popoverRef.current;
      const width = popover?.getBoundingClientRect().width
        ?? Math.min(440, window.innerWidth - 24);
      const height = popover?.getBoundingClientRect().height ?? 100;
      const left = Math.max(12, Math.min(bounds.left + 12, window.innerWidth - width - 12));
      const below = bounds.bottom + 8;
      const top = below + height <= window.innerHeight - 12
        ? below
        : Math.max(12, bounds.top - height - 8);

      setPosition((current) =>
        current?.left === left && current.top === top ? current : { left, top },
      );
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor]);

  if (!anchor || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={popoverRef}
      id={`academic-journey-${id}`}
      role="tooltip"
      aria-label={`Academic Journey for ${fullName}`}
      className="pointer-events-none fixed z-50 w-[440px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-800 bg-[#0B192C] p-3 shadow-xl"
      style={{
        left: position?.left ?? 12,
        top: position?.top ?? 12,
        visibility: position ? "visible" : "hidden",
      }}
    >
      <p className="mb-2 truncate text-xs font-semibold text-slate-100">{fullName}</p>
      <AcademicJourneyStepper
        nodes={nodes}
        validatedCount={validatedCount}
        configured={configured}
      />
    </div>,
    document.body,
  );
}
