"use client";

import { ArrowUpRight, Download, Image as ImageIcon, X } from "lucide-react";
import { getAdditionalUploadGroups, getCoreUploadGroups, getPhotoUploadGroup } from "@/lib/skeap-upload";
import { formatSkeapPermanentAddress } from "@/lib/grantee-address";

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

function formatDateOfBirth(value: string) {
  const dateParts = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateParts) return value;

  const [, year, month, day] = dateParts;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
}

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
  const photoUrl = photoUpload?.url || application?.photoFileUrl;

  const renderDataSection = (
    title: string,
    fields: Array<[string, unknown, string?]>,
    isFirst = false,
    gridClassName = "grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3",
  ) => {
    const populatedFields = fields.filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "");
    if (populatedFields.length === 0) return null;

    return (
      <section>
        <h3 className={`text-base font-semibold text-slate-900 tracking-tight ${isFirst ? "mt-0 mb-2" : "mt-3 mb-2"}`}>{title}</h3>
        <dl className={gridClassName}>
          {populatedFields.map(([label, value, className]) => (
            <div key={label} className={`min-w-0 ${className ?? ""}`}>
              <dt className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label}</dt>
              <dd className="break-words text-sm font-medium text-slate-900">{String(value)}</dd>
            </div>
          ))}
        </dl>
      </section>
    );
  };

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

        <div className="max-h-[calc(100vh-8rem)] space-y-6 overflow-y-auto bg-slate-50 px-6 py-6">
          <div className="flex flex-col items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:gap-4">
            {photoUrl ? (
              <img src={photoUrl} alt="Applicant ID photo" className="h-24 w-24 shrink-0 rounded-full object-cover shadow-sm" />
            ) : (
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-slate-200 text-xs text-slate-500">No photo</div>
            )}
            <div className="min-w-0 space-y-1">
              <h3 className="text-xl font-semibold text-slate-950">{application?.applicantName || "Applicant"}</h3>
              {application?.emailAddress ? <p className="break-words text-sm text-slate-600">{application.emailAddress}</p> : null}
              {application?.contactNumber ? <p className="text-sm text-slate-600">{application.contactNumber}</p> : null}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            {application ? (
              <>
                {renderDataSection("Personal Details", [
                  ["Gender", application.gender],
                  ["Civil status", application.civilStatus],
                  ["Place of birth", application.placeOfBirth],
                  ["Permanent address", formatSkeapPermanentAddress({}, application.permanentAddress)],
                  ["Age", application.age],
                  ["Date of birth", application.dateOfBirth ? formatDateOfBirth(application.dateOfBirth) : null],
                ], true, "grid grid-cols-1 gap-x-6 gap-y-2 md:grid-cols-3")}
                <hr className="my-3 border-slate-200" />
                {renderDataSection("Family Background", [
                  ["Father's name", application.fathersName],
                  ["Father's occupation", application.fathersOccupation],
                  ["Father's contact", application.fathersContact],
                  ["Mother's maiden name", application.mothersMaidenName],
                  ["Mother's occupation", application.mothersOccupation],
                  ["Mother's contact", application.mothersContact],
                ])}
                <hr className="my-3 border-slate-200" />
                {renderDataSection("Education", [
                  ["Course", application.currentCourse],
                  ["Year level", application.yearLevel],
                  ["GWA", application.gwa],
                ])}
              </>
            ) : null}
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
                    <div key={upload.key} className="flex flex-col gap-3 rounded-lg border border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">{upload.label}</p>
                          {upload.name ? <p className="mt-1 truncate text-xs text-slate-500">{upload.name}</p> : null}
                      </div>
                      {upload.url ? (
                        <div className="flex shrink-0 items-center gap-4">
                          <span className={`rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold tracking-wide text-slate-600 ${upload.isImage ? "inline-flex items-center gap-1.5" : ""}`}>
                            {upload.isImage ? <ImageIcon className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                            {upload.type.toUpperCase()}
                          </span>
                          <a
                            href={upload.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 text-sm font-medium text-cyan-500 transition-colors hover:text-cyan-600"
                          >
                            View
                            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </a>
                        </div>
                      ) : (
                        <span className="shrink-0 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Missing</span>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    No core application documents have been attached.
                  </div>
                )}
              </div>
              {!voterUpload && application?.uploadedFiles ? (
                <div className="mt-4 border-t border-dashed border-slate-200 pt-4">
                  <p className="text-xs uppercase tracking-[0.32em] text-slate-500">Additional document</p>
                  <p className="mt-2 text-sm text-slate-600">This applicant has additional attachments which may include a voter certificate.</p>
                </div>
              ) : null}
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
      </div>
    </div>
  );
}
