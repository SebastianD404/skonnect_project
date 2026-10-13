"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Loader2,
  ShieldCheck,
  Upload,
  X,
} from "lucide-react";
import { createWorker } from "tesseract.js";
import {
  COE_MIME_TYPES,
  GRADE_REPORT_MIME_TYPES,
  MAX_GRADE_REPORT_BYTES,
} from "@/lib/ocr/grade-report-file";
import {
  validateCertificateOfEnrollment,
  validateGradeReport,
} from "@/lib/ocr/document-validation";
import { extractDocxTextFromBuffer } from "@/lib/skeap-document-keywords";
import {
  buildSemesterTracker,
  getCurrentAcademicSemester,
  getDocumentSemesterOptions,
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

type OcrStatus = "IDLE" | "SCANNING" | "SUCCESS" | "WARNING";

const INITIAL_FORM: UploadState = {
  gradeFile: null,
  coeFile: null,
  gradeFileUrl: "",
  coeFileUrl: "",
  semester: getCurrentAcademicSemester(),
};

const BRAND = "#0F3D5C";
const BRAND_DARK = "#0A2A40";

function validateFileName(file: File, type: "COE" | "GRADES"): { isValid: boolean; error?: string } {
  const fileName = file.name.toLowerCase();
  const invalidKeywords = [
    "income",
    "icnome",
    "tax",
    "clearance",
    "barangay",
    "voter",
    "id",
    "profile",
    "birth",
    "medical",
  ];
  const containsInvalidKeyword = invalidKeywords.some((keyword) =>
    keyword === "id"
      ? fileName.split(/[^a-z0-9]+/).includes(keyword)
      : fileName.includes(keyword)
  );

  if (containsInvalidKeyword) {
    return {
      isValid: false,
      error: "This file doesn't match the required document type. Please upload the correct document.",
    };
  }

  if (
    type === "GRADES" &&
    ["coe", "certificate", "enrollment", "cor"].some((keyword) => fileName.includes(keyword))
  ) {
    return {
      isValid: false,
      error: "This looks like your Certificate of Enrollment. Please upload your Grade Report here.",
    };
  }

  if (
    type === "COE" &&
    ["grade", "report", "card", "transcript", "tor"].some((keyword) => fileName.includes(keyword))
  ) {
    return {
      isValid: false,
      error: "This looks like your Grade Report. Please upload your Certificate of Enrollment here.",
    };
  }

  return { isValid: true };
}

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

async function extractSelectedFileText(file: File): Promise<string> {
  if (file.type === "application/msword" || /\.doc$/i.test(file.name)) {
    throw new Error("We couldn't check this document automatically. You can submit it for Admin Review.");
  }

  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    try {
      const pdfjs = await import("pdfjs-dist");
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url
      ).toString();

      const loadingTask = pdfjs.getDocument({ data: await file.arrayBuffer() });
      let pdf: Awaited<typeof loadingTask.promise> | null = null;
      try {
        pdf = await loadingTask.promise;
        const pageTexts: string[] = [];
        const maxPages = Math.min(pdf.numPages, 3);
        for (let pageNumber = 1; pageNumber <= maxPages; pageNumber += 1) {
          const page = await pdf.getPage(pageNumber);
          try {
            const textContent = await page.getTextContent();
            pageTexts.push(
              textContent.items
                .map((item) => ("str" in item ? item.str : ""))
                .join(" ")
            );
          } finally {
            page.cleanup();
          }
        }
        return pageTexts.join(" ").toLowerCase();
      } finally {
        if (pdf) await pdf.destroy();
        else await loadingTask.destroy();
      }
    } catch (error) {
      console.error("PDF text extraction failed for selected document.", error);
      throw new Error(
        "We couldn't read this PDF. If it is scanned or unreadable, you can submit it for Admin Review."
      );
    }
  }

  if (
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    /\.docx$/i.test(file.name)
  ) {
    return extractDocxTextFromBuffer(await file.arrayBuffer());
  }

  const worker = await createWorker("eng");
  try {
    const result = await worker.recognize(file);
    return result.data.text;
  } finally {
    await worker.terminate();
  }
}

