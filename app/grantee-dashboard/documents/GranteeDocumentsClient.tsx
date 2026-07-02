"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from "lucide-react";

type SubmissionItem = {
  id: string;
  semester: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "RETURNED_FOR_EDIT";
  generalAverage: number | null;
  reviewNotes: string | null;
  flaggedFields?: string[];
  submittedAt: string;
  reviewedAt: string | null;
  gradeFileUrl: string;
  coeFileUrl: string;
};

type Props = {
  submissions: SubmissionItem[];
  canSubmit: boolean;
};

type UploadState = {
  gradeFile: File | null;
  coeFile: File | null;
  gradeFileUrl: string;
  coeFileUrl: string;
  semester: string;
  generalAverage: string;
};

type PendingSnapshot = {
  semester: string;
  generalAverage: string;
};

const INITIAL_FORM: UploadState = {
  gradeFile: null,
  coeFile: null,
  gradeFileUrl: "",
  coeFileUrl: "",
  semester: "",
  generalAverage: "",
};

const BRAND = "#0F3D5C";
const BRAND_DARK = "#0A2A40";
const REQUIRED_DOCUMENTS_PER_SEMESTER = 2;

function statusLabel(status: SubmissionItem["status"]) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED" || status === "RETURNED_FOR_EDIT") return "Needs editing";
  return "Pending review";
}

function statusTone(status: SubmissionItem["status"]) {
  if (status === "APPROVED") {
    return {
      bar: "bg-emerald-600/70",
      chip: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    };
  }

  if (status === "REJECTED" || status === "RETURNED_FOR_EDIT") {
    return {
      bar: "bg-rose-900/60",
      chip: "bg-rose-50 text-rose-900 ring-1 ring-rose-100",
      icon: <AlertCircle className="h-3.5 w-3.5" />,
    };
  }

  return {
    bar: "bg-slate-400",
    chip: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
    icon: <Clock className="h-3.5 w-3.5" />,
  };
}

function getAcademicYear(semester: string) {
  const match = semester.match(/\b(20\d{2})\b/);
  if (!match) return "Other terms";
  const start = Number(match[1]);
  return `${start} - ${start + 1}`;
}

function getFilenameFromUrl(url: string) {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split("/").pop() || url;
    return decodeURIComponent(name.replace(/\+/g, " "));
  } catch {
    const parts = url.split("/");
    return decodeURIComponent(parts.pop() || url);
  }
}

function buildSemesterTracker(submissions: SubmissionItem[]) {
  const current = submissions[0]?.semester ?? "Current term";
  const inTerm = submissions.filter((s) => s.semester === current);
  const hasApprovedBundle = inTerm.some((s) => s.status === "APPROVED");
  const approved = hasApprovedBundle ? REQUIRED_DOCUMENTS_PER_SEMESTER : 0;
  const total = REQUIRED_DOCUMENTS_PER_SEMESTER;
  const pct = Math.round((approved / total) * 100);
  return { current, approved, total, pct };
}

