"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { ArrowUpRight, FileText, X } from "lucide-react";
import SkeapApplicationFormModal from "@/components/SkeapApplicationFormModal";
import { getAdditionalUploadGroups, getCoreUploadGroups, getPhotoUploadGroup } from "@/lib/skeap-upload";

export type RevokedGranteeRecord = {
  id: string;
  fullName: string;
  email: string | null;
  phoneNumber: string | null;
  sitio: string | null;
  revokedAt: string;
  reason: string | null;
  additionalNotes: string | null;
  isPermanentlyBarred: boolean;
  revocationProofPath?: string | null;
  revocationProofType?: string | null;
  revocationProofFileName?: string | null;
  revocationProofHash?: string | null;
  revokedBy: { fullName: string; email: string } | null;
  school: string;
  yearLevel: string;
  kkProfile: {
    fullName: string;
    email: string;
    contactNumber: string;
    purok: string;
    barangay: string;
    addressLine: string;
  } | null;
  application: {
    id: string;
    currentCourse: string;
    yearLevel: string;
    gwa: number | null;
    applicantName: string | null;
    permanentAddress: string | null;
    dateOfBirth?: string;
    placeOfBirth: string | null;
    age: number | null;
    civilStatus: string | null;
    gender: string | null;
    fathersName: string | null;
    fathersOccupation: string | null;
    fathersContact: string | null;
    mothersMaidenName: string | null;
    mothersOccupation: string | null;
    mothersContact: string | null;
    contactNumber: string | null;
    emailAddress: string | null;
    photoFileUrl: string | null;
    uploadedFiles: unknown;
    grades?: Array<{ subject?: string; grade?: string | number }>;
    timeline?: { years?: number; semestersPerYear?: number[]; labels?: string[] } | null;
  } | null;
  submissions: Array<{
    id: string;
    semester: string;
    status: string;
    submittedAt: string;
    gradeFileUrl: string;
    coeFileUrl: string;
  }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "long", timeZone: "UTC" }).format(new Date(value));
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-slate-800">{children || "—"}</dd>
    </div>
  );
}

