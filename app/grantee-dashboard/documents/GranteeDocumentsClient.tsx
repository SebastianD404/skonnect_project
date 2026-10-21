"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowUpRight,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  AlertTriangle,
  FileText,
  GraduationCap,
  Image as ImageIcon,
  Info,
  Loader2,
  ShieldCheck,
  UploadCloud,
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
import { hasFailingGradeIndicators } from "@/lib/ocr/failing-grade-indicators";
import {
  buildSemesterTracker,
  getCurrentAcademicSemester,
  getDocumentSemesterOptions,
} from "@/lib/semester-progress";
import type { SubmissionStatus } from "@prisma/client";
import type { AcademicTermWindow } from "@/lib/academic-term-schedule";

type SubmissionItem = {
  id: string;
  semester: string;
  status: SubmissionStatus;
  coeStatus: SubmissionStatus;
  gradesStatus: SubmissionStatus;
  ocrStatus: "OCR_PENDING" | "OCR_DONE" | "OCR_NEEDS_REVIEW" | "OCR_FAILED" | null;
  reviewNotes: string | null;
  flaggedFields?: string[];
  resubmittedFields?: string[];
  submittedAt: string;
  reviewedAt: string | null;
  gradeFileUrl: string;
  coeFileUrl: string;
};

type Props = {
  submissions: SubmissionItem[];
  canSubmit: boolean;
  academicTermWindow: AcademicTermWindow;
  academicTermSchedules: Array<{
    semester: string;
    opensAt: string;
    closesAt: string;
  }>;
};

type UploadState = {
  gradeFile: File | null;
  coeFile: File | null;
  gradeFileUrl: string;
  coeFileUrl: string;
  semester: string;
};

type OcrStatus = "IDLE" | "SCANNING" | "SUCCESS" | "WARNING" | "ERROR";

const INITIAL_FORM: UploadState = {
  gradeFile: null,
  coeFile: null,
  gradeFileUrl: "",
  coeFileUrl: "",
  semester: "",
};

const BRAND = "#0F3D5C";
const BRAND_DARK = "#0A2A40";

function formatTermWindowDate(value: string | null) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-PH", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Manila",
  }).format(new Date(value));
}

function getInitialSelectedSemester(
  schedules: Props["academicTermSchedules"],
  submissions: SubmissionItem[],
  academicTermWindow: AcademicTermWindow
) {
  const now = Date.now();
  const currentAcademicSemester = getCurrentAcademicSemester(new Date(now));
  if (
    schedules.some((schedule) => schedule.semester === currentAcademicSemester) ||
    submissions.some((submission) => submission.semester === currentAcademicSemester)
  ) {
    return currentAcademicSemester;
  }

  const openSchedule = schedules.find(
    (schedule) => new Date(schedule.opensAt).getTime() <= now && new Date(schedule.closesAt).getTime() >= now
  );
  if (openSchedule) return openSchedule.semester;

  const latestClosedSchedule = [...schedules]
    .filter((schedule) => new Date(schedule.closesAt).getTime() < now)
    .sort((a, b) => new Date(b.closesAt).getTime() - new Date(a.closesAt).getTime())[0];
  if (latestClosedSchedule) return latestClosedSchedule.semester;

  const earliestUpcomingSchedule = [...schedules]
    .filter((schedule) => new Date(schedule.opensAt).getTime() > now)
    .sort((a, b) => new Date(a.opensAt).getTime() - new Date(b.opensAt).getTime())[0];
  if (earliestUpcomingSchedule) return earliestUpcomingSchedule.semester;

  return submissions[0]?.semester ?? academicTermWindow.semester ?? "";
}

