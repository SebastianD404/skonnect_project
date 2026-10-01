"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";

interface AdminExportButtonProps {
  href: string;
  className: string;
  iconClassName?: string;
  label?: string;
}

type ExportState = "idle" | "exporting" | "error";

export default function AdminExportButton({
  href,
  className,
  iconClassName = "h-4 w-4",
  label = "Export Records",
}: AdminExportButtonProps) {
  const [exportState, setExportState] = useState<ExportState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);
  }, []);

  async function handleExport() {
    if (exportState === "exporting") return;
    if (resetTimerRef.current !== null) window.clearTimeout(resetTimerRef.current);

    setExportState("exporting");
    setErrorMessage(null);

    try {
      const response = await fetch(href, { cache: "no-store" });
      if (!response.ok) {
        let message = `Export failed (${response.status}).`;
        try {
          const payload = await response.json() as { error?: string };
          if (payload.error) message = payload.error;
        } catch {
          // Keep the status-based message when the server response is not JSON.
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get("content-disposition") ?? "";
      const encodedName = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
      const plainName = contentDisposition.match(/filename="?([^";]+)"?/i)?.[1];
      let filename = plainName?.trim() || "export.xlsx";
      if (encodedName) {
        try {
          filename = decodeURIComponent(encodedName.trim());
        } catch {
          filename = encodedName.trim();
        }
      }

      const objectUrl = URL.createObjectURL(blob);
      const downloadLink = document.createElement("a");
      downloadLink.href = objectUrl;
      downloadLink.download = filename;
      downloadLink.style.display = "none";
      document.body.appendChild(downloadLink);
      downloadLink.click();
      downloadLink.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);

      setExportState("idle");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to export records.");
      setExportState("error");
      resetTimerRef.current = window.setTimeout(() => {
        setExportState("idle");
        setErrorMessage(null);
      }, 4000);
    }
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      disabled={exportState === "exporting"}
      aria-busy={exportState === "exporting"}
      aria-live="polite"
      title={errorMessage ?? label}
      className={`${className} disabled:cursor-wait disabled:opacity-70`}
    >
      {exportState === "exporting" ? (
        <Loader2 aria-hidden="true" className={`${iconClassName} animate-spin`} />
      ) : (
        <Download aria-hidden="true" className={iconClassName} />
      )}
      <span>
        {exportState === "exporting" ? "Exporting..." : exportState === "error" ? "Export failed" : label}
      </span>
    </button>
  );
}