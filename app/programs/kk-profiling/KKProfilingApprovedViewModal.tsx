"use client";

import { X, CheckCircle2 } from "lucide-react";

type KKProfilingRegistrationData = {
  id: string;
  fullName: string;
  address: string;
  sex: string;
  age: number;
  birthDate: string;
  email: string;
  facebook: string;
  contactNumber: string;
  civilStatus: string;
  youthClassification: string;
  youthAgeGroup: string;
  workStatus: string;
  educationalBackground: string;
  registeredSKVoter: string;
  votedLastSK: string;
  registeredNationalVoter: string;
  attendedKKAssembly: string;
  assemblyTimes?: string | null;
  noAssemblyReason?: string | null;
  idDocumentType?: string | null;
  idFrontFileUrl?: string | null;
  idBackFileUrl?: string | null;
  idSingleFileUrl?: string | null;
  reviewStatus: string;
  submittedAt?: string | null;
};

type Props = {
  isOpen: boolean;
  registration: KKProfilingRegistrationData;
  onClose: () => void;
  approvalDate?: string;
};

const DisplayField = ({ label, value }: { label: string; value: string | null | undefined }) => {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-[0.35em] text-slate-500">{label}</span>
      <p className="mt-2 text-sm font-medium text-slate-900">{value || "Not provided"}</p>
    </div>
  );
};

export default function KKProfilingApprovedViewModal({ isOpen, registration, onClose, approvalDate }: Props) {
  if (!isOpen) {
    return null;
  }

  const formattedBirthDate = registration.birthDate
    ? new Date(registration.birthDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "Not provided";

  const formattedSubmittedDate = registration.submittedAt
    ? new Date(registration.submittedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "Not provided";

  const formattedApprovalDate = approvalDate
    ? new Date(approvalDate).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : formattedSubmittedDate;

  function openPreviewModal(url: string) {
    // Open in a new tab for simplicity
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        {/* Header with Approval Badge */}
        <div className="border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-emerald-50/50 px-6 py-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-950">
                  {registration.fullName} - KK Profiling Application
                </h2>
                <p className="mt-2 text-sm text-slate-600">
                  Your submitted & approved application. View your complete information below for your records.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
              aria-label="Close form"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Status Badges */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <div className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-4 py-2">
              <div className="h-2 w-2 rounded-full bg-emerald-600"></div>
              <span className="text-sm font-semibold text-emerald-700">Approved</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2">
              <span className="text-sm text-slate-600">
                Approved on <span className="font-semibold text-slate-900">{formattedApprovalDate}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="max-h-[80vh] overflow-y-auto p-6">
          <div className="space-y-8">
            {/* Personal Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-950 mb-4">Personal Information</h3>
              <div className="grid gap-4 sm:grid-cols-3 rounded-2xl bg-slate-50 p-6 border border-slate-200">
                <DisplayField label="Full Name" value={registration.fullName} />
                <DisplayField label="Sex" value={registration.sex} />
                <DisplayField label="Birth Date" value={formattedBirthDate} />
                <DisplayField label="Age" value={String(registration.age)} />
                <DisplayField label="Civil Status" value={registration.civilStatus} />
                <DisplayField label="Address" value={registration.address} />
              </div>
            </div>

            {/* Contact Information Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-950 mb-4">Contact Information</h3>
              <div className="grid gap-4 sm:grid-cols-2 rounded-2xl bg-slate-50 p-6 border border-slate-200">
                <DisplayField label="Email Address" value={registration.email} />
                <DisplayField label="Contact Number" value={registration.contactNumber} />
                <DisplayField label="Facebook Account" value={registration.facebook || "Not provided"} />
              </div>
            </div>

            {/* Classification Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-950 mb-4">Youth Classification</h3>
              <div className="grid gap-4 sm:grid-cols-3 rounded-2xl bg-slate-50 p-6 border border-slate-200">
                <DisplayField label="Youth Classification" value={registration.youthClassification} />
                <DisplayField label="Age Group" value={registration.youthAgeGroup} />
                <DisplayField label="Educational Background" value={registration.educationalBackground} />
              </div>
            </div>

            {/* Work & Employment Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-950 mb-4">Employment & Work Status</h3>
              <div className="grid gap-4 sm:grid-cols-1 rounded-2xl bg-slate-50 p-6 border border-slate-200">
                <DisplayField label="Work Status" value={registration.workStatus} />
              </div>
            </div>

            {/* Civic Participation Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-950 mb-4">Civic & Electoral Participation</h3>
              <div className="grid gap-4 sm:grid-cols-2 rounded-2xl bg-slate-50 p-6 border border-slate-200">
                <DisplayField label="Registered SK Voter?" value={registration.registeredSKVoter} />
                <DisplayField label="Voted Last SK Election?" value={registration.votedLastSK} />
                <DisplayField label="Registered National Voter?" value={registration.registeredNationalVoter} />
                <DisplayField label="Attended KK Assembly?" value={registration.attendedKKAssembly} />
                {registration.attendedKKAssembly === "Yes" && (
                  <DisplayField label="Times Attended" value={registration.assemblyTimes || "Not specified"} />
                )}
                {registration.attendedKKAssembly === "No" && (
                  <DisplayField label="Reason for Not Attending" value={registration.noAssemblyReason || "Not specified"} />
                )}
              </div>
            </div>

            {/* Identification Documents Section */}
            <div>
              <h3 className="text-lg font-semibold text-slate-950 mb-4">Submitted Identification</h3>
              <div className="rounded-2xl bg-slate-50 p-6 border border-slate-200 space-y-4">
                <DisplayField label="Document Type" value={registration.idDocumentType} />

                {registration.idDocumentType === "Valid ID" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {registration.idFrontFileUrl ? (
                      <button
                        type="button"
                        onClick={() => openPreviewModal(registration.idFrontFileUrl || "")}
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        View Front of ID
                      </button>
                    ) : null}
                    {registration.idBackFileUrl ? (
                      <button
                        type="button"
                        onClick={() => openPreviewModal(registration.idBackFileUrl || "")}
                        className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                      >
                        View Back of ID
                      </button>
                    ) : null}
                    {!registration.idFrontFileUrl && !registration.idBackFileUrl ? (
                      <p className="mt-4 text-sm text-slate-600 col-span-2">No ID images found.</p>
                    ) : null}
                  </div>
                ) : registration.idSingleFileUrl ? (
                  <button
                    type="button"
                    onClick={() => openPreviewModal(registration.idSingleFileUrl || "")}
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                  >
                    View Uploaded Document
                  </button>
                ) : (
                  <p className="text-sm text-slate-600">No documents found.</p>
                )}
              </div>
            </div>

            {/* Submission Timeline */}
            <div className="rounded-2xl bg-gradient-to-r from-emerald-50 to-teal-50 p-6 border border-emerald-200">
              <h3 className="text-lg font-semibold text-slate-950 mb-4">Application Timeline</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-4">
                  <div className="h-3 w-3 rounded-full bg-slate-400"></div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Submitted</p>
                    <p className="text-xs text-slate-600">{formattedSubmittedDate}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="h-3 w-3 rounded-full bg-emerald-600"></div>
                  <div>
                    <p className="text-sm font-semibold text-emerald-700">Approved</p>
                    <p className="text-xs text-emerald-600">{formattedApprovalDate}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="rounded-2xl bg-blue-50 border border-blue-200 p-6">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Next Steps</h4>
              <p className="text-sm leading-relaxed text-blue-800">
                Your KK Profiling application has been successfully approved! You are now a registered member of our KK Profiling community. 
                To modify any information in this application, please contact the Barangay Pico staff.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
