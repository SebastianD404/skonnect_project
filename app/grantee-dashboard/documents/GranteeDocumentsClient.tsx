"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  Image as ImageIcon,
  Lock,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import {
  buildSemesterTracker,
  getCurrentAcademicSemester,
} from "@/lib/semester-progress";
import type { SubmissionStatus } from "@prisma/client";

type SubmissionItem = {
  id: string;
  semester: string;
  status: SubmissionStatus;
  ocrStatus: "OCR_PENDING" | "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED" | null;
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
};

const INITIAL_FORM: UploadState = {
  gradeFile: null,
  coeFile: null,
  gradeFileUrl: "",
  coeFileUrl: "",
  semester: getCurrentAcademicSemester(),
};

const BRAND = "#0F3D5C";
const BRAND_DARK = "#0A2A40";


function ocrStatusBadge(status: SubmissionItem["ocrStatus"]) {
  if (status === "OCR_PENDING") {
    return {
      label: "Processing Document...",
      className: "bg-slate-100 text-slate-600 ring-1 ring-slate-200 motion-safe:animate-pulse motion-reduce:animate-none",
    };
  }
  if (status === "OCR_DONE") {
    return {
      label: "Document Verified",
      className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    };
  }
  if (status === "OCR_NEEDS_REVIEW" || status === "OCR_FAILED") {
    return {
      label: "Pending SK Review",
      className: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    };
  }
  return null;
}

