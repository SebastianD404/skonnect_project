"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  ShieldCheck,
  Sparkles,
  Upload,
} from "lucide-react";

type SubmissionItem = {
  id: string;
  semester: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  generalAverage: number | null;
  reviewNotes: string | null;
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

function statusLabel(status: SubmissionItem["status"]) {
  if (status === "APPROVED") return "Approved";
  if (status === "REJECTED") return "Needs editing";
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

  if (status === "REJECTED") {
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

function buildSemesterTracker(submissions: SubmissionItem[]) {
  const current = submissions[0]?.semester ?? "Current term";
  const inTerm = submissions.filter((s) => s.semester === current);
  const approved = inTerm.filter((s) => s.status === "APPROVED").length;
  const total = Math.max(inTerm.length, 1);
  const pct = Math.round((approved / total) * 100);
  return { current, approved, total, pct };
}

export default function GranteeDocumentsClient({ submissions, canSubmit }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<UploadState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [uploadingGrade, setUploadingGrade] = useState(false);
  const [uploadingCoe, setUploadingCoe] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const stats = useMemo(() => {
    const pending = submissions.filter((s) => s.status === "PENDING").length;
    const approved = submissions.filter((s) => s.status === "APPROVED").length;
    const needsEdit = submissions.filter((s) => s.status === "REJECTED").length;
    return { pending, approved, needsEdit };
  }, [submissions]);

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

    if (!form.semester || !form.gradeFileUrl || !form.coeFileUrl) {
      setMessage({ type: "error", text: "Please complete semester, grade report, and COE before submitting." });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/grantee/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          semester: form.semester,
          gradeFileUrl: form.gradeFileUrl,
          coeFileUrl: form.coeFileUrl,
          generalAverage: form.generalAverage,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error || "Failed to submit documents");
      }

      setForm(INITIAL_FORM);
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

            {message ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  message.type === "success"
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-rose-200 bg-rose-50 text-rose-700"
                }`}
              >
                {message.text}
              </div>
            ) : null}

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
                  <FileDrop
                    title={uploadingGrade ? "Uploading grade report..." : form.gradeFile ? `${form.gradeFile.name} uploaded` : "Drop grade report here"}
                    subtitle="PDF, JPG, PNG, WEBP - max 10MB"
                    onChange={(file) => handleFileChange(file, "grade")}
                    disabled={!canSubmit || submitting || uploadingGrade}
                  />
                </Field>

                <Field label="Upload Certificate of Enrollment">
                  <FileDrop
                    title={uploadingCoe ? "Uploading COE..." : form.coeFile ? `${form.coeFile.name} uploaded` : "Drop COE file here"}
                    subtitle="PDF, JPG, PNG, WEBP - max 10MB"
                    onChange={(file) => handleFileChange(file, "coe")}
                    disabled={!canSubmit || submitting || uploadingCoe}
                  />
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
  title,
  subtitle,
  onChange,
  disabled,
}: {
  title: string;
  subtitle: string;
  onChange: (file: File | null) => void;
  disabled?: boolean;
}) {
  const [isDragging, setIsDragging] = useState(false);

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

  return (
    <label
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
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
      <p className="text-sm font-medium text-slate-700">{isDragging ? "Drop file to upload" : title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <input
        type="file"
        accept="application/pdf,image/png,image/jpeg,image/webp"
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