async function openSubmissionFile(viewerUrl: string) {
  const viewWindow = window.open("", "_blank");
  if (!viewWindow) {
    window.alert("Allow pop-ups for this site to view your document.");
    return;
  }
  viewWindow.opener = null;
  viewWindow.document.title = "Loading document";
  viewWindow.document.body.textContent = "Loading document…";

  try {
    const response = await fetch(`${viewerUrl}&metadata=true`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok || typeof payload.signedUrl !== "string") {
      throw new Error(payload.error || "Could not create a secure document link.");
    }
    viewWindow.location.replace(payload.signedUrl);
  } catch (error) {
    console.error("Could not open submission document:", error);
    if (viewWindow.closed) return;
    viewWindow.document.title = "Unable to open document";
    viewWindow.document.body.textContent =
      error instanceof Error ? error.message : "Could not open this document.";
  }
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
      label: "Pending",
      tone: {
        bar: "bg-amber-500/70",
        chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
        icon: <Clock className="h-3.5 w-3.5" />,
      },
    };
  }

  return {
    label: "Pending",
    tone: {
      bar: "bg-amber-500/70",
      chip: "bg-amber-50 text-amber-800 ring-1 ring-amber-100",
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
    throw new Error("We can't check this Word document here. You can still submit it for SK admin review.");
  }

  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
    try {
      const pdfjs = await import("pdfjs-dist");
      if (typeof window !== "undefined" && "Worker" in window) {
        pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
      }

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
        "We couldn't read this PDF. Try a clearer copy or submit it for SK admin review."
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

export default function GranteeDocumentsClient({
  submissions,
  canSubmit,
  academicTermWindow,
  academicTermSchedules,
}: Props) {
  const router = useRouter();
  const [currentTime, setCurrentTime] = useState(() => Date.now());
  const [form, setForm] = useState<UploadState>(() => ({
    ...INITIAL_FORM,
    semester: getInitialSelectedSemester(academicTermSchedules, submissions, academicTermWindow),
  }));
  const [gradeOcrStatus, setGradeOcrStatus] = useState<OcrStatus>("IDLE");
  const [coeOcrStatus, setCoeOcrStatus] = useState<OcrStatus>("IDLE");
  const [gradeOcrWarning, setGradeOcrWarning] = useState<string | null>(null);
  const [gradeRequiresStrictReview, setGradeRequiresStrictReview] = useState(false);
  const [coeOcrWarning, setCoeOcrWarning] = useState<string | null>(null);
  const [gradeOcrOverride, setGradeOcrOverride] = useState(false);
  const [coeOcrOverride, setCoeOcrOverride] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [uploadingGrade, setUploadingGrade] = useState(false);
  const [uploadingCoe, setUploadingCoe] = useState(false);
  const [gradeFileError, setGradeFileError] = useState<string | null>(null);
  const [coeFileError, setCoeFileError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitNotice, setSubmitNotice] = useState<string | null>(null);
  const [ocrWarning, setOcrWarning] = useState<string | null>(null);
  const ocrRunIds = useRef({ grade: 0, coe: 0 });

  useEffect(() => {
    if (!submitNotice) return;
    const timeout = window.setTimeout(() => setSubmitNotice(null), 3500);
    return () => window.clearTimeout(timeout);
  }, [submitNotice]);

  useEffect(() => {
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (
      academicTermWindow.status === "UNCONFIGURED" ||
      !academicTermWindow.opensAt ||
      !academicTermWindow.closesAt
    ) {
      return;
    }

    const refreshAtWindowBoundary = () => {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      const expectedStatus = now < new Date(academicTermWindow.opensAt!).getTime()
        ? "UPCOMING"
        : now <= new Date(academicTermWindow.closesAt!).getTime()
          ? "OPEN"
          : "CLOSED";
      if (expectedStatus !== academicTermWindow.status) router.refresh();
    };
    const interval = window.setInterval(refreshAtWindowBoundary, 30_000);
    document.addEventListener("visibilitychange", refreshAtWindowBoundary);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refreshAtWindowBoundary);
    };
  }, [academicTermWindow, router]);

  const semesterOptions = useMemo(() => {
    const currentSemester = getCurrentAcademicSemester(new Date(currentTime));
    const options = getDocumentSemesterOptions(
      [
        ...submissions.map((submission) => submission.semester),
        ...academicTermSchedules.map((schedule) => schedule.semester),
        currentSemester,
      ],
      academicTermWindow.semester ?? undefined
    );
    const currentIndex = options.findIndex((option) => option.value === currentSemester);
    const nextSemester = currentIndex >= 0 ? options[currentIndex + 1]?.value : undefined;

    return options.map((option) => ({
      ...option,
      label: option.value === currentSemester
        ? `${option.value} (Current)`
        : option.value === nextSemester
          ? `${option.value} (Next)`
          : option.value,
    }));
  }, [submissions, academicTermSchedules, academicTermWindow, currentTime]);

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

  const correctionNote = currentSubmission?.reviewNotes?.trim() || "";

  const hasReturnedSubmission = currentSubmission?.status === "RETURNED_FOR_EDIT";

  // When a submission for the selected semester is already approved and both files are present and not flagged,
  // treat the form as closed/read-only for that term.
  const isSubmissionClosed =
    currentSubmission?.status === "APPROVED" &&
    hasExistingGradeReport &&
    hasExistingCoe &&
    !isGradeReportFlagged &&
    !isCoeFlagged;
  const canResubmitReturned =
    currentSubmission?.status === "RETURNED_FOR_EDIT" &&
    (currentSubmission.flaggedFields?.length ?? 0) > 0;
  const canSubmitForSelectedTerm =
    (academicTermWindow.status === "OPEN" && form.semester === academicTermWindow.semester) ||
    canResubmitReturned;

  const termWindowMessage = canResubmitReturned
    ? "SK admin requested a correction. Replace the flagged document to resubmit it."
    : academicTermWindow.status === "UNCONFIGURED"
      ? "The academic document submission schedule has not been set yet. Please check back later."
      : academicTermWindow.status === "UPCOMING"
        ? `Submissions for ${academicTermWindow.semester} open on ${formatTermWindowDate(academicTermWindow.opensAt)}.`
        : academicTermWindow.status === "CLOSED"
          ? `The submission window for ${form.semester || academicTermWindow.semester} is closed. You can still view previously submitted files.`
          : form.semester === academicTermWindow.semester
            ? `Submissions are open until ${formatTermWindowDate(academicTermWindow.closesAt)}.`
            : `Uploads are open for ${academicTermWindow.semester}. Other terms are available for viewing only.`;

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

  const tracker = useMemo(
    () => form.semester
      ? buildSemesterTracker(submissions, form.semester)
      : { current: "Not scheduled", approved: 0, total: 2, pct: 0 },
    [submissions, form.semester]
  );
  const selectedTermSchedule = academicTermSchedules.find((schedule) => schedule.semester === form.semester);
  const selectedTermStatus: AcademicTermWindow["status"] = selectedTermSchedule
    ? currentTime < new Date(selectedTermSchedule.opensAt).getTime()
      ? "UPCOMING"
      : currentTime <= new Date(selectedTermSchedule.closesAt).getTime()
        ? "OPEN"
        : "CLOSED"
    : form.semester
      ? "CLOSED"
      : "UNCONFIGURED";
  const isSelectedCurrentTerm = form.semester === getCurrentAcademicSemester(new Date(currentTime));

  async function uploadFile(
    file: File,
    kind: "grade" | "coe",
    runId: number
  ) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);
    formData.append("semester", form.semester);

    const response = await fetch("/api/grantee/submissions/upload", {
      method: "POST",
      body: formData,
    });

    const result = await response.json();
    if (!response.ok) {
      throw new Error(result?.error || "Upload failed");
    }
    if (ocrRunIds.current[kind] !== runId) return;

    if (kind === "grade") {
      setForm((prev) => ({ ...prev, gradeFile: file, gradeFileUrl: result.path }));
    } else {
      setForm((prev) => ({ ...prev, coeFile: file, coeFileUrl: result.path }));
    }
  }

  async function runInstantOCR(
    file: File,
    kind: "grade" | "coe",
    runId: number
  ): Promise<boolean> {
    const setStatus = kind === "grade" ? setGradeOcrStatus : setCoeOcrStatus;
    const setWarning = kind === "grade" ? setGradeOcrWarning : setCoeOcrWarning;
    setStatus("SCANNING");
    setWarning(null);
    if (kind === "grade") {
      setGradeOcrOverride(false);
      setGradeRequiresStrictReview(false);
    }
    else setCoeOcrOverride(false);

    try {
      const text = await extractSelectedFileText(file);
      if (ocrRunIds.current[kind] !== runId) return false;
      if (kind === "grade") {
        setGradeRequiresStrictReview(hasFailingGradeIndicators(text));
      }

      if (kind === "coe") {
        const normalizedText = text.toLowerCase();
        const gradeKeywords = ["gwa", "transcript", "form 138", "report card", "final grade"];
        const isGradeReport = gradeKeywords.some((keyword) => normalizedText.includes(keyword));

        if (isGradeReport) {
          setForm((prev) => ({ ...prev, coeFile: file, coeFileUrl: "" }));
          setCoeOcrStatus("WARNING");
          setCoeOcrWarning("This looks like your Grade Report. Please verify your file.");
          setCoeOcrOverride(false);
          setCoeFileError(null);
          return true;
        }
      }

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
      return true;
    } catch (error) {
      if (ocrRunIds.current[kind] !== runId) return false;
      console.error("Document check failed for selected file.", error);
      setStatus("WARNING");
      setWarning("We couldn't check this file. You can still submit it for SK admin review.");
      return true;
    }
  }

  async function handleFileChange(file: File | null, kind: "grade" | "coe") {
    if (!file) return;
    setSubmitError(null);
    const runId = ++ocrRunIds.current[kind];

    const setFileError = kind === "grade" ? setGradeFileError : setCoeFileError;
    const setOcrStatus = kind === "grade" ? setGradeOcrStatus : setCoeOcrStatus;
    const setOcrWarning = kind === "grade" ? setGradeOcrWarning : setCoeOcrWarning;
    const setOcrOverride = kind === "grade" ? setGradeOcrOverride : setCoeOcrOverride;
    if (kind === "grade") {
      setForm((prev) => ({ ...prev, gradeFile: file, gradeFileUrl: "" }));
      setGradeRequiresStrictReview(false);
    } else {
      setForm((prev) => ({ ...prev, coeFile: file, coeFileUrl: "" }));
    }
    setOcrStatus("IDLE");
    setOcrWarning(null);
    setOcrOverride(false);
    setFileError(null);

    const normalizedFileType = file.type.toLowerCase();
    const isWordDocument =
      normalizedFileType === "application/msword" ||
      normalizedFileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      /\.(doc|docx)$/i.test(file.name);
    if (isWordDocument) {
      setOcrStatus("ERROR");
      setFileError(
        'Word documents aren\'t supported here. Please save this file as a PDF and upload it again.'
      );
      return;
    }

    const allowedTypes = kind === "grade" ? GRADE_REPORT_MIME_TYPES : COE_MIME_TYPES;
    if (!allowedTypes.has(normalizedFileType)) {
      setOcrStatus("ERROR");
      setFileError(
        kind === "grade"
          ? "Grade reports must be PDF, JPG, PNG, or WEBP files."
          : "Certificates of Enrollment must be PDF, JPG, PNG, or WEBP files."
      );
      return;
    }
    if (file.size > MAX_GRADE_REPORT_BYTES) {
      setOcrStatus("ERROR");
      setFileError("File exceeds the 10MB limit. Please select a smaller file.");
      return;
    }
    if (file.size === 0) {
      setOcrStatus("ERROR");
      setFileError("This file is empty. Please select a valid file.");
      return;
    }

    try {
      const shouldUpload = await runInstantOCR(file, kind, runId);
      if (!shouldUpload || ocrRunIds.current[kind] !== runId) return;

      if (kind === "grade") setUploadingGrade(true);
      if (kind === "coe") setUploadingCoe(true);
      await uploadFile(file, kind, runId);
    } catch (error) {
      if (ocrRunIds.current[kind] !== runId) return;
      const text = error instanceof Error ? error.message : "Upload failed";
      const setFileError = kind === "grade" ? setGradeFileError : setCoeFileError;
      const setOcrStatus = kind === "grade" ? setGradeOcrStatus : setCoeOcrStatus;
      const setOcrWarning = kind === "grade" ? setGradeOcrWarning : setCoeOcrWarning;
      setFileError(text);
      setOcrStatus("WARNING");
      setOcrWarning(null);
    } finally {
      if (ocrRunIds.current[kind] === runId) {
        if (kind === "grade") setUploadingGrade(false);
        if (kind === "coe") setUploadingCoe(false);
      }
    }
  }

  async function handleSubmit(event?: React.FormEvent, forceOverride = false) {
    event?.preventDefault();
    setSubmitError(null);
    setOcrWarning(null);

    if (!canSubmit) {
      setSubmitError("Complete your grantee profile (school and year level) in Profile settings to enable submissions.");
      return;
    }

    if (!form.semester || /summer/i.test(form.semester)) {
      setSubmitError("Please select a supported academic semester.");
      return;
    }

    if (!canSubmitForSelectedTerm) {
      setSubmitError("Document submissions are not open for the selected academic term.");
      return;
    }

    if (gradeFileError || coeFileError) {
      return;
    }

    if ([form.gradeFile, form.coeFile].some((file) => file && (file.size === 0 || file.size > MAX_GRADE_REPORT_BYTES))) {
      return;
    }

    if (gradeOcrStatus === "SCANNING" || coeOcrStatus === "SCANNING") {
      setSubmitError("Please wait until both files have finished checking before submitting.");
      return;
    }

    if (
      (gradeOcrStatus === "WARNING" && !gradeOcrOverride) ||
      (coeOcrStatus === "WARNING" && !coeOcrOverride)
    ) {
      setSubmitNotice("Please confirm that the flagged file is correct to continue.");
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
      const missingDocuments = [
        ...(!finalGradeFileUrl
          ? [referenceFlags.has("GRADE_REPORT") ? "a corrected Grade Report" : "a Grade Report"]
          : []),
        ...(!finalCoeFileUrl
          ? [referenceFlags.has("COE") ? "a corrected Certificate of Enrollment" : "a Certificate of Enrollment"]
          : []),
      ];
      setSubmitError(`Please upload ${missingDocuments.join(" and ")} before submitting.`);
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
          requiresStrictManualReview: gradeRequiresStrictReview,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        if (result.requiresOverride) {
          setOcrWarning("We couldn't confirm the document details. You can still submit it for SK admin review.");
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
      setGradeRequiresStrictReview(false);
      setCoeOcrOverride(false);
      setForm((current) => ({
        ...current,
        gradeFile: null,
        coeFile: null,
        gradeFileUrl: "",
        coeFileUrl: "",
      }));
      setShowSuccessModal(true);
      router.refresh();
    } catch (error) {
      const text = error instanceof TypeError
        ? "We couldn't reach the server to confirm your submission. Your uploaded files are still saved; please try again."
        : error instanceof Error
          ? error.message
          : "Submission failed. Please try again.";
      setSubmitError(text);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen space-y-6 bg-slate-50/40 py-4 sm:py-6 lg:py-8">
      {submitNotice ? (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-2 rounded-xl border border-amber-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 shadow-lg sm:right-6"
        >
          <Info className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
          <span>{submitNotice}</span>
          <button
            type="button"
            onClick={() => setSubmitNotice(null)}
            className="ml-2 rounded p-1 text-slate-400 transition-colors hover:text-slate-700"
            aria-label="Dismiss notification"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
      <header
        className="relative overflow-hidden rounded-2xl bg-[#0a1f33] p-6 text-white shadow-sm sm:p-8"
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight">My Requirements</h1>
          <p className="max-w-2xl text-xs leading-relaxed text-slate-300 sm:text-sm">
            Upload your Certificate of Enrollment and Grade Report to keep your grantee status active. We check
            grade reports for common issues before sending them to SK for review.
          </p>
        </div>
      </header>

      <SemesterTracker
        term={tracker.current}
        approved={tracker.approved}
        total={tracker.total}
        pct={tracker.pct}
        windowStatus={selectedTermStatus}
        isCurrentTerm={isSelectedCurrentTerm}
        opensAt={selectedTermSchedule?.opensAt ?? null}
        closesAt={selectedTermSchedule?.closesAt ?? null}
      />

      <div className="grid grid-cols-1 items-stretch overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm lg:grid-cols-12">
        <section className="border-b border-slate-200/80 p-5 sm:p-8 lg:col-span-8 lg:border-b-0 lg:border-r">
          <div className="mb-6 space-y-1 border-b border-slate-100 pb-6">
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Submit Requirements</h2>
            <p className="text-xs text-slate-500">
              Upload your documents for a quick check before SK review.
            </p>
          </div>
          <div className="space-y-0">
            {!canSubmit ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
                Submissions are temporarily unavailable because your grantee profile is incomplete. Please update your school and year level in Profile settings. You can still view your requirement history.
              </div>
            ) : null}

            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-0">
              {submitError ? <p role="alert" className="mb-4 text-sm font-medium text-rose-600">{submitError}</p> : null}
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
                  {!semesterOptions.some((option) => option.value === form.semester) ? (
                    <option value="" disabled>Select academic term</option>
                  ) : null}
                  {semesterOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <p className="text-[11px] leading-relaxed text-slate-500">{termWindowMessage}</p>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-6 md:grid-cols-2">
                <Field label="Upload Grade Report" icon={<FileText className="h-4 w-4 text-slate-500" />}>
                  <FileDrop
                    file={form.gradeFile}
                    existingFileName={hasExistingGradeReport && !form.gradeFile ? existingGradeReportName : undefined}
                    existingFileUrl={
                      hasExistingGradeReport && !form.gradeFile && currentSubmission
                        ? `/api/submissions/${currentSubmission.id}/file?kind=grade`
                        : undefined
                    }
                    correctionRequired={hasReturnedSubmission && isGradeReportFlagged && !form.gradeFile}
                    isResubmissionFile={hasReturnedSubmission && isGradeReportFlagged && Boolean(form.gradeFile)}
                    isResubmitted={Boolean(currentSubmission?.resubmittedFields?.includes("GRADE_REPORT")) && currentSubmission?.gradesStatus === "PENDING"}
                    correctionNote={correctionNote}
                    uploading={uploadingGrade}
                    ocrStatus={gradeOcrStatus}
                    ocrWarning={gradeOcrWarning}
                    ocrOverridden={gradeOcrOverride}
                    onOcrOverride={() => setGradeOcrOverride(true)}
                    subtitle="PDF, JPG, PNG, WEBP"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    onChange={(file) => handleFileChange(file, "grade")}
                    errorText={gradeFileError}
                    onRemoveFile={() => {
                      ocrRunIds.current.grade += 1;
                      setGradeOcrStatus("IDLE");
                      setGradeOcrWarning(null);
                      setGradeOcrOverride(false);
                      setGradeRequiresStrictReview(false);
                      setGradeFileError(null);
                      setForm((prev) => ({ ...prev, gradeFile: null, gradeFileUrl: "" }));
                    }}
                    disabled={!canSubmit || submitting || uploadingGrade || isSubmissionClosed || !canSubmitForSelectedTerm}
                  />
                </Field>

                <Field label="Certificate of Enrollment" icon={<GraduationCap className="h-4 w-4 text-slate-500" />}>
                  <FileDrop
                    file={form.coeFile}
                    existingFileName={hasExistingCoe && !form.coeFile && !coeFileError ? existingCoeName : undefined}
                    existingFileUrl={
                      hasExistingCoe && !form.coeFile && !coeFileError && currentSubmission
                        ? `/api/submissions/${currentSubmission.id}/file?kind=coe`
                        : undefined
                    }
                    correctionRequired={hasReturnedSubmission && isCoeFlagged && !form.coeFile}
                    isResubmissionFile={hasReturnedSubmission && isCoeFlagged && Boolean(form.coeFile)}
                    isResubmitted={Boolean(currentSubmission?.resubmittedFields?.includes("COE")) && currentSubmission?.coeStatus === "PENDING"}
                    correctionNote={correctionNote}
                    uploading={uploadingCoe}
                    ocrStatus={coeOcrStatus}
                    ocrWarning={coeOcrWarning}
                    ocrOverridden={coeOcrOverride}
                    onOcrOverride={() => setCoeOcrOverride(true)}
                    subtitle="PDF, JPG, PNG, WEBP"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
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
                    disabled={!canSubmit || submitting || uploadingCoe || isSubmissionClosed || !canSubmitForSelectedTerm}
                  />
                </Field>
              </div>

              {isSubmissionClosed ? (
                <div
                  role="status"
                  className="mt-4 flex items-center gap-3 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3.5 py-2.5"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-emerald-900">Requirements approved</p>
                    <p className="mt-0.5 text-[11px] leading-relaxed text-emerald-800/80">
                      Both documents for {form.semester || "this academic term"} have been approved.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="mt-5 border-l-2 border-cyan-600 py-0.5 pl-3 text-xs leading-relaxed text-slate-600">
                  <span className="font-bold text-slate-800">Document review:</span> Upload clear, readable files. If we cannot confirm a file, SK admin will review it.
                </div>
              )}

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

              <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-slate-100 pt-5 sm:flex-row">
                <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
                  Encrypted and securely stored
                </div>
                {isSubmissionClosed ? (
                  <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-emerald-50 px-3.5 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                    Approved
                  </span>
                ) : (
                  <button
                    type="submit"
                    disabled={!canSubmit || submitting || uploadingGrade || uploadingCoe || !canSubmitForSelectedTerm}
                    className="flex h-10 w-32 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0a1f33] text-xs font-bold text-white shadow-sm transition-all duration-150 hover:bg-[#122e48] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-white" aria-hidden="true" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>{hasReturnedSubmission ? "Resubmit" : "Submit"}</span>
                        <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                )}
              </div>
            </form>
          </div>
        </section>

        <aside className="flex h-full flex-col justify-between bg-white p-5 sm:p-8 lg:col-span-4">
          <section className="shrink-0 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Status Breakdown</h2>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-100 bg-white">
              <StatusRow label="Pending" value={stats.pending} tone="pending" />
              <StatusRow label="Approved" value={stats.approved} tone="approved" />
              <StatusRow label="Review" value={stats.needsEdit} tone="revision" />
            </div>
          </section>

          <section
            className={`mt-6 flex min-h-0 flex-1 flex-col ${
              fullyClearedSemesterOptions.length > 2 ? "gap-3" : "gap-5"
            }`}
          >
            <div className="flex shrink-0 items-center gap-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">Recent Submissions</h2>
            </div>

          {fullyClearedRows.length > 0 && fullyClearedSemesterOptions.length > 2 ? (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
              <label htmlFor="fully-cleared-semester" className="sr-only">Filter fully cleared by semester</label>
              <div className="relative min-w-0 max-w-full">
                <select
                  id="fully-cleared-semester"
                  value={fullyClearedSemesterFilter}
                  onChange={(e) => setFullyClearedSemesterFilter(e.target.value)}
                  className="min-w-0 max-w-full appearance-none rounded-lg border border-slate-200 bg-white py-2 pl-3 pr-9 text-xs text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  {fullyClearedSemesterOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt === "all" ? "All Semesters" : opt}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
              </div>
            </div>
          ) : null}

          <div className="custom-scroll flex min-h-0 flex-1 flex-col overflow-y-auto pr-1">
          {displayedSubmissions.length === 0 ? (
            <div className="flex min-h-[180px] flex-1 flex-col items-center justify-center space-y-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/30 p-6 text-center">
              <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <FileText className="h-4 w-4" aria-hidden="true" />
              </div>
              <p className="text-xs font-semibold text-slate-800">No submissions recorded yet.</p>
              <p className="max-w-[200px] text-[11px] leading-relaxed text-slate-400">Upload your term files above to begin.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {groupedSubmissions.map(([year, items]) => (
                <div key={year} className="space-y-2">
                  {items.map((submission) => (
                    <HistoryItem key={submission.id} submission={submission} />
                  ))}
                </div>
              ))}
            </div>
          )}
          </div>
          </section>
        </aside>
      </div>
      {showSuccessModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 animate-in fade-in duration-200"
          role="presentation"
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="submission-success-title"
            aria-describedby="submission-success-description"
            className="w-full max-w-[22rem] overflow-hidden rounded-3xl bg-white px-7 pb-5 shadow-xl animate-in zoom-in-95 duration-200"
          >
            <div className="flex justify-center pt-8">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600">
                  <Check className="h-5 w-5 stroke-[3] text-white" aria-hidden="true" />
                </div>
              </div>
            </div>
            <div className="pt-5 text-center">
              <h3 id="submission-success-title" className="mb-1.5 text-lg font-semibold tracking-tight text-slate-900">
                Requirements Submitted!
              </h3>
              <p id="submission-success-description" className="mb-4 text-[13px] leading-[1.5] text-slate-500">
                Your documents have been submitted for SK admin review. You can track your review status and view
                your submitted files in the{" "}
                <strong className="text-slate-700">Recent Submissions</strong> card on the right.
              </p>
              <button
                type="button"
                onClick={() => setShowSuccessModal(false)}
                className="h-10 w-full cursor-pointer rounded-full bg-slate-900 text-sm font-semibold text-white transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-slate-900/15"
              >
                Got it
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
  correctionRequired = false,
  isResubmissionFile = false,
  isResubmitted = false,
  correctionNote,
  uploading,
  ocrStatus = "IDLE",
  ocrWarning,
  ocrOverridden = false,
  onOcrOverride,
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
  correctionRequired?: boolean;
  isResubmissionFile?: boolean;
  isResubmitted?: boolean;
  correctionNote?: string;
  uploading?: boolean;
  ocrStatus?: OcrStatus;
  ocrWarning?: string | null;
  ocrOverridden?: boolean;
  onOcrOverride?: () => void;
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

  const hasFile = file !== null || Boolean(existingFileName);
  const isError = ocrStatus === "ERROR" || Boolean(errorText);
  const isWarning = ocrStatus === "WARNING" && !errorText;
  const fileCardTone = isError
    ? "border-rose-300 bg-rose-50/60"
    : correctionRequired
      ? "border-rose-200 bg-rose-50/30"
    : isWarning
      ? "border-amber-200 bg-amber-50/20"
    : ocrStatus === "SUCCESS" || (!file && existingFileName)
      ? "border-emerald-200 bg-emerald-50/20"
      : "border-slate-200 bg-white";
  const fileIconTone = isError
    ? "border-rose-200 text-rose-600"
    : correctionRequired
      ? "border-rose-200 text-rose-600"
    : isWarning
      ? "border-amber-200 text-orange-500"
    : ocrStatus === "SUCCESS" || (!file && existingFileName)
      ? "border-emerald-200 text-emerald-600"
      : "border-slate-100 text-slate-600";

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative h-[215px] w-full shrink-0"
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
      {hasFile ? (
        ocrStatus === "SCANNING" || uploading ? (
        <div
          role="status"
          aria-live="polite"
          className="flex h-[215px] w-full flex-col items-center justify-center rounded-2xl border border-sky-200 bg-sky-50/40 p-4 text-center shadow-2xs transition-colors duration-200"
        >
          <div className="relative mb-4 h-12 w-12">
            <Loader2 className="absolute inset-0 h-12 w-12 animate-spin text-sky-500" aria-hidden="true" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className="h-5 w-5 text-sky-600" aria-hidden="true" />
            </div>
          </div>
          <p className="text-[13px] font-bold text-slate-800">
            {uploading ? "Uploading document..." : "Checking document..."}
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {uploading ? "Please wait while we save your file." : "Please wait while we check your file."}
          </p>
        </div>
        ) : (
        <div className={`flex h-[215px] w-full flex-col justify-between rounded-2xl border p-4 shadow-2xs transition-colors duration-200 ${fileCardTone}`}>
          {/* TOP SLOT: File identity */}
          <div className="flex h-[68px] shrink-0 items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-3 overflow-hidden">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-white shadow-2xs ${fileIconTone}`}>
                {isError || isWarning || correctionRequired ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                ) : ocrStatus === "SUCCESS" ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  isDocumentFile(file?.name ?? existingFileName ?? "")
                    ? <FileText className="h-4 w-4" aria-hidden="true" />
                    : <ImageIcon className="h-4 w-4" aria-hidden="true" />
                )}
              </div>
              <div className="min-w-0 pt-0.5">
                <div className="flex min-w-0 items-center gap-1.5">
                  <p className="min-w-0 flex-1 truncate text-xs font-bold text-slate-900">
                    {file?.name ?? existingFileName}
                  </p>
                  {isResubmissionFile || isResubmitted ? (
                    <span className="shrink-0 rounded-full bg-sky-100 px-1.5 py-0.5 text-[9px] font-bold leading-none text-sky-700">
                      {isResubmitted ? "Resubmitted" : "Replacement"}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  {file ? (
                    <span className="text-[11px] font-medium text-slate-500">{formatFileSize(file.size)}</span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-500">Previously uploaded</span>
                  )}
                  <span className="text-[10px] text-slate-300" aria-hidden="true">•</span>
                  {file && ocrStatus !== "SUCCESS" ? (
                    <button
                      type="button"
                      onClick={() => handleViewFile(file)}
                      className={`inline-flex cursor-pointer items-center gap-0.5 text-[10px] font-bold hover:underline ${
                        isError ? "text-rose-600" : isWarning ? "text-amber-600" : "text-blue-600"
                      }`}
                    >
                      View File <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : !file && existingFileUrl ? (
                    <button
                      type="button"
                      onClick={() => void openSubmissionFile(existingFileUrl)}
                      className="inline-flex items-center gap-0.5 text-[10px] font-bold text-blue-600 hover:underline"
                    >
                      View File <ArrowUpRight className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
            {file ? (
              <button
                type="button"
                onClick={onRemoveFile}
                disabled={disabled}
                className="shrink-0 rounded-lg p-1 text-slate-400 transition-colors hover:text-rose-500 disabled:cursor-not-allowed disabled:opacity-50"
                title="Remove file"
                aria-label="Remove file"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          {/* MIDDLE SLOT: Status, warning, and next step */}
          <div className="my-auto flex min-h-0 shrink-0 items-start gap-2 py-1">
            {correctionRequired ? (
              <div className="min-w-0 border-l-2 border-rose-300 pl-2.5" role="alert">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold leading-snug text-rose-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Correction required
                </p>
                {correctionNote ? (
                  <div
                    aria-label="SK admin note"
                    className="ml-5 mt-1 max-h-10 overflow-y-auto overscroll-contain break-words pr-1 text-[10px] leading-snug text-slate-600"
                  >
                    <span className="font-semibold text-slate-500">Admin note: </span>
                    <span className="whitespace-pre-wrap">{correctionNote}</span>
                  </div>
                ) : null}
              </div>
            ) : isError ? (
              <>
                <AlertCircle className="mt-[1px] h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <p className="text-[11px] leading-snug text-rose-700" role="alert">
                  {errorText || ocrWarning || "This file cannot be used for this document requirement."}
                </p>
              </>
            ) : isWarning ? (
              <>
                {ocrOverridden ? (
                  <>
                    <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
                    <p className="text-[11px] leading-snug text-amber-900" role="status" aria-live="polite">
                      {ocrWarning || "This document needs a closer look."} It will be reviewed by SK admin. You can submit your documents now.
                    </p>
                  </>
                ) : (
                  <>
                    <Info className="mt-[2px] h-3.5 w-3.5 shrink-0 text-amber-600/70" aria-hidden="true" />
                    <p className="text-[11px] leading-snug text-amber-800/80" role="alert">
                      {errorText
                        ? errorText
                        : `${ocrWarning || "We couldn't confirm the details in this file."} You can still send it for review if this is the correct document.`}
                    </p>
                  </>
                )}
              </>
            ) : !file ? (
              <>
                <ShieldCheck className="mt-[2px] h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                <p className="text-[11px] leading-snug text-slate-500">
                  Documents are encrypted and securely routed for SK admin review.
                </p>
              </>
            ) : (
              <>
                <CheckCircle2 className="mt-[2px] h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />
                <p className="text-[11px] leading-snug text-slate-500">
                  This file looks ready and is waiting for SK admin review.
                </p>
              </>
            )}
          </div>

          <div className="flex h-8 shrink-0 items-center gap-2">
            {ocrStatus === "WARNING" && file && !errorText ? (
              <>
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled}
                  className="h-8 flex-1 rounded-lg border border-slate-200 bg-white text-center text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Change File
                </button>
                <button
                  type="button"
                  onClick={onOcrOverride}
                  disabled={ocrOverridden}
                  className={`inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-lg text-center text-[11px] font-bold text-white shadow-xs transition-all duration-150 ${
                    ocrOverridden
                      ? "cursor-default bg-amber-800"
                      : "bg-amber-600 hover:bg-amber-700 active:scale-[0.98]"
                  }`}
                >
                  {ocrOverridden ? (
                    <>
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Selected for review
                    </>
                  ) : "Proceed Anyway"}
                </button>
              </>
            ) : (
              <>
                {file ? (
                  <button
                    type="button"
                    onClick={() => handleViewFile(file)}
                    className="h-8 flex-1 rounded-lg border border-slate-200 bg-white text-center text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
                  >
                    View File
                  </button>
                ) : existingFileUrl ? (
                  <button
                    type="button"
                    onClick={() => void openSubmissionFile(existingFileUrl)}
                    className="flex h-8 flex-1 items-center justify-center rounded-lg border border-slate-200 bg-white text-center text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50"
                  >
                    View File
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={disabled}
                  className="h-8 flex-1 rounded-lg border border-slate-200 bg-white text-center text-[11px] font-bold text-slate-700 shadow-2xs transition-all hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Change File
                </button>
              </>
            )}
          </div>
        </div>
        )
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className={`group flex h-[215px] w-full select-none flex-col items-center justify-center rounded-2xl border-2 border-dashed p-4 text-center shadow-2xs transition-all duration-150 ease-out active:scale-[0.98] active:bg-sky-100/40 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0F3D5C]/10 ${
            errorText
              ? "cursor-pointer border-rose-400 bg-rose-50/30 hover:bg-rose-50/50 active:bg-rose-100/40"
              : disabled
                ? "cursor-not-allowed border-slate-200 bg-slate-100/80"
                : isDragging
                  ? "cursor-pointer border-sky-300 bg-slate-50 ring-4 ring-sky-100"
                  : "cursor-pointer border-slate-200 bg-slate-50/30 hover:border-sky-400 hover:bg-sky-50/50"
          }`}
        >
          <span className="pointer-events-none flex flex-col items-center justify-center gap-3">
            <span className={`mb-1 flex h-10 w-10 items-center justify-center rounded-full transition-all duration-150 ease-out group-active:translate-y-0 group-active:scale-95 group-active:shadow-sm ${
              errorText
                ? "bg-rose-100/70 text-rose-600"
                : "bg-sky-100/70 text-sky-600 group-hover:-translate-y-1.5 group-hover:bg-sky-500 group-hover:text-white group-hover:shadow-lg group-hover:shadow-sky-500/30"
            }`}>
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
            </span>
            <span>
              <span className={`block text-sm font-semibold transition-colors duration-300 ${
                errorText ? "text-rose-700" : "text-slate-700 group-hover:text-sky-700"
              }`}>
                {isDragging ? "Drop file to upload" : <>Click to upload <span className={`font-normal transition-colors duration-300 ${errorText ? "text-rose-500" : "text-slate-500 group-hover:text-sky-600"}`}>or drag and drop</span></>}
              </span>
              <span className="mt-1.5 block text-[11px] text-slate-500">{subtitle}</span>
              <span className="mt-0.5 block text-[10px] font-medium text-slate-400">
                Maximum file size: 10MB
              </span>
            </span>
            {errorText ? (
              <span className="mt-2 flex w-full items-start justify-center gap-1.5 px-2 text-left" role="alert">
                <AlertCircle className="mt-[1px] h-4 w-4 shrink-0 text-rose-600" aria-hidden="true" />
                <span className="line-clamp-2 text-[11px] font-medium leading-snug text-rose-600">
                  {errorText}
                </span>
              </span>
            ) : (
              <span className="pointer-events-auto mt-2 flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 transition-all duration-200 group-hover:bg-white group-hover:shadow-xs group-active:scale-95">
                <ShieldCheck className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span className="text-[10px] font-medium text-slate-600">Securely routed for SK review</span>
              </span>
            )}
          </span>
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
  windowStatus,
  isCurrentTerm,
  opensAt,
  closesAt,
}: {
  term: string;
  approved: number;
  total: number;
  pct: number;
  windowStatus: AcademicTermWindow["status"];
  isCurrentTerm: boolean;
  opensAt: string | null;
  closesAt: string | null;
}) {
  const windowLabel = windowStatus === "OPEN"
    ? `Open until ${formatTermWindowDate(closesAt)}`
    : windowStatus === "UPCOMING"
      ? `Opens ${formatTermWindowDate(opensAt)}`
      : windowStatus === "CLOSED"
        ? "Submission window closed"
        : "Schedule not set";
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-center gap-3.5">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-900 text-white shadow-sm">
            <Calendar className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Academic term</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                isCurrentTerm || windowStatus === "OPEN"
                  ? "bg-emerald-50 text-emerald-700"
                  : windowStatus === "UPCOMING"
                    ? "bg-sky-50 text-sky-700"
                    : "bg-slate-100 text-slate-600"
              }`}>
                {isCurrentTerm || windowStatus === "OPEN" ? "Current" : windowStatus === "UPCOMING" ? "Next" : windowStatus === "CLOSED" ? "Closed" : "Not scheduled"}
              </span>
            </div>
            <p className="text-sm font-bold text-slate-900">{term}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">{windowLabel}</p>
          </div>
        </div>

        <div className="w-full space-y-1.5 md:w-80">
          <div className="flex justify-between text-xs font-medium text-slate-600">
            <span className="text-slate-400">{windowStatus === "OPEN" ? "Requirement Progress" : "Term status"}</span>
            <span className="font-bold text-slate-900">
              {windowStatus === "UPCOMING" ? "Not open yet" : `${approved} of ${total} Approved`}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500"
              style={{
                width: `${pct}%`,
                background: `linear-gradient(90deg, ${BRAND}, ${BRAND_DARK})`,
              }}
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

function HistoryItem({ submission }: { submission: SubmissionItem }) {
  const displayStatus = getSubmissionDisplayStatus(submission);
  const hasGradeReport = Boolean(submission.gradeFileUrl);
  const hasCoe = Boolean(submission.coeFileUrl);
  const semesterStart = submission.semester.match(/\b20\d{2}\b/)?.[0];
  const semesterName = semesterStart
    ? submission.semester.replace(new RegExp(`^\\s*${semesterStart}\\s*-\\s*20\\d{2}\\s*`), "").trim()
    : submission.semester;
  const academicYear = getAcademicYear(submission.semester).replace(/\s/g, "");
  const getFileType = (url: string) => {
    const extension = getFilenameFromUrl(url).split(".").pop()?.toUpperCase();
    return extension && extension.length <= 5 ? extension : "FILE";
  };

  return (
    <article className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm transition-shadow motion-safe:duration-150 hover:shadow-md">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-600">{academicYear}</p>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${displayStatus.tone.chip}`}>
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-current" />
          {displayStatus.label}
        </span>
      </div>
      <h3 className="mt-0.5 text-sm font-semibold tracking-tight text-slate-900">{semesterName}</h3>
      <p className="mt-1 inline-flex items-center gap-1.5 text-[11px] text-slate-500">
        <Calendar className="h-3 w-3 text-slate-400" aria-hidden="true" />
        Submitted {new Date(submission.submittedAt).toLocaleDateString()}
      </p>

      {(hasGradeReport || hasCoe) ? (
        <>
          <div className="my-2.5 h-px bg-slate-100" />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {hasGradeReport ? (
              <button
                type="button"
                onClick={() => void openSubmissionFile(`/api/submissions/${submission.id}/file?kind=grade`)}
                title="Grade Report"
                className="group flex min-w-0 items-center justify-between gap-1.5 rounded-xl bg-slate-100/80 px-2 py-1.5 transition-colors hover:bg-slate-100"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-slate-800">Grade Report</span>
                    <span className="block text-[9px] text-slate-500">{getFileType(submission.gradeFileUrl)}</span>
                  </span>
                </span>
                <ArrowUpRight className="h-3 w-3 shrink-0 text-slate-400 transition-colors group-hover:text-blue-600" aria-hidden="true" />
              </button>
            ) : null}
            {hasCoe ? (
              <button
                type="button"
                onClick={() => void openSubmissionFile(`/api/submissions/${submission.id}/file?kind=coe`)}
                title="Certificate of Enrollment"
                className="group flex min-w-0 items-center justify-between gap-1.5 rounded-xl bg-slate-100/80 px-2 py-1.5 transition-colors hover:bg-slate-100"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-blue-600 shadow-sm">
                    <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[11px] font-medium text-slate-800">COE</span>
                    <span className="block text-[9px] text-slate-500">{getFileType(submission.coeFileUrl)}</span>
                  </span>
                </span>
                <ArrowUpRight className="h-3 w-3 shrink-0 text-slate-400 transition-colors group-hover:text-blue-600" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </>
      ) : null}
    </article>
  );
}
