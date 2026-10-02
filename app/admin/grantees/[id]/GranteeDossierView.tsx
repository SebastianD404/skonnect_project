"use client";

import type { ReactNode } from "react";
import { ArrowUpRight, Download, FileText, Image as ImageIcon } from "lucide-react";
import { formatPermanentAddress } from "@/lib/grantee-address";
import { getAdditionalUploadGroups, getCoreUploadGroups, getPhotoUploadGroup } from "@/lib/skeap-upload";
import GraduationAction from "./GraduationAction";

export type SerializableSkeapApplicationFormPayload = {
  currentCourse?: string;
  yearLevel?: string;
  gwa?: number | null;
  applicantName?: string;
  permanentAddress?: string;
  dateOfBirth?: string;
  placeOfBirth?: string;
  age?: number;
  civilStatus?: string;
  gender?: string;
  fathersName?: string;
  fathersOccupation?: string;
  fathersContact?: string;
  mothersMaidenName?: string;
  mothersOccupation?: string;
  mothersContact?: string;
  contactNumber?: string;
  emailAddress?: string;
  photoFileUrl?: string;
  uploadedFiles?: unknown;
  grades?: Array<{ subject?: string; grade?: string | number }>;
  timeline?: { years?: number; semestersPerYear?: number[]; labels?: string[] } | null;
};

type DossierGrantee = {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  avatarUrl: string | null;
  permanentAddress: {
    sitio: string | null;
    barangay: string | null;
    municipality: string | null;
    province: string | null;
  };
  school: string;
  yearLevel: string;
  status: string;
  dateEnrolled: string;
  graduatedAt: string | null;
  generalAverage: number | null;
  submissions: Array<{
    id: string;
    semester: string;
    status: string;
    submittedAt: string;
  }>;
};

