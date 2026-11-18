"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CloudDownload,
  Copy,
  Database,
  Download,
  FileCheck2,
  Loader2,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import AdminPaginationControls from "@/app/admin/AdminPaginationControls";
import FloatingFeedback from "@/app/components/FloatingFeedback";
import { isPhtTimeAtOrAfterBackupTarget } from "@/lib/data-backup-schedule";

type BackupCounts = Record<string, number>;

type BackupHistoryItem = {
  id: string;
  fileName: string;
  trigger: "MANUAL" | "SCHEDULED" | "AUTOMATED";
  type: "MANUAL" | "SCHEDULED";
  status: "COMPLETED" | "FAILED";
  recordCounts: BackupCounts;
  fileSizeBytes: number;
  checksumSha256: string;
  createdAt: string;
  createdBy: string | null;
  storagePath: string | null;
  errorMessage: string | null;
  downloadAvailable: boolean;
};

type BackupOverview = {
  serverNow: string;
  recentBackups: BackupHistoryItem[];
  lastSuccessfulBackupAt: string | null;
  currentPhtHour: number;
  currentPhtMinute: number;
  scheduledBackupToday: boolean;
  liveRecordCounts: BackupCounts | null;
  error?: string | null;
};

type VerifyResponse = {
  checksumVerified: true;
  checksumSha256: string;
  fileName: string;
  createdAt: string;
  recordCounts: BackupCounts;
};

type RestoreSummary = {
  created: number;
  updated: number;
  skipped: number;
};

const HISTORY_PAGE_SIZES = [5, 10, 25] as const;

const RECORD_COUNT_LABELS: Record<string, string> = {
  users: "Users",
  kkProfiles: "KK Profiles",
  profilingRegistrations: "Profiling Reg.",
  skeapApplications: "SKEAP Apps",
  grantees: "Grantees",
  submissions: "Submissions",
  accountingPayouts: "Accounting Payouts",
  inquiries: "Inquiries",
  announcements: "Announcements",
  notifications: "Notifications",
  notificationLogs: "Notification Logs",
  adminNotifications: "Admin Alerts",
  granteeMessages: "Grantee Messages",
  registrations: "Registrations",
  systemSettings: "System Settings",
  adminSettings: "Admin Settings",
  academicTermSchedules: "Term Schedules",
  semesters: "Semesters",
  reminderSettings: "Reminder Rules",
  messageTemplates: "Message Templates",
};

function formatRecordCountLabel(key: string) {
  return RECORD_COUNT_LABELS[key] ?? key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z])([A-Z][a-z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value: string | null) {
  if (!value) return "No backup yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(date);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size < 10 ? 1 : 0)} ${units[unitIndex]}`;
}

async function readJsonResponse(response: Response) {
  const text = await response.text();
  try {
    return text ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    throw new Error(`Backup service returned an invalid response (HTTP ${response.status}).`);
  }
}

async function fetchBackupOverview(): Promise<BackupOverview> {
  const response = await fetch("/api/admin/backups", { cache: "no-store" });
  const body = await readJsonResponse(response);
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : "Unable to load backup history.");
  }
  return body as unknown as BackupOverview;
}

function getLatestCronError(backups: BackupHistoryItem[]) {
  const latestCronBackup = backups.find((backup) => backup.type === "SCHEDULED");
  return latestCronBackup?.status === "FAILED" ? latestCronBackup.errorMessage : null;
}

function hasRecentBackup(overview: BackupOverview | null) {
  if (!overview?.lastSuccessfulBackupAt) return false;
  const latestBackupAt = new Date(overview.lastSuccessfulBackupAt).getTime();
  const serverNow = new Date(overview.serverNow).getTime();
  const age = serverNow - latestBackupAt;
  return Number.isFinite(age) && age >= 0 && age < 24 * 60 * 60 * 1000;
}

