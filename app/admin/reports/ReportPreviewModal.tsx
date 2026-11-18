"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, LoaderCircle, X } from "lucide-react";
import type { ReportCard } from "./ReportsDashboard";
import { downloadReport } from "./report-download";
import type { ReportDataset, ReportRow } from "@/lib/report-dataset";
import {
  ARCHIVE_REASON_FILTER_LABELS,
  ARCHIVE_REASON_FILTER_OPTIONS,
} from "./report-filters";

type ReportPreviewModalProps = {
  report: ReportCard;
  archivedReasonFilter: string;
  onArchivedReasonChange: (reason: string) => void;
  archivedStartDate: string;
  archivedEndDate: string;
  onArchivedDateRangeChange: (startDate: string, endDate: string) => void;
  onClose: () => void;
};

type ReportPreviewResponse = ReportDataset & {
  generatedAt: string;
  isAggregate: boolean;
  previewLimit: number;
};

function getActiveFilterLabels(
  report: ReportCard,
  archivedReasonFilter: string,
  archivedStartDate: string,
  archivedEndDate: string,
) {
  const params = new URL(report.href, "http://reports.local").searchParams;
  const labels: string[] = [];
  if (params.get("filter") === "all_approved") labels.push("Approved profiles");
  if (params.has("classification")) labels.push(params.get("classification") ?? "");
  if (params.get("skVoter") === "true") labels.push("SK Registered Voters");
  if (params.has("semester")) labels.push(`Semester: ${params.get("semester")}`);
  if (report.reportKey === "archived_youth") {
    if (archivedReasonFilter !== "all") {
      labels.push(`Reason: ${ARCHIVE_REASON_FILTER_LABELS[archivedReasonFilter] ?? archivedReasonFilter}`);
    }
    if (archivedStartDate || archivedEndDate) {
      labels.push(`Archived: ${archivedStartDate || "Any"} – ${archivedEndDate || "Any"}`);
    }
  }
  return labels.filter(Boolean);
}

function formatCell(value: unknown, header: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (
    typeof value === "string" &&
    /date| at$/i.test(header) &&
    /^\d{4}-\d{2}-\d{2}T/.test(value)
  ) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat("en-PH", {
        dateStyle: "medium",
        timeZone: "Asia/Manila",
      }).format(date);
    }
  }
  return String(value);
}

