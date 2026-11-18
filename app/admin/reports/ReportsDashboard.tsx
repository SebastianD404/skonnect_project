"use client";

import { useRef, useState } from "react";
import {
  Archive,
  Banknote,
  BadgeCheck,
  Clock,
  Download,
  FileCheck,
  GraduationCap,
  History,
  LoaderCircle,
  SlidersHorizontal,
  UsersRound,
  UserX,
  Eye,
} from "lucide-react";
import ReportConfigurationModal from "./ReportConfigurationModal";
import ReportPreviewModal from "./ReportPreviewModal";
import { downloadReport } from "./report-download";
import type { ReportKey } from "@/lib/report-dataset";

export type ReportIcon =
  | "archive"
  | "banknote"
  | "badge-check"
  | "clock"
  | "file-check"
  | "graduation-cap"
  | "history"
  | "users"
  | "user-x";

export type ReportCard = {
  title: string;
  description: string;
  href: string;
  reportKey: ReportKey;
  icon: ReportIcon;
  reportType:
    | "SKEAP_FINANCIAL"
    | "ARCHIVED_RECORDS"
    | "REVOKED_GRANTEES"
    | "PENDING_DOCUMENTS"
    | "STATIC";
  semesterOptions?: Array<{ value: string; label: string }>;
};

export type ReportSection = {
  title: string;
  description: string;
  reports: ReportCard[];
};

const REPORT_ICONS = {
  archive: Archive,
  banknote: Banknote,
  "badge-check": BadgeCheck,
  clock: Clock,
  "file-check": FileCheck,
  "graduation-cap": GraduationCap,
  history: History,
  users: UsersRound,
  "user-x": UserX,
} satisfies Record<ReportIcon, typeof Archive>;

export default function ReportsDashboard({ sections }: { sections: ReportSection[] }) {
  const [selectedReport, setSelectedReport] = useState<ReportCard | null>(null);
  const [previewReport, setPreviewReport] = useState<ReportCard | null>(null);
  const [archivedReasonFilter, setArchivedReasonFilter] = useState("all");
  const [archivedStartDate, setArchivedStartDate] = useState("");
  const [archivedEndDate, setArchivedEndDate] = useState("");
  const [exportingReports, setExportingReports] = useState<Set<string>>(() => new Set());
  const [exportErrors, setExportErrors] = useState<Record<string, string>>({});
  const advancedButtonRef = useRef<HTMLButtonElement>(null);

  const quickExport = async (report: ReportCard) => {
    setExportingReports((current) => new Set(current).add(report.title));
    setExportErrors((current) => {
      const next = { ...current };
      delete next[report.title];
      return next;
    });
    try {
      await downloadReport({
        href: report.href,
        title: report.title,
        params: report.reportKey === "archived_youth"
          ? {
              ...(archivedReasonFilter !== "all" ? { archiveReason: archivedReasonFilter } : {}),
              ...(archivedStartDate ? { startDate: archivedStartDate } : {}),
              ...(archivedEndDate ? { endDate: archivedEndDate } : {}),
            }
          : {},
      });
    } catch (error) {
      setExportErrors((current) => ({
        ...current,
        [report.title]: error instanceof Error ? error.message : "Unable to generate this report.",
      }));
    } finally {
      setExportingReports((current) => {
        const next = new Set(current);
        next.delete(report.title);
        return next;
      });
    }
  };

  return (
    <>
      {sections.map(({ title, description, reports }, sectionIndex) => (
        <section
          key={title}
          aria-labelledby={`report-section-${sectionIndex}`}
          className={sectionIndex > 0 ? "space-y-5 border-t border-slate-200 pt-6" : "space-y-5"}
        >
          <div>
            <h2 id={`report-section-${sectionIndex}`} className="text-lg font-bold tracking-tight text-slate-900">
              {title}
            </h2>
            <p className="mt-1 text-sm text-slate-500">{description}</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {reports.map((report) => {
              const Icon = REPORT_ICONS[report.icon];
              return (
                <article
                  key={report.title}
                  aria-label={`Preview ${report.title}`}
                  tabIndex={0}
                  onClick={() => setPreviewReport(report)}
                  onKeyDown={(event) => {
                    if (event.target !== event.currentTarget) return;
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPreviewReport(report);
                    }
                  }}
                  className="group flex cursor-pointer flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                      <Icon aria-hidden="true" className="h-5 w-5" />
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs text-slate-400 transition group-hover:text-slate-700">
                      <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                      Preview
                    </span>
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-slate-900">{report.title}</h3>
                  <p className="mt-1 flex-1 text-sm leading-relaxed text-slate-500">{report.description}</p>
                  <div className="mt-5 flex h-10">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        void quickExport(report);
                      }}
                      disabled={exportingReports.has(report.title)}
                      className={`inline-flex min-w-0 flex-1 items-center justify-center gap-2 ${
                        report.reportType === "STATIC" ? "rounded-xl" : "rounded-l-xl"
                      } bg-[#0F3D5C] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60`}
                      aria-live="polite"
                    >
                      {exportingReports.has(report.title) ? (
                        <LoaderCircle aria-hidden="true" className="h-4 w-4 shrink-0 animate-spin" />
                      ) : (
                        <Download aria-hidden="true" className="h-4 w-4 shrink-0" />
                      )}
                      <span className="truncate">
                        {exportingReports.has(report.title) ? "Preparing..." : "Quick Export (.xlsx)"}
                      </span>
                    </button>
                    {report.reportType !== "STATIC" ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedReport(report);
                          advancedButtonRef.current = event.currentTarget;
                        }}
                        aria-label={`Advanced settings for ${report.title}`}
                        aria-haspopup="dialog"
                        title="Advanced settings"
                        className="inline-flex w-10 shrink-0 items-center justify-center rounded-r-xl border border-l border-white/20 bg-[#0F3D5C] text-white transition hover:bg-[#0D2E47] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
                      >
                        <SlidersHorizontal aria-hidden="true" className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                  {exportErrors[report.title] ? (
                    <p role="alert" className="mt-2 text-xs text-rose-700">{exportErrors[report.title]}</p>
                  ) : null}
                </article>
              );
            })}
          </div>
        </section>
      ))}
      {selectedReport ? (
        <ReportConfigurationModal
          key={selectedReport.href}
          report={selectedReport}
          archivedReasonFilter={archivedReasonFilter}
          onArchivedReasonChange={setArchivedReasonFilter}
          archivedStartDate={archivedStartDate}
          archivedEndDate={archivedEndDate}
          onArchivedDateRangeChange={(startDate, endDate) => {
            setArchivedStartDate(startDate);
            setArchivedEndDate(endDate);
          }}
          onClose={() => {
            setSelectedReport(null);
            window.requestAnimationFrame(() => advancedButtonRef.current?.focus());
          }}
        />
      ) : null}
      {previewReport ? (
        <ReportPreviewModal
          report={previewReport}
          archivedReasonFilter={archivedReasonFilter}
          onArchivedReasonChange={setArchivedReasonFilter}
          archivedStartDate={archivedStartDate}
          archivedEndDate={archivedEndDate}
          onArchivedDateRangeChange={(startDate, endDate) => {
            setArchivedStartDate(startDate);
            setArchivedEndDate(endDate);
          }}
          onClose={() => setPreviewReport(null)}
        />
      ) : null}
    </>
  );
}