export default function DataBackupSection() {
  const router = useRouter();
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOverviewError, setIsOverviewError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [verification, setVerification] = useState<VerifyResponse | null>(null);
  const [confirmation, setConfirmation] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const [checksumCopied, setChecksumCopied] = useState(false);
  const [checksumCopyError, setChecksumCopyError] = useState<string | null>(null);
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "MANUAL" | "SCHEDULED">("ALL");
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState<number>(HISTORY_PAGE_SIZES[0]);
  const [historyCopiedId, setHistoryCopiedId] = useState<string | null>(null);
  const [historyCopyError, setHistoryCopyError] = useState<string | null>(null);
  const [isRunningNow, setIsRunningNow] = useState(false);
  const [scheduleFeedback, setScheduleFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchBackupOverview();
      setOverview(data);
      setError(data.error ?? getLatestCronError(data.recentBackups));
      setIsOverviewError(Boolean(data.error));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load backup history.");
      setIsOverviewError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetchBackupOverview()
      .then((data) => {
        if (!active) return;
        setOverview(data);
        setError(data.error ?? getLatestCronError(data.recentBackups));
        setIsOverviewError(Boolean(data.error));
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "Unable to load backup history.");
          setIsOverviewError(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const protectedRecordCount = overview?.liveRecordCounts
    ? Object.values(overview.liveRecordCounts).reduce((total, count) => total + count, 0)
    : null;
  const backedUpRecently = hasRecentBackup(overview);
  const filteredBackups = (overview?.recentBackups ?? []).filter((backup) => {
    if (historyFilter === "ALL") return true;
    return backup.type === historyFilter;
  });
  const filteredCount = filteredBackups.length;
  const pageCount = Math.max(1, Math.ceil(filteredCount / historyPageSize));
  const currentPage = Math.min(historyPage, pageCount);
  const pageBackups = filteredBackups.slice(
    (currentPage - 1) * historyPageSize,
    currentPage * historyPageSize,
  );
  const start = filteredCount === 0 ? 0 : (currentPage - 1) * historyPageSize + 1;
  const end = Math.min(currentPage * historyPageSize, filteredCount);
  const nextRunLabel = overview?.scheduledBackupToday
    ? "Tomorrow, 8:15 PM PHT"
    : overview && isPhtTimeAtOrAfterBackupTarget(overview.currentPhtHour, overview.currentPhtMinute)
      ? "Catch-up pending"
      : "Today, 8:15 PM PHT";

  async function handleDownloadBackup() {
    if (isDownloading) return;
    setIsDownloading(true);
    setError(null);
    setIsOverviewError(false);
    try {
      const response = await fetch("/api/admin/backups/export", { method: "POST" });
      if (!response.ok) {
        const body = await readJsonResponse(response);
        throw new Error(typeof body.error === "string" ? body.error : "Unable to generate a backup.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition");
      const fileName = disposition?.match(/filename="([^"]+)"/i)?.[1] ?? "skonnect-backup.json";
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      await loadOverview();
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to generate a backup.");
    } finally {
      setIsDownloading(false);
    }
  }

  async function handleRunScheduledBackupNow() {
    if (isRunningNow) return;
    setIsRunningNow(true);
    setScheduleFeedback(null);
    try {
      const response = await fetch("/api/cron/daily-backup", { method: "POST" });
      const body = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to run the scheduled backup.");
      }
      setScheduleFeedback({
        type: "success",
        message: body.skipped === true
          ? "Today's scheduled backup already exists."
          : "Daily backup completed successfully.",
      });
      await loadOverview();
      router.refresh();
    } catch (runError) {
      setScheduleFeedback({
        type: "error",
        message: runError instanceof Error ? runError.message : "Unable to run the scheduled backup.",
      });
    } finally {
      setIsRunningNow(false);
    }
  }

  function resetRestore() {
    setSelectedFile(null);
    setVerification(null);
    setConfirmation("");
    setRestoreError(null);
    setRestoreSuccess(null);
    setIsVerifying(false);
    setIsRestoring(false);
  }

  function closeRestore() {
    if (isVerifying || isRestoring) return;
    setRestoreOpen(false);
    resetRestore();
  }

  async function handleFileChange(file: File | null) {
    setSelectedFile(file);
    setVerification(null);
    setConfirmation("");
    setRestoreSuccess(null);
    setRestoreError(null);
    setChecksumCopied(false);
    setChecksumCopyError(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".json")) {
      setRestoreError("Select a .json backup file.");
      return;
    }

    setIsVerifying(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("intent", "verify");
      const response = await fetch("/api/admin/backups/restore", { method: "POST", body: formData });
      const body = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to verify this backup.");
      }
      setVerification(body as unknown as VerifyResponse);
    } catch (verifyError) {
      setRestoreError(verifyError instanceof Error ? verifyError.message : "Unable to verify this backup.");
    } finally {
      setIsVerifying(false);
    }
  }

  async function handleRestore() {
    if (!selectedFile || !verification || confirmation !== "RESTORE" || isRestoring) return;
    setIsRestoring(true);
    setRestoreError(null);
    setRestoreSuccess(null);
    try {
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("intent", "restore");
      formData.set("confirmation", confirmation);
      const response = await fetch("/api/admin/backups/restore", { method: "POST", body: formData });
      const body = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to restore this backup.");
      }
      const summaryValue = body.summary;
      if (
        !summaryValue ||
        typeof summaryValue !== "object" ||
        !("created" in summaryValue) ||
        !("updated" in summaryValue) ||
        !("skipped" in summaryValue) ||
        typeof summaryValue.created !== "number" ||
        typeof summaryValue.updated !== "number" ||
        typeof summaryValue.skipped !== "number"
      ) {
        throw new Error("Restore completed but the service returned an invalid summary.");
      }
      const summary = summaryValue as RestoreSummary;
      setRestoreSuccess(
        `Database restored successfully · ${summary.created.toLocaleString()} added, ${summary.updated.toLocaleString()} updated, ${summary.skipped.toLocaleString()} unchanged`,
      );
      setVerification(null);
      setSelectedFile(null);
      setConfirmation("");
      await loadOverview();
    } catch (restoreFailure) {
      setRestoreError(restoreFailure instanceof Error ? restoreFailure.message : "Unable to restore this backup.");
    } finally {
      setIsRestoring(false);
    }
  }

  async function handleCopyChecksum() {
    if (!verification) return;
    try {
      await navigator.clipboard.writeText(verification.checksumSha256);
      setChecksumCopied(true);
      setChecksumCopyError(null);
      window.setTimeout(() => setChecksumCopied(false), 1500);
    } catch (copyError) {
      setChecksumCopyError(
        copyError instanceof Error
          ? `Unable to copy checksum: ${copyError.message}`
          : "Unable to copy checksum.",
      );
    }
  }

  async function handleCopyHistoryChecksum(backup: BackupHistoryItem) {
    try {
      await navigator.clipboard.writeText(backup.checksumSha256);
      setHistoryCopiedId(backup.id);
      setHistoryCopyError(null);
      window.setTimeout(() => {
        setHistoryCopiedId((current) => current === backup.id ? null : current);
      }, 1500);
    } catch (copyError) {
      setHistoryCopyError(
        copyError instanceof Error
          ? `Unable to copy checksum: ${copyError.message}`
          : "Unable to copy checksum.",
      );
    }
  }

  return (
    <section className="py-8" aria-labelledby="data-backup-heading">
      {scheduleFeedback ? (
        <FloatingFeedback
          message={scheduleFeedback.message}
          type={scheduleFeedback.type}
          onDismiss={() => setScheduleFeedback(null)}
        />
      ) : null}
      <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800">
              <Database className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="data-backup-heading" className="text-base font-bold text-slate-950">
                Data Backup &amp; Recovery
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
                Export verifiable snapshots of Barangay Pico youth profiles, SKEAP applications, grantees, and accounting records.
              </p>
            </div>
          </div>
          <span
            className={`inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
              backedUpRecently
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-700/15"
                : "bg-slate-100 text-slate-600 ring-1 ring-inset ring-slate-500/15"
            }`}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {loading ? "Checking..." : backedUpRecently ? "Backed up recently" : "Schedule Active"}
          </span>
        </div>

        <div className="grid gap-3 border-b border-slate-100 p-5 sm:grid-cols-3 sm:p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Last Backup</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">
              {loading ? "Loading…" : formatDate(overview?.lastSuccessfulBackupAt ?? null)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Automated Schedule</p>
            <p className="mt-1.5 text-sm font-semibold text-slate-900">Daily · 8:15 PM PHT</p>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-500">
                Next run: {loading ? "—" : nextRunLabel}
              </p>
              <button
                type="button"
                onClick={() => void handleRunScheduledBackupNow()}
                disabled={isRunningNow}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-slate-700 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-800 disabled:cursor-wait disabled:opacity-60"
              >
                {isRunningNow ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : (
                  <Play className="h-3 w-3" aria-hidden="true" />
                )}
                {isRunningNow ? "Running..." : "Run Now"}
              </button>
            </div>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Protected Records</p>
            <p className="mt-1.5 text-sm font-semibold tabular-nums text-slate-900">
              {loading || protectedRecordCount === null ? "—" : protectedRecordCount.toLocaleString("en-PH")}
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 p-5 sm:p-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-wrap gap-2 xl:flex-nowrap">
            <button
              type="button"
              onClick={handleDownloadBackup}
              disabled={isDownloading}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-wait disabled:opacity-70"
            >
              {isDownloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Download className="h-3.5 w-3.5" aria-hidden="true" />}
              {isDownloading ? "Generating..." : "Download Full Backup (.JSON)"}
            </button>
            <button
              type="button"
              onClick={() => {
                resetRestore();
                setRestoreOpen(true);
              }}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Verify &amp; Restore Snapshot
            </button>
          </div>
          <p className="max-w-md text-xs leading-5 text-slate-500">
            Snapshots contain personal records. Store downloaded files securely. SHA-256 confirms integrity, not source authenticity; Supabase Auth credentials are not included.
          </p>
        </div>

        {error ? (
          <div
            role="alert"
            className="mx-5 mb-4 flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 sm:mx-6"
          >
            <span>{error}</span>
            {isOverviewError ? (
              <button
                type="button"
                onClick={() => void loadOverview()}
                disabled={loading}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-60"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                Retry
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-slate-100 px-5 py-5 sm:px-6">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-bold text-slate-900">Recent Backup History</h3>
            <div className="inline-flex items-center gap-0.5 rounded-lg border border-slate-200 bg-slate-50 p-0.5" role="group" aria-label="Filter backup history">
              {([
                ["ALL", "All"],
                ["MANUAL", "Manual"],
                ["SCHEDULED", "Scheduled"],
              ] as const).map(([filter, label]) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={historyFilter === filter}
                  onClick={() => {
                    setHistoryFilter(filter);
                    setHistoryPage(1);
                  }}
                  className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
                    historyFilter === filter
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {historyCopyError ? (
            <p role="alert" className="mb-2 text-xs font-medium text-rose-700">{historyCopyError}</p>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="border-y border-slate-200/80 bg-slate-50/80 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-3 py-2.5">Date &amp; Time</th>
                  <th className="px-3 py-2.5">Type</th>
                  <th className="px-3 py-2.5">Created By</th>
                  <th className="px-3 py-2.5">File Size</th>
                  <th className="px-3 py-2.5">SHA-256</th>
                  <th className="px-3 py-2.5">File</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pageBackups.map((backup) => (
                  <tr key={backup.id} className="text-slate-700">
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">
                      <span className="font-medium text-slate-900">{formatDate(backup.createdAt)}</span>
                      {backup.status === "FAILED" ? (
                        <span className="ml-2 rounded-full bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">Failed</span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3">{backup.type === "MANUAL" ? "Manual" : "Scheduled"}</td>
                    <td className="px-3 py-3">{backup.createdBy ?? "Automated schedule"}</td>
                    <td className="whitespace-nowrap px-3 py-3 tabular-nums">{formatFileSize(backup.fileSizeBytes)}</td>
                    <td className="px-3 py-3">
                      {backup.checksumSha256 ? (
                        <button
                          type="button"
                          title={backup.checksumSha256}
                          aria-label={`Copy SHA-256 checksum for ${backup.fileName}`}
                          onClick={() => void handleCopyHistoryChecksum(backup)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 font-mono text-[10px] transition ${
                            historyCopiedId === backup.id
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          }`}
                        >
                          {historyCopiedId === backup.id ? (
                            <>
                              <Check className="h-3 w-3" aria-hidden="true" />
                              <span className="font-sans font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="h-3 w-3" aria-hidden="true" />
                              {backup.checksumSha256.slice(0, 12)}…
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      {backup.downloadAvailable ? (
                        <a
                          href={`/api/system-admin/backup/${encodeURIComponent(backup.id)}/download`}
                          className="group inline-flex items-center gap-1.5 font-semibold text-cyan-800 hover:text-cyan-950"
                        >
                          <CloudDownload className="h-3.5 w-3.5 opacity-70 transition group-hover:opacity-100" aria-hidden="true" />
                          {backup.fileName}
                        </a>
                      ) : (
                        <span className="text-slate-400">{backup.fileName}</span>
                      )}
                    </td>
                  </tr>
                ))}
                {!loading && filteredCount > 0 && pageBackups.length < historyPageSize
                  ? Array.from({ length: historyPageSize - pageBackups.length }, (_, index) => (
                      <tr key={`history-spacer-${currentPage}-${index}`} aria-hidden="true" className="h-12">
                        <td colSpan={6} />
                      </tr>
                    ))
                  : null}
                {!loading && filteredCount === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">
                      {historyFilter === "ALL"
                        ? "No backup events have been recorded yet."
                        : `No ${historyFilter === "MANUAL" ? "manual" : "scheduled"} snapshots match this filter.`}
                    </td>
                  </tr>
                ) : null}
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-8 text-center text-slate-500">Loading backup history…</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 px-4 py-3.5">
            <div className="flex flex-wrap items-center gap-4">
              <p className="inline-flex h-8 items-center gap-1.5 text-xs text-slate-500 tabular-nums">
                {filteredCount === 0 ? (
                  <span>No snapshots found</span>
                ) : (
                  <>
                    <span>Showing</span>
                    <span className="font-semibold text-slate-900">{start}–{end}</span>
                    <span>of</span>
                    <span className="font-semibold text-slate-900">{filteredCount.toLocaleString()}</span>
                    <span>snapshots</span>
                  </>
                )}
              </p>
              <label className="inline-flex h-8 items-center gap-2 border-l border-slate-200 pl-4">
                <span className="text-xs font-medium text-slate-500">Rows per page</span>
                <select
                  aria-label="Rows per page"
                  value={historyPageSize}
                  onChange={(event) => {
                    setHistoryPageSize(Number(event.target.value));
                    setHistoryPage(1);
                  }}
                  className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 outline-none transition-colors focus:border-slate-400"
                >
                  {HISTORY_PAGE_SIZES.map((size) => (
                    <option key={size} value={size}>{size} rows</option>
                  ))}
                </select>
              </label>
            </div>
            <AdminPaginationControls
              page={currentPage}
              totalPages={pageCount}
              onPageChange={setHistoryPage}
              disabled={loading || filteredCount === 0}
            />
          </div>
        </div>
      </article>

      {restoreOpen ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/55 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="backup-restore-title"
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-100 p-5 sm:p-6">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
                  <FileCheck2 className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 id="backup-restore-title" className="text-lg font-bold text-slate-950">Verify &amp; Restore Snapshot</h2>
                  <p className="mt-1 text-sm leading-5 text-slate-500">Choose a SKonnect JSON backup and verify its integrity before restoring.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeRestore}
                disabled={isVerifying || isRestoring}
                aria-label="Close restore dialog"
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-4">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">Backup file (.json)</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  disabled={isVerifying || isRestoring}
                  onChange={(event) => void handleFileChange(event.target.files?.[0] ?? null)}
                  className="block w-full cursor-pointer rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-700 transition-colors duration-150 hover:border-slate-300 hover:bg-slate-100/70 active:scale-[0.995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600/30 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-700 file:transition-colors file:duration-150 file:hover:bg-cyan-50 file:hover:text-cyan-800 file:active:scale-[0.98]"
                />
              </label>

              {isVerifying ? (
                <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-medium text-sky-800">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  Checking the SHA-256 checksum…
                </div>
              ) : null}

              {verification ? (
                <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_8px_30px_-12px_rgba(15,23,42,0.08)]">
                  <div className="flex flex-col gap-3 border-b border-slate-100 bg-gradient-to-r from-emerald-50/80 via-teal-50/35 to-white px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-200/80 bg-emerald-500/10 text-emerald-600">
                        <ShieldCheck className="h-4 w-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900">SHA-256 Checksum Verified</p>
                        <p className="mt-0.5 truncate text-xs text-slate-500">
                          {verification.fileName} · Created {formatDate(verification.createdAt)}
                        </p>
                        <div className="mt-2 inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200/80 bg-slate-100/80 px-2.5 py-1 font-mono text-[11px] text-slate-600">
                          <span
                            className="truncate"
                            title={verification.checksumSha256}
                          >
                            {verification.checksumSha256.slice(0, 12)}...{verification.checksumSha256.slice(-12)}
                          </span>
                          <button
                            type="button"
                            onClick={() => void handleCopyChecksum()}
                            aria-label={checksumCopied ? "Checksum copied" : "Copy checksum"}
                            title={checksumCopied ? "Checksum copied" : "Copy checksum"}
                            className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 font-sans text-[10px] font-semibold text-slate-600 transition hover:bg-white hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                          >
                            {checksumCopied ? (
                              <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                            ) : (
                              <Copy className="h-3 w-3" aria-hidden="true" />
                            )}
                            {checksumCopied ? "Copied" : "Copy"}
                          </button>
                        </div>
                        {checksumCopyError ? (
                          <p role="alert" className="mt-1 text-xs text-rose-700">{checksumCopyError}</p>
                        ) : null}
                      </div>
                    </div>
                    <span className="inline-flex w-fit shrink-0 items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-3 py-1 text-xs font-semibold tabular-nums text-emerald-700">
                      {Object.values(verification.recordCounts).reduce((total, count) => total + count, 0).toLocaleString()} total records
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 p-4 sm:grid-cols-4">
                    {Object.entries(verification.recordCounts).map(([table, count]) => (
                      <div
                        key={table}
                        className={`rounded-xl border border-slate-200/75 bg-slate-50/50 px-3 py-2.5 transition-colors hover:bg-slate-50 ${
                          count === 0 ? "opacity-55" : ""
                        }`}
                      >
                        <p className="truncate text-[11px] font-medium text-slate-500">{formatRecordCountLabel(table)}</p>
                        <p className="mt-0.5 text-base font-bold tracking-tight tabular-nums text-slate-900">{count.toLocaleString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

            </div>

            <footer className="sticky bottom-0 shrink-0 space-y-3 border-t border-slate-200 bg-white px-6 py-4">
              <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2.5">
                <div className="flex gap-2.5">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                  <p className="text-xs leading-5 text-amber-900">
                    Restore adds and updates matching records in batches. Records not present in the snapshot are not deleted, and existing System Admin roles are protected. Confirm you have selected the intended file.
                  </p>
                </div>
              </div>

              {selectedFile && verification ? (
                <label className="block">
                  <span className="mb-1.5 block text-sm font-semibold text-slate-800">
                    Type <span className="font-mono text-rose-700">RESTORE</span> to enable database restore
                  </span>
                  <input
                    value={confirmation}
                    onChange={(event) => setConfirmation(event.target.value)}
                    disabled={isRestoring}
                    autoComplete="off"
                    className="h-10 w-full rounded-xl border border-slate-300 px-3 text-sm font-medium outline-none focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20"
                  />
                </label>
              ) : null}

              {restoreError ? <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{restoreError}</p> : null}
              {restoreSuccess ? <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{restoreSuccess}</p> : null}

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={closeRestore}
                  disabled={isVerifying || isRestoring}
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRestore}
                  disabled={!verification || confirmation !== "RESTORE" || isRestoring}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-rose-700 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isRestoring ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
                  {isRestoring ? "Restoring snapshot..." : "Restore Database"}
                </button>
              </div>
            </footer>
          </section>
        </div>
      ) : null}
    </section>
  );
}