export default function GranteeDossierView({
  grantee,
  application,
  downloadHref,
}: {
  grantee: DossierGrantee;
  application: SerializableSkeapApplicationFormPayload | null;
  downloadHref?: string;
}) {
  const photoUrl = grantee.avatarUrl || getPhotoUploadGroup(application?.uploadedFiles)?.url || application?.photoFileUrl;

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-5 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm sm:flex-row sm:items-center">
        {photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- User and application profile photos can use external storage URLs.
          <img src={photoUrl} alt={`${grantee.fullName} profile`} className="h-20 w-20 shrink-0 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-slate-100 text-2xl font-semibold text-slate-500">
            {grantee.fullName.trim().charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">GRANTEE PROFILE</p>
          <h1 className="mt-1 break-words text-2xl font-bold tracking-tight text-slate-950">{grantee.fullName}</h1>
          <p className="mt-1 break-words text-sm text-slate-500">{grantee.email}</p>
          <div className="mt-3">
            <StatusBadge status={grantee.status} />
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {downloadHref ? (
            <a
              href={downloadHref}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download application
            </a>
          ) : null}
          {grantee.status === "ACTIVE" || grantee.status === "PROBATIONARY" ? (
            <GraduationAction granteeId={grantee.id} granteeName={grantee.fullName} />
          ) : null}
        </div>
      </header>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <SectionHeading title="Academic & enrollment summary" />
        <dl className="mt-5 grid grid-cols-1 gap-x-6 gap-y-5 md:grid-cols-3">
          <Detail label="School">{grantee.school}</Detail>
          <Detail label="Course">{application?.currentCourse ?? "—"}</Detail>
          <Detail label="Year level">{grantee.yearLevel}</Detail>
          <Detail label="Enrollment date">{formatDate(grantee.dateEnrolled)}</Detail>
          <Detail label="GWA / GPA">
            {grantee.generalAverage !== null ? (
              <span className="tabular-nums">{grantee.generalAverage.toFixed(2)}</span>
            ) : (
              <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-500">
                No records yet
              </span>
            )}
          </Detail>
        </dl>
        {application?.grades?.length ? (
          <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
            {application.grades.map((grade, index) => (
              <li key={`${grade.subject ?? "subject"}-${index}`} className="flex justify-between gap-4 py-3 text-sm">
                <span className="text-slate-700">{grade.subject ?? "—"}</span>
                <span className="font-medium text-slate-900">{grade.grade ?? "—"}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <SectionHeading title="Personal & family background" />
        {!application ? (
          <p className="mt-4 text-sm text-slate-500">No SKEAP application details were found for this grantee.</p>
        ) : (
          <>
            <h3 className="mb-3 mt-5 text-xs font-bold uppercase tracking-wider text-slate-500">Personal details</h3>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
              <Detail label="Gender">{application.gender ?? "—"}</Detail>
              <Detail label="Civil status">{application.civilStatus ?? "—"}</Detail>
              <Detail label="Date of birth">{formatDateOfBirth(application.dateOfBirth) ?? "—"}</Detail>
              <Detail label="Age">{application.age ?? "—"}</Detail>
              <Detail label="Place of birth">{application.placeOfBirth ?? "—"}</Detail>
              <Detail label="Contact number">{grantee.phoneNumber || application.contactNumber || "—"}</Detail>
              <Detail label="Permanent address" className="md:col-span-3">
                {formatPermanentAddress(grantee.permanentAddress)}
              </Detail>
            </dl>
            <div className="my-4 border-t border-slate-100" />
            <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Family background</h3>
            <dl className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
              <Detail label="Father's name">{application.fathersName ?? "—"}</Detail>
              <Detail label="Father's occupation">{application.fathersOccupation ?? "—"}</Detail>
              <Detail label="Father's contact">
                {application.fathersContact?.trim() || <span className="text-slate-400 italic">Not provided</span>}
              </Detail>
              <Detail label="Mother's maiden name">{application.mothersMaidenName ?? "—"}</Detail>
              <Detail label="Mother's occupation">{application.mothersOccupation ?? "—"}</Detail>
              <Detail label="Mother's contact">
                {application.mothersContact?.trim() || <span className="text-slate-400 italic">Not provided</span>}
              </Detail>
            </dl>
          </>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <SectionHeading title="Required uploads & documents" />
        {application ? (
          <DocumentList application={application} />
        ) : (
          <p className="mt-4 text-sm text-slate-500">No application documents are available.</p>
        )}
      </section>

      <section className="w-full rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <SectionHeading title="Recent submissions history" />
          <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">
            <FileText className="h-4 w-4" aria-hidden="true" />
            Latest 5
          </span>
        </div>
        {grantee.submissions.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No submissions found for this grantee.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {grantee.submissions.map((submission) => (
              <li key={submission.id} className="flex flex-col gap-1 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{submission.semester}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{submission.status}</p>
                </div>
                <p className="text-xs text-slate-500">Submitted {formatDate(submission.submittedAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function SectionHeading({ title }: { title: string }) {
  return <h2 className="text-lg font-semibold text-slate-900">{title}</h2>;
}

function Detail({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <dt className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="break-words text-sm font-medium text-slate-900">{children}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes =
    status === "ACTIVE" || status === "PROBATIONARY"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : status === "GRADUATED"
        ? "border-slate-200 bg-slate-100 text-slate-700"
        : "border-rose-200 bg-rose-50 text-rose-700";
  const label = status === "PROBATIONARY"
    ? "Active · Probationary"
    : status.charAt(0) + status.slice(1).toLowerCase();

  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${classes}`}>
      {label}
    </span>
  );
}

function DocumentList({ application }: { application: SerializableSkeapApplicationFormPayload }) {
  const requiredUploads = getCoreUploadGroups(application.uploadedFiles);
  const additionalUploads = getAdditionalUploadGroups(application.uploadedFiles);
  const uploads = [...requiredUploads, ...additionalUploads];

  return uploads.length > 0 ? (
    <ul className="mt-3 divide-y divide-slate-100">
      {uploads.map((upload) => (
        <li key={upload.key} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-900">{upload.label}</p>
            {upload.name ? <p className="mt-1 truncate text-xs text-slate-500">{upload.name}</p> : null}
          </div>
          {upload.url ? (
            <div className="flex shrink-0 items-center gap-4">
              <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                {upload.isImage ? <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                {upload.type}
              </span>
              <a
                href={upload.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-cyan-700 hover:text-cyan-900"
              >
                View
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            </div>
          ) : (
            <span className="shrink-0 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
              Missing
            </span>
          )}
        </li>
      ))}
    </ul>
  ) : (
    <p className="mt-4 text-sm text-slate-500">No application documents have been attached.</p>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC" }).format(new Date(value));
}

function formatDateOfBirth(value?: string) {
  if (!value) return undefined;
  const dateParts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateParts) return value;
  const [, year, month, day] = dateParts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return value;
  }
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}