export default function GranteeDocumentsClient({ submissions, canSubmit }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<UploadState>(() => ({ ...INITIAL_FORM }));
  const [gradeOcrStatus, setGradeOcrStatus] = useState<OcrStatus>("IDLE");
  const [coeOcrStatus, setCoeOcrStatus] = useState<OcrStatus>("IDLE");
  const [gradeOcrWarning, setGradeOcrWarning] = useState<string | null>(null);
  const [coeOcrWarning, setCoeOcrWarning] = useState<string | null>(null);
  const [gradeOcrOverride, setGradeOcrOverride] = useState(false);
  const [coeOcrOverride, setCoeOcrOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingGrade, setUploadingGrade] = useState(false);
  const [uploadingCoe, setUploadingCoe] = useState(false);
  const [gradeFileError, setGradeFileError] = useState<string | null>(null);
  const [coeFileError, setCoeFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const ocrRunIds = useRef({ grade: 0, coe: 0 });

  const semesterOptions = useMemo(
    () => getDocumentSemesterOptions(submissions.map((submission) => submission.semester)),
    [submissions]
  );

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

  async function runInstantOCR(file: File, kind: "grade" | "coe") {
    const runId = ++ocrRunIds.current[kind];
    const setStatus = kind === "grade" ? setGradeOcrStatus : setCoeOcrStatus;
    const setWarning = kind === "grade" ? setGradeOcrWarning : setCoeOcrWarning;
    setStatus("SCANNING");
    setWarning(null);
    if (kind === "grade") setGradeOcrOverride(false);
    else setCoeOcrOverride(false);

    try {
      const text = await extractSelectedFileText(file);
      if (ocrRunIds.current[kind] !== runId) return;

      const matches = kind === "grade"
        ? validateGradeReport(text)
        : validateCertificateOfEnrollment(text);
      if (matches === true) {
        setStatus("SUCCESS");
      } else {
        setStatus("WARNING");
        setWarning(
          kind === "grade"
            ? "This document doesn't look like a Grade Report. Please verify your file."
            : "This document doesn't look like a Certificate of Enrollment. Please verify your file."
        );
      }
    } catch (error) {
      if (ocrRunIds.current[kind] !== runId) return;
      setStatus("WARNING");
      setWarning(
        error instanceof Error
          ? error.message
          : "We couldn't check this document automatically. You can submit it for Admin Review."
      );
    }
  }

  async function handleFileChange(file: File | null, kind: "grade" | "coe") {
    if (!file) return;
    setMessage(null);

    const setFileError = kind === "grade" ? setGradeFileError : setCoeFileError;
    const filenameValidation = validateFileName(file, kind === "grade" ? "GRADES" : "COE");
    if (!filenameValidation.isValid) {
      setFileError(filenameValidation.error ?? "Invalid file name.");
      return;
    }
    setFileError(null);

    const allowedTypes = kind === "grade" ? GRADE_REPORT_MIME_TYPES : COE_MIME_TYPES;
    if (!allowedTypes.has(file.type.toLowerCase())) {
      setMessage({
        type: "error",
        text: kind === "grade"
          ? "Grade reports must be PDF, JPG, PNG, or WEBP files."
          : "Only PDF, DOC/DOCX, PNG, JPG, and WEBP files are allowed.",
      });
      return;
    }
    if (file.size === 0 || file.size > MAX_GRADE_REPORT_BYTES) {
      setMessage({ type: "error", text: "File size must be greater than 0 and no more than 10MB." });
      return;
    }

    // Optimistically mirror local file state so preview mounts immediately.
    if (kind === "grade") {
      setForm((prev) => ({ ...prev, gradeFile: file }));
    } else {
      setForm((prev) => ({ ...prev, coeFile: file }));
    }
    void runInstantOCR(file, kind);

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

  async function handleSubmit(event?: React.FormEvent, forceOverride = false) {
    event?.preventDefault();
    setMessage(null);
    setSubmitError(null);
    setOcrWarning(null);

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

    if (gradeOcrStatus === "SCANNING" || coeOcrStatus === "SCANNING") {
      setMessage({ type: "error", text: "Please wait for both document scans to finish before submitting." });
      return;
    }

    if (
      (gradeOcrStatus === "WARNING" && !gradeOcrOverride) ||
      (coeOcrStatus === "WARNING" && !coeOcrOverride)
    ) {
      setMessage({ type: "error", text: "Choose Submit for Admin Review for any document that needs a manual check." });
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
          forceSubmit: forceOverride || gradeOcrOverride || coeOcrOverride,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.requiresOverride) {
          setOcrWarning(result.error || "We couldn't check the document contents automatically.");
          return;
        }
        throw new Error(result?.error || "Failed to submit documents");
      }

      setOcrWarning(null);
      setGradeOcrStatus("IDLE");
      setCoeOcrStatus("IDLE");
      setGradeOcrWarning(null);
      setCoeOcrWarning(null);
      setGradeOcrOverride(false);
      setCoeOcrOverride(false);
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
      setSubmitError(text);
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
            are checked automatically and routed for SK review.
          </p>
        </div>
      </header>

      <SemesterTracker term={tracker.current} approved={tracker.approved} total={tracker.total} pct={tracker.pct} />

      <div className="grid grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-12">
        <section className="border-b border-slate-200/80 p-5 sm:p-8 lg:col-span-8 lg:border-b-0 lg:border-r">
          <div className="mb-6 space-y-1 border-b border-slate-100 pb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Submit Requirements</h2>
            <p className="text-xs text-slate-500">
              Upload your verification documents for automatic checks and SK review.
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

            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-0">
              <div className="space-y-1.5">
                <label htmlFor="submission-semester" className="block text-xs font-medium text-slate-700">
                  Academic term
                </label>
                <select
                  id="submission-semester"
                  value={form.semester}
                  onChange={(event) => setForm((current) => ({ ...current, semester: event.target.value }))}
                  disabled={submitting}
                  className="w-full appearance-none rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm font-medium text-slate-900 focus:border-[#0a1f33] focus:outline-none focus:ring-2 focus:ring-[#0a1f33]/10 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {semesterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  Choose the academic term for both documents. The current term is preselected.
                </p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <Field label="Upload Grade Report" icon={<FileText className="h-4 w-4 text-slate-500" />}>
                  <FileDrop
                    file={form.gradeFile}
                    existingFileName={hasExistingGradeReport && !isGradeReportFlagged && !form.gradeFile ? existingGradeReportName : undefined}
                    existingFileUrl={
                      hasExistingGradeReport && !isGradeReportFlagged && !form.gradeFile && currentSubmission
                        ? `/api/submissions/${currentSubmission.id}/file?kind=grade`
                        : undefined
                    }
                    uploading={uploadingGrade}
                    ocrStatus={gradeOcrStatus}
                    ocrWarning={gradeOcrWarning}
                    ocrOverridden={gradeOcrOverride}
                    onOcrOverride={() => setGradeOcrOverride(true)}
                    emptyTitle="Choose a file or drag it here"
                    emptySubtitle="We'll check the document for SK review."
                    subtitle="PDF, JPG, PNG, WEBP - max 10MB"
                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(file) => handleFileChange(file, "grade")}
                    errorText={gradeFileError}
                    onRemoveFile={() => {
                      ocrRunIds.current.grade += 1;
                      setGradeOcrStatus("IDLE");
                      setGradeOcrWarning(null);
                      setGradeOcrOverride(false);
                      setGradeFileError(null);
                      setForm((prev) => ({ ...prev, gradeFile: null, gradeFileUrl: "" }));
                    }}
                    disabled={!canSubmit || submitting || uploadingGrade || isSubmissionClosed}
                  />
                  {hasReturnedSubmission && isGradeReportFlagged && !form.gradeFile ? (
                    <div className="mt-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-700">
                      {`⚠️ Correction required: ${correctionText}. Please re-upload a clear copy.`}
                    </div>
                  ) : null}
                </Field>

                <Field label="Certificate of Enrollment" icon={<GraduationCap className="h-4 w-4 text-slate-500" />}>
                  <FileDrop
                    file={form.coeFile}
                    existingFileName={hasExistingCoe && !isCoeFlagged && !form.coeFile ? existingCoeName : undefined}
                    existingFileUrl={
                      hasExistingCoe && !isCoeFlagged && !form.coeFile && currentSubmission
                        ? `/api/submissions/${currentSubmission.id}/file?kind=coe`
                        : undefined
                    }
                    uploading={uploadingCoe}
                    ocrStatus={coeOcrStatus}
                    ocrWarning={coeOcrWarning}
                    ocrOverridden={coeOcrOverride}
                    onOcrOverride={() => setCoeOcrOverride(true)}
                    emptyTitle="Click to upload"
                    emptySubtitle="We'll check the document for SK review."
                    subtitle="PDF, DOC, DOCX, JPG, PNG, WEBP - max 10MB"
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/jpeg,image/png,image/webp"
                    onChange={(file) => handleFileChange(file, "coe")}
                    errorText={coeFileError}
                    onRemoveFile={() => {
                      ocrRunIds.current.coe += 1;
                      setCoeOcrStatus("IDLE");
                      setCoeOcrWarning(null);
                      setCoeOcrOverride(false);
                      setCoeFileError(null);
                      setForm((prev) => ({ ...prev, coeFile: null, coeFileUrl: "" }));
                    }}
                    disabled={!canSubmit || submitting || uploadingCoe || isSubmissionClosed}
                  />
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
                <div className="mt-5 border-l-2 border-cyan-600 py-0.5 pl-3 text-xs leading-relaxed text-slate-600">
                  <span className="font-bold text-slate-800">Automated document review:</span> Upload clear, readable files. Unclear scans will be routed to SK/admin for manual review.
                </div>
              )}

              {submitError ? (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700" role="alert">
                  <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <p>{submitError}</p>
                </div>
              ) : null}

              {ocrWarning ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-2xs" role="alert">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" aria-hidden="true" />
                    <div className="w-full space-y-3">
                      <p className="text-xs font-semibold leading-relaxed text-amber-800">{ocrWarning}</p>
                      <div className="flex items-center gap-3 border-t border-amber-200/60 pt-2">
                        <button
                          type="button"
                          onClick={() => setOcrWarning(null)}
                          className="text-[11px] font-bold text-amber-700 transition-colors hover:text-amber-900"
                        >
                          Check my files
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSubmit(undefined, true)}
                          disabled={submitting}
                          className="rounded-lg bg-amber-600 px-3 py-1.5 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-amber-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Submit for Admin Review
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
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
                    className="flex w-fit items-center gap-1.5 rounded-lg bg-[#0a1f33] px-4 py-2 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-[#122e48] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? "Submitting..." : hasReturnedSubmission ? "Update Requirements" : "Submit Requirements"}
                    {!submitting ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : null}
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
  icon,
  children,
}: {
  label: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-center gap-2 text-slate-800">
        {icon}
        <h3 className="text-sm font-semibold">{label}</h3>
      </div>
      {children}
    </div>
  );
}