function getSubmissionDisplayStatus(submission: SubmissionItem) {
  const hasCoe = Boolean(submission.coeFileUrl);
  const hasGradeReport = Boolean(submission.gradeFileUrl);
  const isFullyApproved = submission.status === "APPROVED" && hasCoe && hasGradeReport;

  if (submission.status === "REJECTED" || submission.status === "RETURNED_FOR_EDIT") {
    return {
      label: "Needs editing",
      tone: {
        bar: "bg-rose-900/60",
        chip: "bg-rose-50 text-rose-900 ring-1 ring-rose-100",
        icon: <AlertCircle className="h-3.5 w-3.5" />,
      },
    };
  }

  if (isFullyApproved) {
    return {
      label: "Approved",
      tone: {
        bar: "bg-emerald-600/70",
        chip: "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100",
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      },
    };
  }

  if (hasCoe && !hasGradeReport) {
    return {
      label: "Pending review",
      tone: {
        bar: "bg-amber-500/70",
        chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
        icon: <Clock className="h-3.5 w-3.5" />,
      },
    };
  }

  return {
    label: "Pending review",
    tone: {
      bar: "bg-slate-400",
      chip: "bg-slate-100 text-slate-700 ring-1 ring-slate-200",
      icon: <Clock className="h-3.5 w-3.5" />,
    },
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

export default function GranteeDocumentsClient({ submissions, canSubmit }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<UploadState>(() => ({ ...INITIAL_FORM }));
  const [submitting, setSubmitting] = useState(false);
  const [uploadingGrade, setUploadingGrade] = useState(false);
  const [uploadingCoe, setUploadingCoe] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);


  const stats = useMemo(() => {
    const pending = submissions.filter((s) => s.status === "PENDING").length;
    const approved = submissions.filter((s) => s.status === "APPROVED").length;
    const needsEdit = submissions.filter((s) => s.status === "REJECTED" || s.status === "RETURNED_FOR_EDIT").length;
    return { pending, approved, needsEdit };
  }, [submissions]);

  const currentSubmission = useMemo(
    () => submissions.find((submission) => submission.semester === form.semester) ?? null,
    [form.semester, submissions]
  );

  const currentFlaggedFields = new Set(currentSubmission?.flaggedFields ?? []);

  const hasExistingGradeReport = Boolean(currentSubmission?.gradeFileUrl);
  const hasExistingCoe = Boolean(currentSubmission?.coeFileUrl);
  const isGradeReportFlagged = currentFlaggedFields.has("GRADE_REPORT");
  const isCoeFlagged = currentFlaggedFields.has("COE");
  const existingGradeReportName = currentSubmission?.gradeFileUrl
    ? getFilenameFromUrl(currentSubmission.gradeFileUrl)
    : "Grade_Report.pdf";
  const existingCoeName = currentSubmission?.coeFileUrl
    ? getFilenameFromUrl(currentSubmission.coeFileUrl)
    : "Certificate_of_Enrollment.pdf";

  const correctionText =
    currentSubmission?.reviewNotes?.trim() || "Please re-upload a clear and readable copy.";

  const hasReturnedSubmission = currentSubmission?.status === "RETURNED_FOR_EDIT";

  // When a submission for the selected semester is already approved and both files are present and not flagged,
  // treat the form as closed/read-only for that term.
  const isSubmissionClosed =
    currentSubmission?.status === "APPROVED" &&
    hasExistingGradeReport &&
    hasExistingCoe &&
    !isGradeReportFlagged &&
    !isCoeFlagged;

  // Semester filter for the "Fully Cleared" submissions view
  const [fullyClearedSemesterFilter, setFullyClearedSemesterFilter] = useState<string>("all");

  const fullyClearedRows = useMemo(() => {
    return submissions.filter(
      (s) => s.status === "APPROVED" && Boolean(s.gradeFileUrl) && Boolean(s.coeFileUrl)
    );
  }, [submissions]);

  const fullyClearedSemesterOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of fullyClearedRows) {
      if (s.semester) set.add(s.semester);
    }
    const arr = Array.from(set);
    arr.sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
    return ["all", ...arr];
  }, [fullyClearedRows]);

  // Reset filter when the underlying submissions change (e.g., on tab change or data reload)
  // Apply the semester filter only to fully-cleared rows; leave other status rows unaffected.
  const displayedSubmissions = useMemo(() => {
    if (fullyClearedSemesterFilter === "all") return submissions;
    return submissions.filter((s) => {
      const isFullyCleared = s.status === "APPROVED" && Boolean(s.gradeFileUrl) && Boolean(s.coeFileUrl);
      if (!isFullyCleared) return true;
      return s.semester === fullyClearedSemesterFilter;
    });
  }, [submissions, fullyClearedSemesterFilter]);

  const groupedSubmissions = useMemo(() => {
    const groups = new Map<string, SubmissionItem[]>();
    displayedSubmissions.forEach((item) => {
      const key = getAcademicYear(item.semester);
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)?.push(item);
    });

    return Array.from(groups.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [displayedSubmissions]);

  const tracker = useMemo(() => buildSemesterTracker(submissions, form.semester), [submissions, form.semester]);

  async function uploadFile(file: File, kind: "grade" | "coe") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);

    const response = await fetch("/api/grantee/submissions/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error || "Upload failed");
    }

    if (kind === "grade") {
      setForm((prev) => ({ ...prev, gradeFile: file, gradeFileUrl: result.path }));
    } else {
      setForm((prev) => ({ ...prev, coeFile: file, coeFileUrl: result.path }));
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

    if (!form.semester || /summer/i.test(form.semester)) {
      setMessage({ type: "error", text: "Please select a supported academic semester." });
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
        text: "Please upload both your grade report and Certificate of Enrollment before submitting.",
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
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to submit documents");
      }

      setForm((current) => ({
        ...current,
        gradeFile: null,
        coeFile: null,
        gradeFileUrl: "",
        coeFileUrl: "",
      }));
      router.refresh();
    } catch (error) {
      const text = error instanceof Error ? error.message : "Submission failed";
      setMessage({ type: "error", text });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto min-h-screen max-w-7xl space-y-6 bg-slate-50/40 p-4 sm:p-6 lg:p-8">
      <header
        className="relative overflow-hidden rounded-2xl bg-[#0a1f33] p-6 text-white shadow-sm sm:p-8"
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">My Requirements</h1>
          <p className="max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
            Upload your Certificate of Enrollment and Grade Report to keep your grantee status active. Grade reports
            are scanned automatically and routed for SK review.
          </p>
        </div>
      </header>

      <SemesterTracker term={tracker.current} approved={tracker.approved} total={tracker.total} pct={tracker.pct} />

      <div className="grid grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-12">
        <section className="border-b border-slate-200/80 p-5 sm:p-8 lg:col-span-8 lg:border-b-0 lg:border-r">
          <div className="mb-6 space-y-1 border-b border-slate-100 pb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Submit Requirements</h2>
            <p className="text-xs text-slate-500">
              Upload your verification documents for automated OCR analysis and SK review.
            </p>
          </div>
          <div className="space-y-0">
            {!canSubmit ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                Submissions are temporarily unavailable because your grantee profile is incomplete. Please update your school and year level in Profile settings. You can still view your requirement history.
              </div>
            ) : null}

            {message ? (
              <div
                role={message.type === "error" ? "alert" : "status"}
                className={`mb-4 rounded-xl border px-4 py-2.5 text-sm ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {message.text}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="mt-4 space-y-2">
                  <Field label="Active Academic Term">
                    <div
                      aria-label={`Active academic term: ${form.semester}. Locked for submission.`}
                      className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold text-slate-800 sm:flex-row sm:items-center"
                    >
                      <span>{form.semester} (Current Active Term)</span>
                      <span className="inline-flex w-fit items-center gap-1 rounded-full border border-emerald-100 bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700">
                        <Lock className="h-3 w-3" aria-hidden="true" />
                        Locked for Submission
                      </span>
                    </div>
                  </Field>
                  <p className="text-[11px] text-slate-400">
                    Requirements are evaluated against the active academic period.
                  </p>
                </div>

              <div className="grid gap-4 pt-1 md:grid-cols-2">
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
                        emptyTitle="Choose a file or drag it here"
                        emptySubtitle="Our OCR will read the report for SK/admin verification."
                        subtitle="PDF, JPG, PNG, WEBP - max 10MB"
                        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                        onChange={(file) => handleFileChange(file, "grade")}
                        onRemoveFile={() => setForm((prev) => ({ ...prev, gradeFile: null, gradeFileUrl: "" }))}
                        disabled={!canSubmit || submitting || uploadingGrade || isSubmissionClosed}
                      />
                  )}
                  {hasReturnedSubmission && isGradeReportFlagged && !form.gradeFile ? (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      {`⚠️ Correction required: ${correctionText}. Please re-upload a clear copy.`}
                    </div>
                  ) : null}
                </Field>

                <Field label="Certificate of Enrollment">
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
                      emptySubtitle="PDF, DOC, DOCX, JPG, PNG, or WEBP - max 10MB"
                      subtitle="PDF, DOC, DOCX, JPG, PNG, WEBP - max 10MB"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
                      onChange={(file) => handleFileChange(file, "coe")}
                      onRemoveFile={() => setForm((prev) => ({ ...prev, coeFile: null, coeFileUrl: "" }))}
                      disabled={!canSubmit || submitting || uploadingCoe || isSubmissionClosed}
                    />
                  )}
                  {hasReturnedSubmission && isCoeFlagged && !form.coeFile ? (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      {`⚠️ Correction required: ${correctionText}. Please re-upload a clear copy.`}
                    </div>
                  ) : null}
                </Field>
              </div>

              {isSubmissionClosed ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                  <span className="font-semibold">Submission Closed.</span> Your requirements for the {form.semester || "selected semester"} have been successfully verified and approved. Proceed to the next Semester. 
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
                  <span className="font-semibold text-slate-700">Automated document review:</span> Upload clear, readable files. Unclear scans will be routed to SK/admin for manual review.
                </div>
              )}

              <div className="sticky bottom-0 z-10 -mx-3 flex flex-col gap-3 border-t border-slate-100 bg-white/95 px-3 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Encrypted and securely stored
                </div>
                {isSubmissionClosed ? (
                  <button
                    type="button"
                    disabled
                    className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm bg-slate-400 disabled:cursor-not-allowed disabled:opacity-80"
                  >
                    Submission Closed
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={!canSubmit || submitting || uploadingGrade || uploadingCoe}
                    className="rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
                    style={{ backgroundColor: BRAND }}
                  >
                    {submitting ? "Submitting..." : hasReturnedSubmission ? "Update Requirements" : "Submit Requirements"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        <aside className="flex flex-col gap-8 bg-white p-5 sm:p-8 lg:col-span-4">
          <section className="space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Status Breakdown</h2>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white">
              <StatusRow label="Pending" value={stats.pending} tone="pending" />
              <StatusRow label="Approved" value={stats.approved} tone="approved" />
              <StatusRow label="Review" value={stats.needsEdit} tone="revision" />
            </div>
          </section>

          <section className="flex flex-1 flex-col gap-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Recent Submissions</h2>

          {fullyClearedRows.length > 0 && (
            <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
              <label htmlFor="fully-cleared-semester" className="sr-only">Filter fully cleared by semester</label>
              <select
                id="fully-cleared-semester"
                value={fullyClearedSemesterFilter}
                onChange={(e) => setFullyClearedSemesterFilter(e.target.value)}
                className="min-w-0 max-w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {fullyClearedSemesterOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt === "all" ? "All Semesters" : opt}
                  </option>
                ))}
              </select>

              <div className="text-xs text-slate-500">
                {fullyClearedRows.filter((r) => fullyClearedSemesterFilter === "all" || r.semester === fullyClearedSemesterFilter).length} fully cleared
              </div>
            </div>
          )}

          {submissions.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-8 text-center">
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold text-slate-800">No submissions recorded yet.</p>
              <p className="max-w-[200px] text-[11px] leading-relaxed text-slate-400">Upload your term files above to begin.</p>
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
        </aside>
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
    <div className="block">
      <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</span>
      {children}
    </div>
  );
}

function FileDrop({
  file,
  uploading,
  emptyTitle,
  emptySubtitle,
  subtitle,
  accept,
  onChange,
  onRemoveFile,
  disabled,
}: {
  file: File | null;
  uploading?: boolean;
  emptyTitle: string;
  emptySubtitle: string;
  subtitle: string;
  accept: string;
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
      className={`block rounded-2xl border-2 border-dashed p-6 text-center transition motion-safe:duration-150 focus-within:ring-4 focus-within:ring-[#0F3D5C]/10 ${
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
        accept={accept}
        aria-label={emptyTitle}
        className="sr-only"
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
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Current semester</p>
            <p className="text-sm font-bold text-slate-900">
              {term}
            </p>
          </div>
        </div>

        <div className="w-full space-y-1.5 md:w-80">
          <div className="flex justify-between text-xs font-medium text-slate-600">
            <span className="text-slate-400">Requirement Progress</span>
            <span className="font-bold text-slate-900">{approved} of {total} Approved</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500"
              style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})` }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function StatusRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "pending" | "approved" | "revision";
}) {
  const styles = {
    pending: { dot: "bg-amber-500", value: "text-amber-600" },
    approved: { dot: "bg-emerald-500", value: "text-emerald-600" },
    revision: { dot: "bg-rose-500", value: "text-rose-600" },
  }[tone];

  return (
    <div className="flex items-center justify-between p-3.5 text-xs">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className={`h-2 w-2 rounded-full ${styles.dot}`} />
        <span className="font-medium text-slate-700">{label}</span>
      </div>
      <span className={`font-bold ${styles.value}`}>{value}</span>
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
  const displayStatus = getSubmissionDisplayStatus(submission);
  const hasGradeReport = Boolean(submission.gradeFileUrl);
  const hasCoe = Boolean(submission.coeFileUrl);
  const ocrBadge = hasGradeReport ? ocrStatusBadge(submission.ocrStatus) : null;
  return (
    <article className="relative overflow-hidden rounded-2xl border border-slate-100 bg-white transition-shadow motion-safe:duration-150 hover:shadow-md">
      <span className={`absolute left-0 top-0 h-full w-1 ${displayStatus.tone.bar}`} />
      <div className="p-5 pl-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{submission.semester}</h3>
            <p className="mt-0.5 text-xs text-slate-500">Submitted {new Date(submission.submittedAt).toLocaleDateString()}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {hasGradeReport ? (
                <a
                  href={`/api/submissions/${submission.id}/file?kind=grade`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Grade report
                </a>
              ) : null}
              {hasCoe ? (
                <a
                  href={`/api/submissions/${submission.id}/file?kind=coe`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition hover:bg-slate-100"
                >
                  <FileText className="h-3.5 w-3.5" />
                  COE
                </a>
              ) : null}
            </div>
            {ocrBadge ? (
              <span
                className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ${ocrBadge.className}`}
                role="status"
              >
                {ocrBadge.label}
              </span>
            ) : null}
            {submission.reviewNotes ? (
              <p className="mt-2 text-xs leading-relaxed text-rose-700">Admin note: {submission.reviewNotes}</p>
            ) : null}
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium ${displayStatus.tone.chip}`}>
            {displayStatus.tone.icon}
            {displayStatus.label}
          </span>
        </div>
      </div>
    </article>
  );
}
