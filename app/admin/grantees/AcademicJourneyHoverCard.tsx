"use client";

import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import AcademicJourneyMap from "@/app/components/AcademicJourneyMap";

type Position = {
  left: number;
  top: number;
};

export default function AcademicJourneyHoverCard({
  fullName,
  completedSemesters,
}: {
  fullName: string;
  completedSemesters: number;
}) {
  const [position, setPosition] = useState<Position | null>(null);
  const closeTimer = useRef<number | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }, []);

  function updatePosition(element: HTMLElement) {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);

    const bounds = element.getBoundingClientRect();
    const width = popoverRef.current?.getBoundingClientRect().width
      ?? Math.min(380, window.innerWidth - 24);
    const height = popoverRef.current?.getBoundingClientRect().height ?? 160;
    const left = Math.max(12, Math.min(bounds.left, window.innerWidth - width - 12));
    const below = bounds.bottom + 8;
    const top = below + height <= window.innerHeight - 12
      ? below
      : Math.max(12, bounds.top - height - 8);
    setPosition({ left, top });
  }

  function openAt(element: HTMLElement) {
    triggerRef.current = element;
    updatePosition(element);
  }

  function scheduleClose() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setPosition(null), 120);
  }

  function keepOpen() {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
  }

  useLayoutEffect(() => {
    if (!position || !triggerRef.current || !popoverRef.current) return;

    const updateMeasuredPosition = () => {
      const element = triggerRef.current;
      const popover = popoverRef.current;
      if (!element || !popover) return;

      const triggerBounds = element.getBoundingClientRect();
      const popoverBounds = popover.getBoundingClientRect();
      const left = Math.max(12, Math.min(triggerBounds.left, window.innerWidth - popoverBounds.width - 12));
      const below = triggerBounds.bottom + 8;
      const top = Math.min(
        Math.max(12, below + popoverBounds.height <= window.innerHeight - 12
          ? below
          : triggerBounds.top - popoverBounds.height - 8),
        window.innerHeight - popoverBounds.height - 12
      );

      setPosition((current) => (
        current && current.left === left && current.top === top
          ? current
          : { left, top: Math.max(12, top) }
      ));
    };

    updateMeasuredPosition();
    window.addEventListener("resize", updateMeasuredPosition);
    window.addEventListener("scroll", updateMeasuredPosition, true);
    return () => {
      window.removeEventListener("resize", updateMeasuredPosition);
      window.removeEventListener("scroll", updateMeasuredPosition, true);
    };
  }, [position]);

  return (
    <>
      <button
        type="button"
        aria-label={`Preview academic journey for ${fullName}`}
        onMouseEnter={(event) => openAt(event.currentTarget)}
        onMouseLeave={scheduleClose}
        onFocus={(event) => openAt(event.currentTarget)}
        onBlur={scheduleClose}
        className="absolute inset-0 z-10 cursor-help rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-500"
      />
      {position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              role="tooltip"
              onMouseEnter={keepOpen}
              onMouseLeave={scheduleClose}
              className="fixed z-[100] h-auto w-[380px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-700 bg-slate-900 p-4 text-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
              style={{ left: position.left, top: position.top }}
            >
              <AcademicJourneyMap currentSemesterIndex={completedSemesters} compact />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
