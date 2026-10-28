import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowUpRight, FileText } from "lucide-react";
import { ensureProfile } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getCurrentAcademicSemester } from "@/lib/semester-progress";
import {
  getUploadGroups,
  SKEAP_UPLOAD_KEY,
} from "@/lib/skeap-upload";

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

function getFileTypeLabel(url: string) {
  const extension = url.split("?")[0]?.split(".").pop()?.toLowerCase();
  if (extension === "pdf") return "PDF";
  if (["jpg", "jpeg", "png", "webp", "gif", "avif"].includes(extension ?? "")) {
    return "Image";
  }
  if (["doc", "docx"].includes(extension ?? "")) return "Document";
  return "File";
}

function ReceiptField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1.5 break-words text-sm font-medium text-slate-900">{value?.trim() || "Not provided"}</p>
    </div>
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
          gwa: true,
          enrollmentFileUrl: true,
          reportCardFileUrl: true,
          uploadedFiles: true,
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
  ];

  return (
    <main className="min-h-screen bg-[#F3F7FB] px-4 py-10 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/applications"
          className="mb-5 inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to Applications
        </Link>

        <section className="w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
          <header className="border-b border-slate-200 pb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-800">
              SKEAP application history
            </p>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">
                  Historical Application Receipt
                </h1>
                <p className="mt-2 text-sm text-slate-600">
                  Read-only record of the application approved for this grant period.
                </p>
              </div>
              <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700">
                Past Grantee
              </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ReceiptField label="Academic year" value={semester.slice(0, 9)} />
              <ReceiptField label="Semester" value={semester.replace(/^\d{4}-\d{4}\s*/, "")} />
              <ReceiptField label="Date approved" value={formatDate(inquiry.respondedAt)} />
            </div>
          </header>

          <section aria-labelledby="historical-details-heading" className="py-6">
            <h2 id="historical-details-heading" className="text-lg font-semibold text-slate-950">
              Application details
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Details are shown as recorded on the submitted application.
            </p>
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <ReceiptField label="Applicant name" value={inquiry.application.applicantName} />
              <ReceiptField label="School name" value={inquiry.application.school} />
              <ReceiptField label="Education level" value={inquiry.application.educationLevel} />
              <ReceiptField label="Course / degree" value={inquiry.application.currentCourse} />
              <ReceiptField label="Year level" value={inquiry.application.yearLevel} />
              <ReceiptField
                label="General weighted average"
                value={inquiry.application.gwa?.toString()}
              />
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
                {documents.filter((document) => Boolean(document.url)).length} files
              </span>
            </div>

            <div className="mt-4 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
              {documents.map((document, index) => {
                if (!document.url) return null;
                const fileType = getFileTypeLabel(document.url);
                const isImage = fileType === "Image";

                return (
                  <div
                    key={document.label}
                    className="flex flex-col gap-4 bg-white p-4 transition-colors hover:bg-slate-50/70 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="relative ml-1 flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                        {isImage ? (
                          // Historical document previews are remote uploaded files.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={document.url}
                            alt={`${document.label} thumbnail`}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <FileText className="h-5 w-5 text-slate-500" aria-hidden="true" />
                        )}
                        <span className="absolute -left-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-[10px] font-bold text-white ring-2 ring-white">
                          {index + 1}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-slate-900">{document.label}</h3>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          {document.name ? (
                            <span className="max-w-64 truncate text-xs text-slate-500">
                              {document.name}
                            </span>
                          ) : null}
                          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                            {fileType}
                          </span>
                        </div>
                      </div>
                    </div>
                    <a
                      href={document.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      View file <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                    </a>
                  </div>
                );
              })}
              {!documents.some((document) => Boolean(document.url)) ? (
                <p className="bg-slate-50 p-4 text-sm text-slate-600">
                  No historical enrollment or grade documents are available for this application.
                </p>
              ) : null}
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