export default function RevokedScholarInspectionModal({
  record,
  onClose,
  onViewProof,
}: {
  record: RevokedGranteeRecord | null;
  onClose: () => void;
  onViewProof: (granteeId: string) => void;
}) {
  const [activeTab, setActiveTab] = useState<"audit" | "documents" | "form">("audit");
  if (!record) return null;

  const coreUploads = getCoreUploadGroups(record.application?.uploadedFiles);
  const additionalUploads = getAdditionalUploadGroups(record.application?.uploadedFiles);
  const photoUpload = getPhotoUploadGroup(record.application?.uploadedFiles);
  const application = record.application;
  const applicationUploads = [...coreUploads, ...(photoUpload ? [photoUpload] : []), ...additionalUploads]
    .filter((upload) => upload.url);

  return (
    <>
      <div className="fixed inset-0 z-40 overflow-y-auto bg-slate-950/50 p-3 sm:p-6">
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="revoked-record-title"
          className="mx-auto my-4 w-full max-w-4xl overflow-hidden rounded-2xl bg-white shadow-2xl"
        >
          <header className="flex items-start justify-between gap-4 border-b border-slate-100 px-5 py-4 sm:px-7">
            <div className="min-w-0">
              <span className="inline-flex rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-rose-700">
                Revoked
              </span>
              <h2 id="revoked-record-title" className="mt-2 text-xl font-bold text-slate-900">
                {record.fullName}
              </h2>
              <p className="mt-1 text-sm text-slate-500">Read-only scholar record</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close scholar record" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </header>

          <nav role="tablist" aria-label="Revoked scholar dossier sections" className="border-b border-slate-200 px-4 sm:px-7">
            <div className="flex gap-5">
              {([
                ["audit", "Revocation Audit"],
                ["documents", "Submitted Documents"],
                ["form", "Application Form"],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  id={`revoked-dossier-tab-${tab}`}
                  aria-controls={`revoked-dossier-panel-${tab}`}
                  aria-selected={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className={`border-b-2 px-1 py-3 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? "border-slate-900 text-slate-900"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </nav>

          <div
            role="tabpanel"
            id={`revoked-dossier-panel-${activeTab}`}
            aria-labelledby={`revoked-dossier-tab-${activeTab}`}
            className="max-h-[calc(100vh-14rem)] overflow-y-auto bg-slate-50 p-4 sm:p-6"
          >
            {activeTab === "audit" ? (
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <h3 className="text-sm font-bold text-slate-900">Revocation audit</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                    <Detail label="Date revoked">{formatDate(record.revokedAt)}</Detail>
                    <Detail label="Reapplication eligibility">
                      <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${
                        record.isPermanentlyBarred
                          ? "bg-rose-50 text-rose-700 ring-rose-600/20"
                          : "bg-slate-100 text-slate-700 ring-slate-300/60"
                      }`}>
                        {record.isPermanentlyBarred ? "Permanently Barred" : "Eligible to Reapply"}
                      </span>
                    </Detail>
                    <Detail label="Primary reason">{record.reason}</Detail>
                    <Detail label="Revoking official">
                      {record.revokedBy ? `${record.revokedBy.fullName} · ${record.revokedBy.email}` : "Not recorded"}
                    </Detail>
                  </dl>
                  <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Internal admin notes</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                      {record.additionalNotes || "No additional notes recorded."}
                    </p>
                  </div>
                </section>
                {record.revocationProofPath ? (
                  <section className="rounded-xl border border-teal-200 bg-white p-4 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <h3 className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                          Supporting Proof Document
                        </h3>
                        <span className="mt-2 inline-flex max-w-full truncate rounded-full border border-teal-200 bg-teal-50/80 px-2.5 py-1 text-xs font-medium text-teal-700">
                          {record.revocationProofType || "Supporting Proof"}
                        </span>
                        <p className="mt-1 truncate text-sm font-medium text-slate-800">
                          {record.revocationProofFileName || "Supporting proof document"}
                        </p>
                      </div>
                      {record.revocationProofHash ? (
                        <span
                          title={record.revocationProofHash}
                          className="inline-flex w-fit shrink-0 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-mono text-[11px] text-slate-600"
                        >
                          SHA-256 · {record.revocationProofHash.slice(0, 12)}…
                        </span>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onViewProof(record.id)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-3 py-2 text-xs font-medium text-teal-700 transition-colors hover:bg-teal-100"
                    >
                      <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                      View Document
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </section>
                ) : null}
                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <h3 className="text-sm font-bold text-slate-900">Scholar & academic profile</h3>
                  <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <Detail label="School / institution">{record.school}</Detail>
                    <Detail label="Course">{application?.currentCourse}</Detail>
                    <Detail label="Year level">{record.yearLevel}</Detail>
                    <Detail label="Sitio">{record.kkProfile?.purok ?? record.sitio}</Detail>
                    <Detail label="Contact">{record.kkProfile?.contactNumber ?? record.phoneNumber ?? application?.contactNumber}</Detail>
                    <Detail label="Email">{record.kkProfile?.email ?? record.email}</Detail>
                    <Detail label="Address">{record.kkProfile?.addressLine ?? application?.permanentAddress}</Detail>
                  </dl>
                </section>
              </div>
            ) : null}

            {activeTab === "documents" ? (
              <div className="space-y-5">
                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <h3 className="text-sm font-bold text-slate-900">Application uploads</h3>
                  {applicationUploads.length ? (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {applicationUploads.map((upload) => (
                        <li key={upload.key} className="flex items-center justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-slate-800">{upload.label}</p>
                            <p className="truncate text-xs text-slate-500">{upload.name || "Uploaded document"}</p>
                          </div>
                          <a href={upload.url} target="_blank" rel="noreferrer noopener" className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-cyan-700 hover:text-cyan-900">
                            Preview <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No application uploads were found.</p>
                  )}
                </section>
                <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
                  <h3 className="text-sm font-bold text-slate-900">Semester compliance files</h3>
                  {record.submissions.length ? (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {record.submissions.map((submission) => (
                        <li key={submission.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-slate-800">{submission.semester}</p>
                            <p className="text-xs text-slate-500">{submission.status} · submitted {formatDate(submission.submittedAt)}</p>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            {submission.coeFileUrl ? (
                              <a href={`/api/submissions/${encodeURIComponent(submission.id)}/file?kind=coe`} target="_blank" rel="noreferrer noopener" className="text-xs font-semibold text-cyan-700 hover:text-cyan-900">
                                Preview enrollment certificate
                              </a>
                            ) : null}
                            {submission.gradeFileUrl ? (
                              <a href={`/api/submissions/${encodeURIComponent(submission.id)}/file?kind=grade`} target="_blank" rel="noreferrer noopener" className="text-xs font-semibold text-cyan-700 hover:text-cyan-900">
                                Preview grade report
                              </a>
                            ) : null}
                            {!submission.coeFileUrl && !submission.gradeFileUrl ? <span className="text-xs text-slate-400">No files attached</span> : null}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">No semester submissions were found.</p>
                  )}
                </section>
              </div>
            ) : null}

            {activeTab === "form" ? (
              application ? (
                <SkeapApplicationFormModal
                  isOpen
                  embedded
                  onClose={onClose}
                  downloadHref={`/api/admin/skeap-applications/${encodeURIComponent(application.id)}/download`}
                  statusBadge="Revoked"
                  application={{
                    currentCourse: application.currentCourse,
                    yearLevel: application.yearLevel,
                    gwa: application.gwa,
                    applicantName: application.applicantName ?? record.fullName,
                    permanentAddress: application.permanentAddress ?? undefined,
                    dateOfBirth: application.dateOfBirth,
                    placeOfBirth: application.placeOfBirth ?? undefined,
                    age: application.age ?? undefined,
                    civilStatus: application.civilStatus ?? undefined,
                    gender: application.gender ?? undefined,
                    fathersName: application.fathersName ?? undefined,
                    fathersOccupation: application.fathersOccupation ?? undefined,
                    fathersContact: application.fathersContact ?? undefined,
                    mothersMaidenName: application.mothersMaidenName ?? undefined,
                    mothersOccupation: application.mothersOccupation ?? undefined,
                    mothersContact: application.mothersContact ?? undefined,
                    contactNumber: application.contactNumber ?? record.phoneNumber ?? undefined,
                    emailAddress: application.emailAddress ?? record.email ?? undefined,
                    photoFileUrl: application.photoFileUrl ?? undefined,
                    uploadedFiles: application.uploadedFiles,
                    grades: application.grades,
                    timeline: application.timeline,
                  }}
                />
              ) : (
                <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
                  <FileText className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
                  <p className="mt-3 text-sm font-medium text-slate-800">Application form unavailable</p>
                  <p className="mt-1 text-xs text-slate-500">No SKEAP application record was found for this scholar.</p>
                </div>
              )
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
