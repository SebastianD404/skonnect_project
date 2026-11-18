import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Award,
  Building2,
  Calendar,
  CheckCircle2,
  GraduationCap,
  Info,
  ShieldAlert,
  ShieldCheck,
  User,
  type LucideIcon,
} from "lucide-react";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAcademicSemester } from "@/lib/semester-progress";
import {
  getUploadGroups,
  SKEAP_UPLOAD_KEY,
} from "@/lib/skeap-upload";
import {
  getKKMemberArchiveReasonLabel,
  isKKMemberAgeOutReason,
  KK_MEMBER_AGE_OUT_REASON,
} from "@/lib/kk-member-archive";
import SkeapHistoryDocuments from "./SkeapHistoryDocuments";

type Props = {
  applicationId?: string;
};

function formatDate(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "long",
      }).format(date)
    : "Not available";
}

function ReceiptStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 backdrop-blur-xs">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-sky-200/80">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ReceiptDetail({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string | null | undefined;
}) {
  const displayValue = value?.trim() || "Not provided";
  const isMissing = displayValue.toLowerCase() === "not provided";

  return (
    <div className="flex min-w-0 items-start gap-3 border-b border-slate-200/70 pb-4 last:border-0">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-sky-800 shadow-sm ring-1 ring-slate-200/80">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        <p className={`mt-1 break-words text-sm ${isMissing ? "font-normal italic text-slate-400" : "font-semibold text-slate-900"}`}>
          {displayValue}
        </p>
      </div>
    </div>
  );
}

function getPastGranteeSummary(
  grantee: {
    status: string;
    graduatedAt: Date | null;
    dateRemoved: Date | null;
    revocationReason: string | null;
    revocationNotes: string | null;
    remarks: string | null;
    graduationRemarks: string | null;
    submissions: { reviewNotes: string | null }[];
  } | null,
  archivedProfile: {
    archivedAt: Date | null;
    archivedReason: string | null;
    reviewNotes: string | null;
  } | null,
) {
  if (grantee?.status === "GRADUATED") {
    return {
      kind: "graduated" as const,
      pillLabel: "Graduated",
      outcome: "Graduated Scholar",
      date: grantee.graduatedAt,
      remarks:
        grantee.graduationRemarks?.trim() ||
        grantee.remarks?.trim() ||
        "Completed degree requirements and cleared all SKEAP obligations.",
    };
  }

  if (grantee?.status === "REVOKED" || grantee?.status === "REMOVED") {
    const savedRemarks = grantee.remarks?.trim();
    const additionalRemarks = savedRemarks?.match(/Additional Notes:\s*([\s\S]*)/i)?.[1]?.trim();
    const remarks = [
      grantee.revocationReason,
      grantee.revocationNotes,
      grantee.submissions[0]?.reviewNotes,
      additionalRemarks || (savedRemarks !== grantee.revocationReason ? savedRemarks : null),
    ]
      .map((note) => note?.trim())
      .filter((note, index, notes): note is string => Boolean(note) && notes.indexOf(note) === index);

    return {
      kind: "revoked" as const,
      pillLabel: "Revoked",
      outcome: "Scholarship Revoked",
      date: grantee.dateRemoved,
      remarks: remarks.join("\n") || "No revocation reason or admin remarks were recorded.",
    };
  }

  if (archivedProfile && isKKMemberAgeOutReason(archivedProfile.archivedReason)) {
    return {
      kind: "completed" as const,
      pillLabel: "Aged Out (31+)",
      outcome: "Aged Out (31+) — RA 10742",
      date: archivedProfile.archivedAt,
      remarks:
        archivedProfile.reviewNotes?.trim() ||
        `${getKKMemberArchiveReasonLabel(archivedProfile.archivedReason)}: KK youth profile archived after reaching age 31 (maximum eligible age: 30).`,
    };
  }

  return {
    kind: "completed" as const,
    pillLabel: "Completed",
    outcome: "Completed Grant Period",
    date: null,
    remarks: grantee?.remarks?.trim() || "No exit remarks were recorded for this grant period.",
  };
}