export default function GranteeDocumentsClient({ submissions, canSubmit }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<UploadState>(INITIAL_FORM);
  const hydratedSubmissionIdRef = useRef<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingGrade, setUploadingGrade] = useState(false);
  const [uploadingCoe, setUploadingCoe] = useState(false);
  const [optimisticPending, setOptimisticPending] = useState<PendingSnapshot | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const stats = useMemo(() => {
    const pending = submissions.filter((s) => s.status === "PENDING").length;
    const approved = submissions.filter((s) => s.status === "APPROVED").length;
    const needsEdit = submissions.filter((s) => s.status === "REJECTED" || s.status === "RETURNED_FOR_EDIT").length;
    return { pending, approved, needsEdit };
  }, [submissions]);

  const activeReturnedSubmission = useMemo(() => {
    if (form.semester) {
      return (
        submissions.find(
          (submission) => submission.semester === form.semester && submission.status === "RETURNED_FOR_EDIT"
        ) ?? null
      );
    }

    return submissions.find((submission) => submission.status === "RETURNED_FOR_EDIT") ?? null;
  }, [form.semester, submissions]);

  const activeFlaggedFields = useMemo(
    () => new Set(activeReturnedSubmission?.flaggedFields ?? []),
    [activeReturnedSubmission]
  );

  const hasExistingGradeReport = Boolean(activeReturnedSubmission?.gradeFileUrl);
  const hasExistingCoe = Boolean(activeReturnedSubmission?.coeFileUrl);
  const isGradeReportFlagged = activeFlaggedFields.has("GRADE_REPORT");
  const isCoeFlagged = activeFlaggedFields.has("COE");
  const existingGradeReportName = activeReturnedSubmission?.gradeFileUrl
    ? getFilenameFromUrl(activeReturnedSubmission.gradeFileUrl)
    : "Grade_Report.pdf";
  const existingCoeName = activeReturnedSubmission?.coeFileUrl
    ? getFilenameFromUrl(activeReturnedSubmission.coeFileUrl)
    : "Certificate_of_Enrollment.pdf";

  const correctionText =
    activeReturnedSubmission?.reviewNotes?.trim() || "Please re-upload a clear and readable copy.";

  const hasReturnedSubmission = useMemo(
    () => submissions.some((submission) => submission.status === "RETURNED_FOR_EDIT"),
    [submissions]
  );

  const pendingSnapshot = useMemo(() => {
    if (optimisticPending) return optimisticPending;

    const latestPending = submissions.find((submission) => submission.status === "PENDING");
    if (!latestPending) return null;

    return {
      semester: latestPending.semester,
      generalAverage:
        latestPending.generalAverage !== null && latestPending.generalAverage !== undefined
          ? latestPending.generalAverage.toFixed(2)
          : "",
    };
  }, [optimisticPending, submissions]);

  const showPendingLockView = Boolean(canSubmit && pendingSnapshot && !hasReturnedSubmission);

  useEffect(() => {
    const fetchedSubmissionData =
      submissions.find((submission) => submission.status === "RETURNED_FOR_EDIT") ?? submissions[0] ?? null;

    if (!fetchedSubmissionData) {
      return;
    }

    // Hydrate once per returned/active record so polling refreshes do not wipe user input.
    if (hydratedSubmissionIdRef.current === fetchedSubmissionData.id) {
      return;
    }

    setForm((current) => {
      const hasUserInput =
        Boolean(current.semester) ||
        Boolean(current.generalAverage) ||
        Boolean(current.gradeFile) ||
        Boolean(current.coeFile) ||
        Boolean(current.gradeFileUrl) ||
        Boolean(current.coeFileUrl);

      if (hasUserInput) {
        return current;
      }

      hydratedSubmissionIdRef.current = fetchedSubmissionData.id;
      return {
        ...current,
        semester: fetchedSubmissionData.semester || "",
        generalAverage:
          fetchedSubmissionData.generalAverage !== null && fetchedSubmissionData.generalAverage !== undefined
            ? String(fetchedSubmissionData.generalAverage)
            : "",
      };
    });
  }, [submissions]);

  useEffect(() => {
    if (!optimisticPending) return;

    const isPersisted = submissions.some(
      (submission) => submission.semester === optimisticPending.semester && submission.status === "PENDING"
    );

    if (isPersisted) {
      setOptimisticPending(null);
    }
  }, [optimisticPending, submissions]);

  useEffect(() => {
    const syncDashboardData = () => {
      router.refresh();
    };

    const pollingInterval = setInterval(() => {
      if (document.visibilityState === "visible") {
        syncDashboardData();
      }
    }, 10000);

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        syncDashboardData();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      clearInterval(pollingInterval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [router]);

  const semesterOptions = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    return [`${year}-1st Semester`, `${year}-2nd Semester`, `${year + 1}-1st Semester`];
  }, []);

  const groupedSubmissions = useMemo(() => {
    const groups = new Map<string, SubmissionItem[]>();
    submissions.forEach((item) => {
      const key = getAcademicYear(item.semester);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(item);
    });

    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [submissions]);

  const tracker = useMemo(() => buildSemesterTracker(submissions), [submissions]);

  async function uploadFile(file: File, kind: "grade" | "coe") {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/grantee/submissions/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error || "Upload failed");
    }

    if (kind === "grade") {
      setForm((prev) => ({ ...prev, gradeFile: file, gradeFileUrl: result.url }));
    } else {
      setForm((prev) => ({ ...prev, coeFile: file, coeFileUrl: result.url }));
    }
  }

  async function handleFileChange(file: File | null, kind: "grade" | "coe") {
    if (!file) return;
    setMessage(null);

    // Optimistically mirror local file state so preview mounts immediately.
    if (kind === "grade") {
      setForm((prev) => ({ ...prev, gradeFile: file }));
    } else {
      setForm((prev) => ({ ...prev, coeFile: file }));
    }

    try {
      if (kind === "grade") setUploadingGrade(true);
      if (kind === "coe") setUploadingCoe(true);
      await uploadFile(file, kind);
    } catch (error) {
      const text = error instanceof Error ? error.message : "Upload failed";
      setMessage({ type: "error", text });
    } finally {
      if (kind === "grade") setUploadingGrade(false);
      if (kind === "coe") setUploadingCoe(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);

    if (!canSubmit) {
      setMessage({
        type: "error",
        text: "Complete your grantee profile (school and year level) in Profile settings to enable submissions.",
      });
      return;
    }

    if (!form.semester) {
      setMessage({ type: "error", text: "Please select a semester before submitting." });
      return;
    }

    const referenceSubmission = submissions.find((submission) => submission.semester === form.semester) ?? null;
    const referenceFlags = new Set(referenceSubmission?.flaggedFields ?? []);

    const finalGradeFileUrl =
      form.gradeFileUrl ||
      (referenceSubmission && !referenceFlags.has("GRADE_REPORT") ? referenceSubmission.gradeFileUrl : "");
    const finalCoeFileUrl =
      form.coeFileUrl ||
      (referenceSubmission && !referenceFlags.has("COE") ? referenceSubmission.coeFileUrl : "");

    if (!finalGradeFileUrl || !finalCoeFileUrl) {
      setMessage({
        type: "error",
        text:
          referenceSubmission?.status === "RETURNED_FOR_EDIT"
            ? "Please upload each document flagged for correction before submitting."
            : "Please complete semester, grade report, and COE before submitting.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/grantee/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester: form.semester,
          gradeFileUrl: finalGradeFileUrl,
          coeFileUrl: finalCoeFileUrl,
          generalAverage: form.generalAverage,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to submit documents");
      }

      setOptimisticPending({
        semester: form.semester,
        generalAverage: form.generalAverage,
      });
      setForm((current) => ({
        ...current,
        gradeFile: null,
        coeFile: null,
        gradeFileUrl: "",
        coeFileUrl: "",
      }));
      setMessage({ type: "success", text: "Documents submitted successfully. Status is now pending review." });
      router.refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Submission failed";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <header
        className="relative overflow-hidden rounded-3xl p-8 text-white sm:p-10"
        style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
      >
        <div
          className="absolute -right-24 -top-28 h-80 w-80 rounded-full opacity-20"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-20 -left-16 h-72 w-72 rounded-full opacity-10"
          style={{ background: "radial-gradient(circle, rgba(255,255,255,1) 0%, transparent 70%)" }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur-sm">
            <Sparkles className="h-3.5 w-3.5" />
            SKEAP Grantee
          </div>
          <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">My Requirements</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/80 sm:text-base">
            Upload your Certificate of Enrollment and Semester Grades to keep your grantee status active.
          </p>
        </div>
      </header>

      <SemesterTracker term={tracker.current} approved={tracker.approved} total={tracker.total} pct={tracker.pct} />

      <div className="grid gap-8 lg:grid-cols-5">
        <section className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm lg:col-span-3">
          <div
            className="px-8 py-6 text-white"
            style={{ background: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_DARK} 100%)` }}
          >
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/15">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Submit a Requirement</h2>
                <p className="text-xs text-white/75">Upload complete files for SK/admin verification</p>
              </div>
            </div>
          </div>

          <div className="space-y-6 p-8">
            {!canSubmit ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                Submissions are temporarily unavailable because your grantee profile is incomplete. Please update your school and year level in Profile settings. You can still view your requirement history.
              </div>
            ) : null}

            <div className="min-h-[3.5rem]">
              {message ? (
                <div
                  className={`rounded-xl border px-4 py-3 text-sm transition-all duration-300 ${
                    message.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-rose-200 bg-rose-50 text-rose-700"
                  }`}
                >
                  {message.text}
                </div>
              ) : null}
            </div>

            {showPendingLockView ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6 transition-all duration-300">
                <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-4 text-center">
                  <div className="grid h-16 w-16 place-items-center rounded-2xl border border-slate-200 bg-white text-indigo-600 shadow-sm">
                    <Clock className="h-8 w-8" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-slate-900">Verification in Progress</h3>
                    <p className="text-xs leading-relaxed text-slate-500">
                      Your submission is locked and currently being evaluated by the review team.
                    </p>
                  </div>
                  <div className="grid w-full grid-cols-2 gap-2 pt-2">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-left">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">Term</span>
                      <span className="text-xs font-semibold text-slate-800">{pendingSnapshot?.semester || "Not selected"}</span>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-left">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-400">GWA Passed</span>
                      <span className="text-xs font-semibold text-slate-800">{pendingSnapshot?.generalAverage || "Not provided"}</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Academic Term">
                  <select
                    value={form.semester}
                    onChange={(e) => setForm((prev) => ({ ...prev, semester: e.target.value }))}
                    disabled={!canSubmit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-4 focus:ring-[#0F3D5C]/10 disabled:cursor-not-allowed disabled:opacity-60"
                    required
                  >
                    <option value="">Select semester</option>
                    {semesterOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </Field>

                <Field label="General Average">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.01"
                    value={form.generalAverage}
                    onChange={(e) => setForm((prev) => ({ ...prev, generalAverage: e.target.value }))}
                    placeholder="e.g. 89.50"
                    disabled={!canSubmit}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm outline-none transition focus:border-[#0F3D5C] focus:ring-4 focus:ring-[#0F3D5C]/10 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                </Field>
              </div>

              <div className="grid gap-5 sm:grid-cols-2">
                <Field label="Upload Grade Report">
                  {hasExistingGradeReport && !isGradeReportFlagged && !form.gradeFile ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-slate-50/80 p-5 shadow-xs">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">{existingGradeReportName}</span>
                          <span className="text-[11px] font-medium text-emerald-600">Previously uploaded and retained</span>
                        </div>
                      </div>
                      <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Valid
                      </span>
                    </div>
                  ) : (
                    <FileDrop
                      file={form.gradeFile}
                      uploading={uploadingGrade}
                      emptyTitle="Click to upload"
                      emptySubtitle="PDF, JPG, PNG, WEBP - max 10MB"
                      subtitle="PDF, JPG, PNG, WEBP - max 10MB"
                      onChange={(file) => handleFileChange(file, "grade")}
                      onRemoveFile={() => setForm((prev) => ({ ...prev, gradeFile: null, gradeFileUrl: "" }))}
                      disabled={!canSubmit || submitting || uploadingGrade}
                    />
                  )}
                  {activeReturnedSubmission && activeFlaggedFields.has("GRADE_REPORT") && !form.gradeFile ? (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      {`⚠️ Correction required: ${correctionText}. Please re-upload a clear copy.`}
                    </div>
                  ) : null}
                </Field>

                <Field label="Upload Certificate of Enrollment">
                  {hasExistingCoe && !isCoeFlagged && !form.coeFile ? (
                    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200/60 bg-slate-50/80 p-5 shadow-xs">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-emerald-600">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <span className="block truncate text-sm font-medium text-slate-800">{existingCoeName}</span>
                          <span className="text-[11px] font-medium text-emerald-600">Previously uploaded and retained</span>
                        </div>
                      </div>
                      <span className="rounded-md border border-emerald-100 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        Valid
                      </span>
                    </div>
                  ) : (
                    <FileDrop
                      file={form.coeFile}
                      uploading={uploadingCoe}
                      emptyTitle="Click to upload"
                      emptySubtitle="PDF, JPG, PNG, WEBP - max 10MB"
                      subtitle="PDF, JPG, PNG, WEBP - max 10MB"
                      onChange={(file) => handleFileChange(file, "coe")}
                      onRemoveFile={() => setForm((prev) => ({ ...prev, coeFile: null, coeFileUrl: "" }))}
                      disabled={!canSubmit || submitting || uploadingCoe}
                    />
                  )}
                  {activeReturnedSubmission && activeFlaggedFields.has("COE") && !form.coeFile ? (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      {`⚠️ Correction required: ${correctionText}. Please re-upload a clear copy.`}
                    </div>
                  ) : null}
                </Field>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                <span className="font-semibold text-slate-700">Heads up:</span> Please upload readable files. SK/admin will review the latest semester submission for approval.
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Encrypted and securely stored
                </div>
                <button
                  type="submit"
                  disabled={!canSubmit || submitting || uploadingGrade || uploadingCoe}
                  className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                  style={{ backgroundColor: BRAND }}
                >
                  {submitting ? "Submitting..." : "Submit for Review"}
                </button>
              </div>
              </form>
            )}
          </div>
        </section>

        <section className="space-y-5 lg:col-span-2">
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <MetricCard label="Pending" value={stats.pending.toString()} tone="pending" />
            <MetricCard label="Approved" value={stats.approved.toString()} tone="approved" />
            <MetricCard label="Needs editing" value={stats.needsEdit.toString()} tone="revision" />
          </div>

          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-slate-900">My Submissions</h2>
          </div>

          {submissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-sm">
              No submissions yet. Start by uploading your first semester requirement.
            </div>
          ) : (
            groupedSubmissions.map(([year, items]) => (
              <YearGroup key={year} year={year}>
                {items.map((submission) => (
                  <HistoryItem key={submission.id} submission={submission} />
                ))}
              </YearGroup>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</span>
      {children}
    </label>
  );
}

function FileDrop({
  file,
  uploading,
  emptyTitle,
  emptySubtitle,
  subtitle,
  onChange,
  onRemoveFile,
  disabled,
}: {
  file: File | null;
  uploading?: boolean;
  emptyTitle: string;
  emptySubtitle: string;
  subtitle: string;
  onChange: (file: File | null) => void;
  onRemoveFile: () => void;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function formatFileSize(bytes: number) {
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function isDocumentFile(name: string) {
    return /\.(pdf|doc|docx)$/i.test(name);
  }

  function handleDragOver(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(false);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    if (disabled) return;

    setIsDragging(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    onChange(file);
  }

  if (file) {
    const fileIsDocument = isDocumentFile(file.name);
    const fileSize = formatFileSize(file.size);

    return (
      <div className="relative flex items-center justify-between gap-3 rounded-xl border border-slate-200/80 bg-slate-50/60 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[#0B192C] flex">
            {fileIsDocument ? (
              <FileText className="h-5 w-5 text-slate-600" />
            ) : (
              <ImageIcon className="h-5 w-5 text-slate-600" />
            )}
          </div>
          <div className="min-w-0 flex flex-col">
            <span className="max-w-[200px] truncate pr-2 text-sm font-medium text-slate-900">{file.name}</span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {uploading ? "Uploading..." : `Ready for submission${fileSize ? ` • ${fileSize}` : ""}`}
            </span>
          </div>
        </div>

        <div className="flex flex-shrink-0 items-center gap-2">
          {uploading ? (
            <span className="inline-flex h-6 items-center rounded-full border border-sky-200 bg-sky-50 px-2.5 text-[10px] font-semibold text-sky-700">
              Uploading...
            </span>
          ) : null}
          <button
            type="button"
            onClick={onRemoveFile}
            disabled={disabled}
            className="rounded-lg border border-transparent p-1.5 text-slate-400 transition-all duration-150 hover:border-red-100 hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
            title="Remove file"
            aria-label="Remove file"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`block rounded-2xl border-2 border-dashed p-6 text-center transition ${
        disabled
          ? "cursor-not-allowed border-slate-200 bg-slate-100/80"
          : isDragging
          ? "cursor-pointer border-[#0F3D5C] bg-[#0F3D5C]/8 ring-4 ring-[#0F3D5C]/10"
          : "cursor-pointer border-slate-200 bg-slate-50/50 hover:border-[#0F3D5C] hover:bg-[#0F3D5C]/5"
      }`}
    >
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-[#0F3D5C]/10">
        <Upload className="h-5 w-5 text-[#0F3D5C]" />
      </div>
      <p className="text-sm font-medium text-slate-700">{isDragging ? "Drop file to upload" : emptyTitle}</p>
      <p className="mt-1 text-xs text-slate-500">{emptySubtitle || subtitle}</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.doc,.docx"
        className="hidden"
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.currentTarget.value = "";
        }}
      />
    </label>
  );
}

function SemesterTracker({
  term,
  approved,
  total,
  pct,
}: {
  term: string;
  approved: number;
  total: number;
  pct: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white px-6 py-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: `${BRAND}14`, color: BRAND }}>
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Current Semester</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-900">
              {term} - {approved} of {total} Approved
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 sm:w-[55%]">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})` }}
            />
          </div>
          <span className="w-10 text-right text-sm font-semibold tabular-nums text-slate-700">{pct}%</span>
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "pending" | "approved" | "revision";
}) {
  const styles =
    tone === "approved"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : tone === "revision"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <div className={`rounded-2xl border p-4 ${styles}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  );
}

function YearGroup({ year, children }: { year: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">{year}</span>
        <span className="h-px flex-1 bg-slate-200" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function HistoryItem({ submission }: { submission: SubmissionItem }) {
  const tone = statusTone(submission.status);
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm transition hover:shadow-md">
      <span className={`absolute left-0 top-0 h-full w-1 ${tone.bar}`} />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{submission.semester}</h3>
            <p className="mt-0.5 text-xs text-slate-500">Submitted {new Date(submission.submittedAt).toLocaleDateString()}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <a
                href={submission.gradeFileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <FileText className="h-3.5 w-3.5" />
                Grade report
              </a>
              <a
                href={submission.coeFileUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
              >
                <FileText className="h-3.5 w-3.5" />
                COE
              </a>
            </div>
            {submission.reviewNotes ? (
              <p className="mt-2 text-xs leading-relaxed text-rose-700">Admin note: {submission.reviewNotes}</p>
            ) : null}
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${tone.chip}`}>
            {tone.icon}
            {statusLabel(submission.status)}
          </span>
        </div>
      </div>
    </article>
  );
}