function SkeletonTable() {
  return (
    <div aria-label="Loading report preview" className="animate-pulse">
      <div className="mb-3 h-4 w-56 rounded bg-slate-200" />
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="h-10 bg-slate-100" />
        {Array.from({ length: 6 }, (_, index) => (
          <div
            key={index}
            className="grid grid-cols-4 gap-3 border-t border-slate-100 px-4 py-3"
          >
            {Array.from({ length: 4 }, (_, cellIndex) => (
              <div key={cellIndex} className="h-3 rounded bg-slate-100" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ReportPreviewModal({
  report,
  archivedReasonFilter,
  onArchivedReasonChange,
  archivedStartDate,
  archivedEndDate,
  onArchivedDateRangeChange,
  onClose,
}: ReportPreviewModalProps) {
  const [previewState, setPreviewState] = useState<{
    key: string;
    preview: ReportPreviewResponse | null;
    error: string | null;
  }>({ key: "", preview: null, error: null });
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const makeFilterParams = useCallback(() => {
    const hrefUrl = new URL(report.href, window.location.origin);
    const params = new URLSearchParams(hrefUrl.searchParams);
    params.set("type", report.reportKey);
    if (report.reportKey === "archived_youth") {
      if (archivedReasonFilter === "all") params.delete("archiveReason");
      else params.set("archiveReason", archivedReasonFilter);
      if (archivedStartDate) params.set("startDate", archivedStartDate);
      else params.delete("startDate");
      if (archivedEndDate) params.set("endDate", archivedEndDate);
      else params.delete("endDate");
    }
    return params;
  }, [report, archivedEndDate, archivedReasonFilter, archivedStartDate]);

  const requestKey = [
    report.href,
    report.reportKey,
    archivedReasonFilter,
    archivedStartDate,
    archivedEndDate,
  ].join("|");
  const stateMatchesRequest = previewState.key === requestKey;
  const preview = stateMatchesRequest ? previewState.preview : null;
  const error = stateMatchesRequest ? previewState.error : null;
  const isLoading = !stateMatchesRequest;
  const generatedAt = preview ? new Date(preview.generatedAt) : null;

  useEffect(() => {
    const controller = new AbortController();
    const params = makeFilterParams();
    void fetch(`/api/admin/reports/preview?${params.toString()}`, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok) {
          throw new Error(payload?.error || "Unable to load report preview.");
        }
        return payload as ReportPreviewResponse;
      })
      .then((payload) => {
        setPreviewState({ key: requestKey, preview: payload, error: null });
      })
      .catch((fetchError: unknown) => {
        if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;
        setPreviewState({
          key: requestKey,
          preview: null,
          error: fetchError instanceof Error ? fetchError.message : "Unable to load report preview.",
        });
      });
    return () => controller.abort();
  }, [makeFilterParams, requestKey]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isDownloading) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isDownloading, onClose]);

  const activeFilters = useMemo(
    () => getActiveFilterLabels(report, archivedReasonFilter, archivedStartDate, archivedEndDate),
    [report, archivedEndDate, archivedReasonFilter, archivedStartDate],
  );

  const downloadFullReport = async () => {
    setIsDownloading(true);
    setDownloadError(null);
    try {
      const params = Object.fromEntries(makeFilterParams().entries());
      await downloadReport({ href: report.href, title: report.title, params });
    } catch (downloadFailure) {
      setDownloadError(
        downloadFailure instanceof Error ? downloadFailure.message : "Unable to download this report.",
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const closeOnBackdrop = (event: React.MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget && !isDownloading) onClose();
  };

  const rows = preview?.rows ?? [];
  const columns = preview?.columns ?? [];
  const aggregate = preview?.isAggregate === true;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:p-5"
      onMouseDown={closeOnBackdrop}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-preview-title"
        className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="report-preview-title" className="text-lg font-bold tracking-tight text-slate-900">
                {report.title}
              </h2>
              {activeFilters.length ? (
                <span className="inline-flex max-w-full items-center truncate rounded-full bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-800 ring-1 ring-inset ring-cyan-200">
                  {activeFilters.join(" · ")}
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-sm text-slate-500">{report.description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {generatedAt && !Number.isNaN(generatedAt.getTime()) ? (
              <p className="max-w-36 text-right text-[11px] leading-4 text-slate-400 sm:max-w-none">
                Generated{" "}
                {new Intl.DateTimeFormat("en-PH", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Manila",
                }).format(generatedAt)}
              </p>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close report preview"
              className="shrink-0 rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
            >
              <X aria-hidden="true" className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="grid shrink-0 grid-cols-2 gap-3 border-b border-slate-100 px-5 py-4 sm:grid-cols-3 sm:px-6">
          {preview?.summary.map((metric) => (
            <div key={metric.label} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
              <p className="truncate text-[11px] font-medium uppercase tracking-wide text-slate-500">{metric.label}</p>
              <p className="mt-1 truncate text-base font-bold text-slate-900">{metric.value.toLocaleString("en-PH")}</p>
            </div>
          ))}
          {isLoading
            ? Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="h-[62px] animate-pulse rounded-xl bg-slate-100" />
              ))
            : null}
        </div>

        {report.reportKey === "archived_youth" ? (
          <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 px-5 py-3 sm:px-6">
            <label className="min-w-52 flex-1 space-y-1 text-xs font-medium text-slate-600">
              <span>Filter by archive reason</span>
              <select
                value={archivedReasonFilter}
                onChange={(event) => onArchivedReasonChange(event.target.value)}
                className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
              >
                {ARCHIVE_REASON_FILTER_OPTIONS.map(({ value, label }) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              <span>Archived from</span>
              <input
                type="date"
                value={archivedStartDate}
                onChange={(event) => onArchivedDateRangeChange(event.target.value, archivedEndDate)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
              />
            </label>
            <label className="space-y-1 text-xs font-medium text-slate-600">
              <span>Archived through</span>
              <input
                type="date"
                value={archivedEndDate}
                onChange={(event) => onArchivedDateRangeChange(archivedStartDate, event.target.value)}
                className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-800 outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10"
              />
            </label>
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-hidden px-5 py-4 sm:px-6">
          {error ? (
            <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </p>
          ) : isLoading ? (
            <SkeletonTable />
          ) : preview ? (
            <div className="flex h-full min-h-0 flex-col">
              {!aggregate ? (
                <p className="mb-2 shrink-0 text-xs text-slate-500">
                  Showing top 20 of {preview.totalCount.toLocaleString("en-PH")} records. Download the .xlsx file for the complete dataset.
                </p>
              ) : null}
              <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-max border-collapse text-left text-xs">
                  <thead className="sticky top-0 z-10 bg-slate-100 text-slate-700 shadow-sm">
                    <tr>
                      {columns.map((column, index) => (
                        <th key={`${column.key}-${index}`} className="whitespace-nowrap px-3 py-2.5 font-semibold">
                          {column.header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {rows.length ? rows.map((row: ReportRow, rowIndex) => (
                      <tr key={rowIndex} className="hover:bg-slate-50">
                        {columns.map((column, columnIndex) => (
                          <td key={`${column.key}-${columnIndex}`} className="max-w-72 px-3 py-2.5 align-top">
                            <span className="block truncate" title={formatCell(row[column.key], column.header)}>
                              {formatCell(row[column.key], column.header)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={Math.max(columns.length, 1)} className="px-4 py-10 text-center text-sm text-slate-500">
                          No records match the selected filters.
                        </td>
                      </tr>
                    )}
                  </tbody>
                  {preview.grandTotalRow ? (
                    <tfoot className="sticky bottom-0 z-10 border-t-2 border-slate-300 bg-slate-50 font-bold text-slate-900">
                      <tr>
                        {columns.map((column, index) => (
                          <td key={`${column.key}-${index}`} className="whitespace-nowrap px-3 py-2.5">
                            {formatCell(preview.grandTotalRow?.[column.key], column.header)}
                          </td>
                        ))}
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            </div>
          ) : null}
        </main>

        <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-slate-100 bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="min-w-0">
            {downloadError ? <p role="alert" className="text-xs text-rose-700">{downloadError}</p> : null}
            {report.reportKey === "demographic_distribution" ? (
              <p className="text-xs text-slate-500">{preview?.note}</p>
            ) : null}
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => void downloadFullReport()}
              disabled={isLoading || Boolean(error) || isDownloading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0F2942] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0b2035] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              {isDownloading ? (
                <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <Download aria-hidden="true" className="h-4 w-4" />
              )}
              {isDownloading ? "Preparing..." : "Download Full Report (.xlsx)"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