function PastGranteeSummary({
  summary,
}: {
  summary: ReturnType<typeof getPastGranteeSummary>;
}) {
  const styles =
    summary.kind === "graduated"
      ? {
          icon: "bg-emerald-50 text-emerald-600",
          Icon: GraduationCap,
        }
      : summary.kind === "revoked"
        ? {
            icon: "bg-rose-50 text-rose-600",
            Icon: ShieldAlert,
          }
        : {
            icon: "bg-slate-100 text-slate-600",
            Icon: Info,
          };
  const Icon = styles.Icon;

  return (
    <section
      aria-labelledby="past-grantee-status-heading"
      className="rounded-2xl border border-slate-200/80 bg-white p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${styles.icon}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              SCHOLARSHIP EXIT RECORD
            </p>
            <h2 id="past-grantee-status-heading" className="text-sm font-semibold text-slate-900">
              {summary.outcome}
            </h2>
          </div>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100/80 px-3 py-1 text-xs font-medium text-slate-600">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          Effective{" "}
          {summary.date
            ? new Intl.DateTimeFormat("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }).format(summary.date)
            : "date not recorded"}
        </span>
      </div>
      <div className="mt-4 rounded-xl bg-slate-50/85 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          RECORDED REMARKS &amp; REASON
        </p>
        <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-slate-700">
          {summary.remarks}
        </p>
      </div>
    </section>
  );
}

export default async function SkeapHistoryReceipt({ applicationId }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const next = applicationId
      ? `/applications/${applicationId}/history`
      : "/programs/skeap/history";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }

  const profile = await ensureProfile(user);
  if (!profile) redirect("/login");

  const inquiry = await prisma.inquiry.findFirst({
    where: {
      ...(applicationId ? { id: applicationId } : {}),
      userId: profile.id,
      subject: { contains: "SKEAP application", mode: "insensitive" },
      applicationId: { not: null },
      reviewStatus: { equals: "Approved", mode: "insensitive" },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      respondedAt: true,
      reviewStatus: true,
      application: {
        select: {
          applicantName: true,
          school: true,
          educationLevel: true,
          currentCourse: true,
          yearLevel: true,
          enrollmentFileUrl: true,
          reportCardFileUrl: true,
          uploadedFiles: true,
        },
      },
      user: {
        select: {
          grantee: {
            select: {
              status: true,
              graduatedAt: true,
              dateRemoved: true,
              revocationReason: true,
              revocationNotes: true,
              remarks: true,
              graduationRemarks: true,
              submissions: {
                where: { status: "REMOVED" },
                orderBy: [{ reviewedAt: "desc" }, { submittedAt: "desc" }],
                take: 1,
                select: { reviewNotes: true },
              },
            },
          },
          profilingRegistrations: {
            where: {
              program: "KK",
              reviewStatus: "Archived",
              archivedAt: { not: null },
              archivedReason: {
                in: [KK_MEMBER_AGE_OUT_REASON, "AGED_OUT_31", "Aged Out (31+)", "Aged Out (Turned 31)"],
              },
            },
            orderBy: { archivedAt: "desc" },
            take: 1,
            select: {
              archivedAt: true,
              archivedReason: true,
              reviewNotes: true,
            },
          },
        },
      },
    },
  });

  if (!inquiry?.application) notFound();

  const semester = getCurrentAcademicSemester(inquiry.createdAt);
  const uploadedGroups = getUploadGroups(inquiry.application.uploadedFiles);
  const enrollmentUpload = uploadedGroups.find(
    (upload) => upload.key === SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
  );
  const gradesUpload = uploadedGroups.find(
    (upload) => upload.key === SKEAP_UPLOAD_KEY.GRADE_REPORT,
  );
  const documents = [
    {
      label: "Certificate of Enrollment",
      url: enrollmentUpload?.url || inquiry.application.enrollmentFileUrl,
      name: enrollmentUpload?.name,
    },
    {
      label: "Grade Slips",
      url: gradesUpload?.url || inquiry.application.reportCardFileUrl,
      name: gradesUpload?.name,
    },
  ].filter((document): document is { label: string; url: string; name: string | undefined } => Boolean(document.url));

  const currentCourse = inquiry.application.currentCourse?.trim() || null;
  const formattedCourse =
    currentCourse && /^[a-z0-9-]{2,8}$/i.test(currentCourse)
      ? currentCourse.toUpperCase()
      : currentCourse;
  const pastGranteeSummary = getPastGranteeSummary(
    inquiry.user.grantee,
    inquiry.user.profilingRegistrations[0] ?? null,
  );
  const HeroStatusIcon =
    pastGranteeSummary.kind === "graduated"
      ? CheckCircle2
      : pastGranteeSummary.kind === "revoked"
        ? AlertCircle
        : Info;
  const heroStatusStyles =
    pastGranteeSummary.kind === "graduated"
      ? "border-emerald-300/40 bg-emerald-500/25 text-emerald-100"
      : pastGranteeSummary.kind === "revoked"
        ? "border-rose-300/40 bg-rose-500/25 text-rose-100"
        : "border-sky-300/40 bg-sky-500/25 text-sky-100";

  return (
    <main className="min-h-screen bg-[#F3F7FB] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/applications"
          className="mb-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Applications
        </Link>

        <section className="w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <header className="bg-gradient-to-br from-[#082438] via-[#0d3550] to-[#0f4c64] px-6 py-6 text-white sm:px-7">
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  SKEAP APPLICATION HISTORY
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                  Historical Application Receipt
                </h1>
                <p className="mt-2 text-sm text-sky-100/75">
                  Read-only verified record of the application approved for this grant period.
                </p>
              </div>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold ${heroStatusStyles}`}>
                <HeroStatusIcon className="h-4 w-4" aria-hidden="true" />
                Past Grantee · {pastGranteeSummary.pillLabel}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <ReceiptStat label="Academic year" value={semester.slice(0, 9)} />
              <ReceiptStat label="Semester" value={semester.replace(/^\d{4}-\d{4}\s*/, "")} />
              <ReceiptStat label="Date approved" value={formatDate(inquiry.respondedAt)} />
            </div>
          </header>

          <div className="space-y-7 p-5 sm:p-7">
            <PastGranteeSummary summary={pastGranteeSummary} />

            <section aria-labelledby="historical-details-heading">
              <div className="mb-4">
                <h2 id="historical-details-heading" className="text-lg font-semibold text-slate-950">
                  Application Details
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Details are shown as recorded on the submitted application.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-x-8 gap-y-4 rounded-2xl border border-slate-200/80 bg-slate-50/40 p-5 sm:grid-cols-2">
                <ReceiptDetail icon={User} label="Applicant name" value={inquiry.application.applicantName} />
                <ReceiptDetail icon={Building2} label="School name" value={inquiry.application.school} />
                <ReceiptDetail icon={GraduationCap} label="Education level" value={inquiry.application.educationLevel} />
                <ReceiptDetail icon={GraduationCap} label="Course / degree" value={formattedCourse} />
                <ReceiptDetail icon={Award} label="Year level" value={inquiry.application.yearLevel} />
                <ReceiptDetail icon={ShieldCheck} label="Scholarship outcome" value={pastGranteeSummary.outcome} />
              </div>
            </section>

            <section aria-labelledby="historical-documents-heading" className="border-t border-slate-200 pt-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 id="historical-documents-heading" className="text-lg font-semibold text-slate-950">
                    Historical Documents
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Files retained from the approved application. These records cannot be changed here.
                  </p>
                </div>
                <span className="text-xs font-semibold text-slate-500">
                  {documents.length} {documents.length === 1 ? "file" : "files"}
                </span>
              </div>
              <SkeapHistoryDocuments documents={documents} />
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
