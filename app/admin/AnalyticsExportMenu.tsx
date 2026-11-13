"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  FileSpreadsheet,
  Image as ImageIcon,
  MoreVertical,
} from "lucide-react";

interface AnalyticsExportMenuProps {
  label: string;
  onExportImage: () => void | Promise<void>;
  onExportTable: () => void | Promise<void>;
}

export default function AnalyticsExportMenu({
  label,
  onExportImage,
  onExportTable,
}: AnalyticsExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !exportMenuRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const runExport = async (type: "image" | "table") => {
    setExportError(null);
    try {
      if (type === "image") {
        await onExportImage();
      } else {
        await onExportTable();
      }
      setIsOpen(false);
    } catch (error) {
      console.error(`Failed to export ${label} ${type}:`, error);
      setExportError(
        type === "image"
          ? "Unable to export the chart image. Please try again."
          : "Unable to export the data table. Please try again.",
      );
    }
  };

  return (
    <div
      ref={exportMenuRef}
      data-export-ignore="true"
      className="relative ml-auto shrink-0"
    >
      <button
        type="button"
        aria-label={`Export ${label}`}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={menuId}
        onClick={() => {
          setExportError(null);
          setIsOpen((open) => !open);
        }}
        className="rounded-full p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
      >
        <MoreVertical className="h-5 w-5" aria-hidden="true" />
      </button>
      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label={`Export ${label}`}
          className="absolute right-0 top-full z-20 mt-2 w-60 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => void runExport("image")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ImageIcon className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Download as Image (.png)
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => void runExport("table")}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-slate-500" aria-hidden="true" />
            Export Data Table (.xlsx)
          </button>
          {exportError ? (
            <p role="alert" className="px-3 py-2 text-xs text-rose-700">
              {exportError}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