function FileDrop({
  file,
  existingFileName,
  existingFileUrl,
  uploading,
  ocrStatus = "IDLE",
  ocrWarning,
  ocrOverridden = false,
  onOcrOverride,
  emptyTitle,
  emptySubtitle,
  subtitle,
  accept,
  onChange,
  onRemoveFile,
  errorText,
  disabled,
}: {
  file: File | null;
  existingFileName?: string;
  existingFileUrl?: string;
  uploading?: boolean;
  ocrStatus?: OcrStatus;
  ocrWarning?: string | null;
  ocrOverridden?: boolean;
  onOcrOverride?: () => void;
  emptyTitle: string;
  emptySubtitle: string;
  subtitle: string;
  accept: string;
  onChange: (file: File | null) => void;
  onRemoveFile: () => void;
  errorText?: string | null;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);
  const [docxPreview, setDocxPreview] = useState<{
    fileName: string;
    text?: string;
    error?: string;
  } | null>(null);
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

  async function handleViewFile(selectedFile: File | null) {
    if (!selectedFile) return;

    const extension = selectedFile.name.split(".").pop()?.toLowerCase();
    if (
      extension === "docx" ||
      selectedFile.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      try {
        const text = extractDocxTextFromBuffer(await selectedFile.arrayBuffer());
        if (!text) throw new Error("This document has no readable text to preview.");
        setDocxPreview({ fileName: selectedFile.name, text });
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "This document couldn't be previewed.";
        console.error("Could not preview the selected DOCX file.", error);
        setDocxPreview({ fileName: selectedFile.name, error: message });
      }
      return;
    }

    const fallbackTypes: Record<string, string> = {
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      pdf: "application/pdf",
      png: "image/png",
      webp: "image/webp",
    };
    const blob = new Blob([selectedFile], {
      type: selectedFile.type || fallbackTypes[extension ?? ""] || "application/octet-stream",
    });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank", "noopener,noreferrer");
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }

  function handleDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(true);
  }

  function handleDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;
    setIsDragging(false);
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    if (disabled) return;

    setIsDragging(false);
    const file = event.dataTransfer.files?.[0] ?? null;
    onChange(file);
  }

  const fileCardTone = errorText
    ? "border-amber-200 bg-amber-50/20"
    : !file
    ? "border-emerald-200 bg-emerald-50/30"
    : ocrStatus === "SUCCESS"
      ? "border-emerald-200 bg-emerald-50/30"
      : ocrStatus === "WARNING"
        ? "border-amber-200 bg-amber-50/30"
        : ocrStatus === "SCANNING"
          ? "border-sky-200 bg-sky-50/30"
          : "border-slate-200 bg-white";
  const fileIconTone = errorText
    ? "border-amber-100 text-amber-600"
    : !file
    ? "border-emerald-100 text-emerald-600"
    : ocrStatus === "SUCCESS"
      ? "border-emerald-100 text-emerald-600"
      : ocrStatus === "WARNING"
        ? "border-amber-100 text-amber-600"
        : ocrStatus === "SCANNING"
          ? "border-sky-100 text-sky-600"
          : "border-slate-200 text-slate-600";
  const fileStatusTone = errorText
    ? "text-amber-700"
    : !file
    ? "text-emerald-600"
    : ocrStatus === "SUCCESS"
      ? "text-emerald-600"
      : ocrStatus === "WARNING"
        ? "text-amber-600"
        : ocrStatus === "SCANNING"
          ? "text-sky-600"
          : "text-slate-500";
  const fileFooterTone = errorText
    ? "border-amber-200/50"
    : !file
    ? "border-emerald-200/50"
    : ocrStatus === "SUCCESS"
      ? "border-emerald-200/50"
      : ocrStatus === "WARNING"
        ? "border-amber-200/50"
        : ocrStatus === "SCANNING"
          ? "border-sky-200/50"
          : "border-slate-200/50";

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex min-h-[175px] w-full flex-1 flex-col"
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="sr-only"
        disabled={disabled}
        onChange={(e) => {
          onChange(e.target.files?.[0] ?? null);
          e.currentTarget.value = "";
        }}
      />
      {file || existingFileName ? (
        <div className={`flex h-full min-h-[175px] w-full flex-1 flex-col justify-between rounded-2xl border p-4 transition-colors ${fileCardTone}`}>
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3 overflow-hidden">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-white shadow-2xs ${fileIconTone}`}>
                {errorText ? (
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                ) : file && ocrStatus === "SCANNING" ? (
                  <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                ) : file && ocrStatus === "SUCCESS" ? (
                  <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
                ) : file && ocrStatus === "WARNING" ? (
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                ) : isDocumentFile(file?.name ?? existingFileName ?? "") ? (
                  <FileText className="h-5 w-5" />
                ) : (
                  <ImageIcon className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="truncate pr-2 text-xs font-bold text-slate-900">
                  {file?.name ?? existingFileName}
                </p>
                <p
                  className={`mt-0.5 flex items-center gap-1 text-[11px] font-medium ${fileStatusTone}`}
                  role={errorText || (file && ocrStatus === "WARNING") ? "alert" : file && ocrStatus === "SCANNING" ? "status" : undefined}
                  aria-live={file && ocrStatus === "SCANNING" ? "polite" : undefined}
                >
                  {errorText ? (
                    errorText
                  ) : file && ocrStatus === "SCANNING" ? (
                    "Scanning document..."
                  ) : file && ocrStatus === "SUCCESS" ? (
                    "Document type detected • pending final review"
                  ) : file && ocrStatus === "WARNING" ? (
                    ocrOverridden
                      ? "Admin review selected"
                      : ocrWarning || "We couldn't check this document automatically."
                  ) : file ? (
                    uploading ? "Uploading..." : "File selected • Check pending"
                  ) : (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                      Previously uploaded and retained
                    </>
                  )}
                  {file && !errorText && ocrStatus !== "WARNING" && formatFileSize(file.size)
                    ? ` • ${formatFileSize(file.size)}`
                    : ""}
                </p>
                {file && ocrStatus === "WARNING" ? (
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] text-slate-500">
                      {(file.size / (1024 * 1024)).toFixed(1)} MB
                    </span>
                    <span className="text-[10px] text-slate-300" aria-hidden="true">•</span>
                    <button
                      type="button"
                      onClick={() => handleViewFile(file)}
                      className="inline-flex cursor-pointer items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      View File
                      <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
            {file ? (
              <button
                type="button"
                onClick={onRemoveFile}
                disabled={disabled}
                className="shrink-0 p-1 text-slate-400 transition-colors hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                title="Remove file"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {errorText || (file && ocrStatus === "WARNING") ? (
            <div className="mt-4 flex flex-col gap-2.5 border-t border-amber-200/60 pt-3">
              {file && ocrStatus === "WARNING" && !errorText ? (
                <p className="text-[11px] leading-relaxed text-slate-600">
                  If this is the correct document, you can proceed for review.
                </p>
              ) : null}
              {file && ocrStatus === "WARNING" && !errorText ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Change File
                  </button>
                  <button
                    type="button"
                    onClick={onOcrOverride}
                    disabled={ocrOverridden}
                    className="rounded-lg bg-amber-600 py-1.5 text-[11px] font-bold text-white shadow-xs transition-all hover:bg-amber-700 disabled:cursor-default disabled:opacity-70"
                  >
                    {ocrOverridden ? "Review Selected" : "Proceed Anyway"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {file ? (
                    <button
                      type="button"
                      onClick={() => handleViewFile(file)}
                      className="rounded-lg border border-slate-200 bg-white py-1.5 text-center text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
                    >
                      View File
                    </button>
                  ) : existingFileUrl ? (
                    <a
                      href={existingFileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-lg border border-slate-200 bg-white py-1.5 text-center text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
                    >
                      View File
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    disabled={disabled}
                    className="rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Change File
                  </button>
                </div>
              )}
            </div>
          ) : null}
          {!errorText && (!file || ocrStatus !== "WARNING") ? (
            <div className={`mt-3 flex items-center gap-2 border-t pt-3 ${fileFooterTone}`}>
              {file ? (
                <button
                  type="button"
                  onClick={() => handleViewFile(file)}
                  className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-center text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
                >
                  View File
                </button>
              ) : existingFileUrl ? (
                <a
                  href={existingFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-center text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
                >
                  View File
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={disabled}
                className="flex-1 rounded-lg border border-slate-200 bg-white py-1.5 text-[11px] font-bold text-slate-600 shadow-2xs transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Change File
              </button>
            </div>
          ) : null}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={`flex h-full min-h-[175px] w-full flex-1 flex-col items-center justify-between rounded-2xl border border-dashed p-5 transition-all focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F3D5C]/10 ${
            errorText
              ? "cursor-pointer border-rose-300 bg-rose-50/20"
              : disabled
                ? "cursor-not-allowed border-slate-200 bg-slate-100/80"
                : isDragging
                  ? "cursor-pointer border-[#0F3D5C] bg-[#0F3D5C]/8 ring-4 ring-[#0F3D5C]/10"
                  : "cursor-pointer border-slate-300 bg-slate-50/20 hover:border-[#0a1f33]"
          }`}
        >
          <div className="my-auto flex flex-col items-center justify-center">
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700 shadow-2xs">
              <Upload className="h-5 w-5" />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-700">
                {isDragging ? "Drop file to upload" : emptyTitle || "Click to upload or drag it here"}
              </p>
              <p className="mt-1 text-[10px] text-slate-400">{emptySubtitle || subtitle}</p>
            </div>
          </div>
          {errorText ? (
            <div
              role="alert"
              className="mt-3 flex w-full animate-in justify-center px-4 pt-2 fade-in duration-200"
            >
              <div className="inline-flex items-start gap-1.5 text-left">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-600" aria-hidden="true" />
                <p className="text-[11px] font-medium leading-tight whitespace-normal text-rose-600">
                  {errorText}
                </p>
              </div>
            </div>
          ) : null}
        </button>
      )}
      {docxPreview ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="docx-preview-title"
            className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="min-w-0">
                <h2 id="docx-preview-title" className="text-sm font-bold text-slate-900">
                  Document preview
                </h2>
                <p className="truncate text-xs text-slate-500">{docxPreview.fileName}</p>
              </div>
              <button
                type="button"
                onClick={() => setDocxPreview(null)}
                className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                aria-label="Close document preview"
              >
                <X className="h-4 w-4" />
              </button>
            </header>
            {docxPreview.error ? (
              <p role="alert" className="p-5 text-sm text-rose-700">
                {docxPreview.error}
              </p>
            ) : (
              <>
                <p className="border-b border-slate-100 px-5 py-2 text-[11px] text-slate-500">
                  Text preview; original document formatting may differ.
                </p>
                <pre className="overflow-auto whitespace-pre-wrap p-5 text-sm leading-relaxed text-slate-800">
                  {docxPreview.text}
                </pre>
              </>
            )}
          </section>
        </div>
      ) : null}
    </div>
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
