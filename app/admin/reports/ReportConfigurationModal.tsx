"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, X } from "lucide-react";
import type { ReportCard } from "./ReportsDashboard";
import { downloadReport } from "./report-download";

type ReportConfigurationModalProps = {
  report: ReportCard;
  onClose: () => void;
};

export default function ReportConfigurationModal({
  report,
  onClose,
}: ReportConfigurationModalProps) {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [semester, setSemester] = useState(() => (
    new URL(report.href, "http://reports.local").searchParams.get("semester")
      ?? report.semesterOptions?.[0]?.value
      ?? ""
  ));
  const [reason, setReason] = useState("all");
  const [missingDocument, setMissingDocument] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isGenerating) onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating, onClose]);

  const generateReport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (report.reportType === "ARCHIVED_RECORDS" && startDate && endDate && startDate > endDate) {
      setError("Start Date cannot be after End Date.");
      return;
    }

    setError(null);
    setIsGenerating(true);
    try {
      let params: Record<string, string> = {};
      switch (report.reportType) {
        case "SKEAP_FINANCIAL":
          params = semester ? { semester } : {};
          break;
        case "ARCHIVED_RECORDS":
          params = {
            ...(startDate ? { startDate } : {}),
            ...(endDate ? { endDate } : {}),
          };
          break;
        case "REVOKED_GRANTEES":
          params = reason === "all" ? {} : { reason };
          break;
        case "PENDING_DOCUMENTS":
          params = missingDocument === "all" ? {} : { missingDocument };
          break;
        case "STATIC":
          break;
      }

      await downloadReport({ href: report.href, title: report.title, params });
      onClose();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Unable to generate this report.");
    } finally {
      setIsGenerating(false);
    }
  };

  const renderReportFilters = () => {
    switch (report.reportType) {
      case "SKEAP_FINANCIAL":
        return (
          <label className="block space-y-1.5 text-xs font-medium text-slate-600">
            <span>Semester</span>
            <select
              value={semester}
              onChange={(event) => setSemester(event.target.value)}
              disabled={isGenerating}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 disabled:bg-slate-50"
            >
              {(report.semesterOptions ?? []).map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        );
      case "ARCHIVED_RECORDS":
        return (
          <fieldset>
            <legend className="text-sm font-semibold text-slate-800">Archive date range (optional)</legend>
            <p className="mt-1 text-xs text-slate-500">
              Filters by the date the youth profile was archived.
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                <span>Start Date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  disabled={isGenerating}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 disabled:bg-slate-50"
                />
              </label>
              <label className="space-y-1.5 text-xs font-medium text-slate-600">
                <span>End Date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  disabled={isGenerating}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 disabled:bg-slate-50"
                />
              </label>
            </div>
          </fieldset>
        );
      case "REVOKED_GRANTEES":
        return (
          <label className="block space-y-1.5 text-xs font-medium text-slate-600">
            <span>Revocation Reason</span>
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              disabled={isGenerating}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 disabled:bg-slate-50"
            >
              <option value="all">All reasons</option>
              <option value="failing_grades">Failing Grades</option>
              <option value="misconduct">Misconduct</option>
              <option value="moved_out_of_barangay">Moved out of Barangay</option>
            </select>
          </label>
        );
      case "PENDING_DOCUMENTS":
        return (
          <label className="block space-y-1.5 text-xs font-medium text-slate-600">
            <span>Missing Document Type</span>
            <select
              value={missingDocument}
              onChange={(event) => setMissingDocument(event.target.value)}
              disabled={isGenerating}
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none transition focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/10 disabled:bg-slate-50"
            >
              <option value="all">All Missing Documents</option>
              <option value="grades">Grades</option>
              <option value="coe">COE</option>
            </select>
          </label>
        );
      case "STATIC":
        return null;
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isGenerating) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="report-configuration-title"
        aria-describedby="report-configuration-description"
        className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="report-configuration-title" className="text-lg font-bold tracking-tight text-slate-900">
              Custom Report Export
            </h2>
            <p id="report-configuration-description" className="mt-1 text-sm font-semibold text-slate-700">
              {report.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">{report.description}</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            aria-label="Close report configuration"
            className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 disabled:opacity-50"
          >
            <X aria-hidden="true" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={generateReport} className="mt-6 space-y-5">
          {renderReportFilters()}

          {error ? (
            <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          <div className="flex justify-end border-t border-slate-100 pt-4">
            <button
              type="submit"
              disabled={isGenerating}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-[#0F3D5C] px-4 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60"
            >
              <Download aria-hidden="true" className="h-4 w-4" />
              {isGenerating ? "Generating..." : "Generate & Download"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
