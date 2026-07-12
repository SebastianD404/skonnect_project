"use client";

import { Download, X } from "lucide-react";
import { getAdditionalUploadGroups, getCoreUploadGroups, getPhotoUploadGroup, SkeapUploadGroup } from "@/lib/skeap-upload";

type ApplicationFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  downloadHref?: string;
  application?: {
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
  };
};

const FIELD_PAIRS: Array<[string, string]> = [
  ["Applicant name", "applicantName"],
  ["Email address", "emailAddress"],
  ["Contact number", "contactNumber"],
  ["Permanent address", "permanentAddress"],
  ["Date of birth", "dateOfBirth"],
  ["Age", "age"],
  ["Place of birth", "placeOfBirth"],
  ["Civil status", "civilStatus"],
  ["Gender", "gender"],
  ["Father's name", "fathersName"],
  ["Father's occupation", "fathersOccupation"],
  ["Father's contact", "fathersContact"],
  ["Mother's maiden name", "mothersMaidenName"],
  ["Mother's occupation", "mothersOccupation"],
  ["Mother's contact", "mothersContact"],
  ["Course", "currentCourse"],
  ["Year level", "yearLevel"],
  ["GWA", "gwa"],
];

export default function SkeapApplicationFormModal({ isOpen, onClose, downloadHref, application }: ApplicationFormModalProps) {
  if (!isOpen) return null;

  function computeAverageFromGrades(rows: Array<{ subject?: string; grade?: string | number }> | undefined) {
    if (!Array.isArray(rows) || rows.length === 0) return null;
    const vals = rows
      .map((r) => Number(r?.grade))
      .filter((n) => !Number.isNaN(n) && n >= 0 && n <= 100);
    if (vals.length === 0) return null;
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    return Number(avg.toFixed(2));
  }

  const coreUploads = getCoreUploadGroups(application?.uploadedFiles);
  const photoUpload = getPhotoUploadGroup(application?.uploadedFiles);

  const additionalUploads = getAdditionalUploadGroups(application?.uploadedFiles);
  const voterUpload = additionalUploads.find((upload) => upload.key === "voterCertificate");
  const photoUploadLabel = photoUpload ? photoUpload.label : "2x2 Photo (ID)";

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/50 px-4 py-6">
      <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Application Form</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-950">Full application overview</h2>
          </div>
          <div className="flex items-center gap-2">
            {downloadHref ? (
              <a
                href={downloadHref}
                target="_blank"
                rel="noreferrer noopener"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                title="Download compiled application form"
                aria-label="Download compiled application form"
              >
                <Download className="h-5 w-5" />
              </a>
            ) : null}
            <button onClick={onClose} className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-8rem)] overflow-y-auto px-6 py-6 lg:grid lg:grid-cols-[0.95fr_0.5fr] gap-6">
          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                {FIELD_PAIRS.map(([label, key]) => {
                  const value = application?.[key as keyof typeof application];
                  if (value === undefined || value === null || String(value).trim() === "") return null;
                  return (
                    <div key={key} className="rounded-3xl bg-white p-4 shadow-sm">
                      <p className="text-xs uppercase tracking-[0.32em] text-slate-500">{label}</p>
                      <p className="mt-2 text-sm text-slate-900">{String(value)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Grades & GWA */}
            {Array.isArray((application as any)?.grades) && (application as any).grades.length > 0 ? (
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Grades</p>
                    <p className="mt-1 text-sm text-slate-600">Subjects and manually entered grades</p>
                  </div>
                  <div className="text-sm font-semibold text-slate-700">
                    GWA: {application?.gwa ?? computeAverageFromGrades((application as any).grades) ?? "—"}
                  </div>
                </div>

                <div className="mt-4 grid gap-2">
                  {(application as any).grades.map((row: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between rounded-3xl border border-slate-100 p-3">
                      <div className="text-sm text-slate-900">{row?.subject ?? "—"}</div>
                      <div className="text-sm font-semibold text-slate-900">{row?.grade ?? "—"}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Course timeline */}
            {(application as any)?.timeline ? (
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Application timeline</p>
                <p className="mt-1 text-sm text-slate-600">Course progress timeline submitted by the applicant.</p>
                <div className="mt-4 grid gap-3">
                  {(() => {
                    const tl = (application as any).timeline as { years?: number; semestersPerYear?: number[]; labels?: string[] };
                    const labels = Array.isArray(tl?.labels) ? tl.labels : Array.from({ length: tl?.years || 0 }).map((_, i) => `Year ${i + 1}`);
                    const sems = Array.isArray(tl?.semestersPerYear) ? tl.semestersPerYear : Array.from({ length: tl?.years || 0 }).map(() => 2);
                    return labels.map((label: string, i: number) => (
                      <div key={i} className="flex items-center justify-between rounded-3xl border border-slate-100 p-3">
                        <div className="text-sm text-slate-900">{label}</div>
                        <div className="text-sm font-semibold text-slate-900">{sems[i] ?? "—"} semesters</div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            ) : null}

            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Required uploads</p>
                  <p className="mt-1 text-sm text-slate-600">These are the core documents included in the compiled application.</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {coreUploads.filter((upload) => upload.url).length} of {coreUploads.length} uploaded
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {coreUploads.length > 0 ? (
                  coreUploads.map((upload) => (
                    <div key={upload.key} className="rounded-3xl border border-slate-100 p-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{upload.label}</p>
                          {upload.name ? <p className="mt-1 text-xs text-slate-500">{upload.name}</p> : null}
                        </div>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{upload.type}</span>
                      </div>
                      {upload.url ? (
                        <a href={upload.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center text-sm font-semibold text-slate-900 underline">
                          View document
                        </a>
                      ) : (
                        <span className="mt-3 inline-flex items-center rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">
                          Missing
                        </span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No core application documents have been attached.
                  </div>
                )}
              </div>
            </div>

            {voterUpload ? (
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Optional upload</p>
                    <p className="mt-1 text-sm text-slate-600">Additional documents included in the compiled application form.</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">{voterUpload.type}</span>
                </div>
                <div className="mt-4 rounded-3xl border border-slate-100 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{voterUpload.label}</p>
                      {voterUpload.name ? <p className="mt-1 text-xs text-slate-500">{voterUpload.name}</p> : null}
                    </div>
                    <a href={voterUpload.url} target="_blank" rel="noreferrer" className="inline-flex items-center text-sm font-semibold text-slate-900 underline">
                      View document
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-6">
            <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-xs uppercase tracking-[0.32em] text-slate-500">{photoUploadLabel}</p>
              <div className="mt-4 overflow-hidden rounded-[1.75rem] bg-slate-100 p-4">
                <div className="h-72 overflow-hidden rounded-[1.5rem] bg-white">
                  {photoUpload ? (
                    <img src={photoUpload.url} alt="Applicant ID photo" className="h-full w-full object-cover" />
                  ) : application?.photoFileUrl ? (
                    <img src={application.photoFileUrl} alt="Applicant ID photo" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-xs uppercase tracking-[0.3em] text-slate-400">No photo</div>
                  )}
                </div>
              </div>
            </div>

            {!voterUpload && application?.uploadedFiles ? (
              <div className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Additional document</p>
                <p className="mt-2 text-sm text-slate-600">This applicant has additional attachments which may include a voter certificate.</p>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
