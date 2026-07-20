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
  reviewNotes?: string | null;
  submittedAt?: string | null;
};

type Props = {
  isOpen: boolean;
  registration: KKProfilingRegistrationData;
  onClose: () => void;
  approvalDate?: string;
};

export default function KKProfilingApprovedViewModal({ isOpen, registration, onClose, approvalDate }: Props) {
  if (!isOpen) return null;

  const formattedSubmittedDate = registration.submittedAt
    ? new Date(registration.submittedAt).toLocaleString()
    : "Unknown";

  const formattedApprovalDate = approvalDate
    ? new Date(approvalDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : "Recently approved";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative max-h-[90vh] w-full max-w-4xl overflow-auto rounded-[1.75rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Katipunan ng Kabataan (KK) Profiling — Submission</h3>
            <p className="mt-1 text-sm text-slate-500">Submitted on {formattedSubmittedDate}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-500 hover:bg-slate-100">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-4">
          <div className="relative rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
            <div className="min-w-0">
              <strong>Informed Consent</strong>
              <p className="mt-2">This registrant indicated consent when submitting the KK profiling form.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Review status</p>
              <p className="mt-2 text-slate-700">{registration.reviewStatus || "Pending"}</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Review notes</p>
              <p className="mt-2 text-slate-700">{registration.reviewNotes || "No notes have been added."}</p>
            </div>
          </div>

          <form className="grid gap-4 mt-4">
            <h4 className="text-lg font-semibold">PART I: Profile</h4>
            <p className="text-sm text-slate-600">Please ensure the accuracy of your responses by providing truthful and complete information in all required fields.</p>

            <label className="flex flex-col">
              <span className="text-sm font-semibold">Complete Name (Family, First, Middle) *</span>
              <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.fullName}</div>
            </label>

            <label className="flex flex-col">
              <span className="text-sm font-semibold">Complete Address *</span>
              <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.address}</div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex flex-col">
                <span className="text-sm font-semibold">Sex *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.sex}</div>
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Age *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.age}</div>
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Birth Date *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{new Date(registration.birthDate).toLocaleDateString()}</div>
              </label>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-sm font-semibold">Email Address *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.email}</div>
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Facebook Account (Name) *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.facebook}</div>
              </label>
            </div>

            <label className="flex flex-col">
              <span className="text-sm font-semibold">Contact Number *</span>
              <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.contactNumber}</div>
            </label>

            <h4 className="text-lg font-semibold">PART II: Demographic Characteristics</h4>

            <label className="flex flex-col">
              <span className="text-sm font-semibold">Civil Status *</span>
              <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.civilStatus}</div>
            </label>

            <label className="flex flex-col">
              <span className="text-sm font-semibold">Youth Classification *</span>
              <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.youthClassification}</div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-sm font-semibold">Youth age Group *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.youthAgeGroup}</div>
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Work Status *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.workStatus}</div>
              </label>
            </div>

            <label className="flex flex-col">
              <span className="text-sm font-semibold">Educational Background *</span>
              <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.educationalBackground}</div>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="flex flex-col">
                <span className="text-sm font-semibold">Registered SK Voter? *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.registeredSKVoter}</div>
              </label>
              <label className="flex flex-col">
                <span className="text-sm font-semibold">Did you vote last SK election? *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.votedLastSK}</div>
              </label>
              <label className="flex flex-col">
                <span className="text-sm font-semibold">Registered National Voter? *</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.registeredNationalVoter}</div>
              </label>
            </div>

            <label className="flex flex-col">
              <span className="text-sm font-semibold">Have you already attended a KK Assembly? *</span>
              <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.attendedKKAssembly}</div>
            </label>

            {registration.attendedKKAssembly === "Yes" && (
              <label className="flex flex-col">
                <span className="text-sm font-semibold">If Yes, How many times</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.assemblyTimes || "N/A"}</div>
              </label>
            )}

            {registration.attendedKKAssembly === "No" && (
              <label className="flex flex-col">
                <span className="text-sm font-semibold">If No, Why?</span>
                <div className="mt-1 rounded-lg border px-3 py-2 bg-white text-sm text-slate-700">{registration.noAssemblyReason || "N/A"}</div>
              </label>
            )}

            <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm font-semibold text-slate-900">Uploaded identification</p>
              <p className="mt-2 text-sm text-slate-600">{registration.idDocumentType || "Not uploaded"}</p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {registration.idFrontFileUrl ? (
                  <a
                    href={registration.idFrontFileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    View front of ID
                  </a>
                ) : null}
                {registration.idBackFileUrl ? (
                  <a
                    href={registration.idBackFileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    View back of ID
                  </a>
                ) : null}
                {registration.idSingleFileUrl ? (
                  <a
                    href={registration.idSingleFileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    View Certificate of Residency
                  </a>
                ) : null}
                {!registration.idFrontFileUrl && !registration.idBackFileUrl && !registration.idSingleFileUrl ? (
                  <p className="mt-4 text-sm text-slate-600">No uploaded ID documents were stored for this registration.</p>
                ) : null}
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button onClick={onClose} className="inline-flex justify-center rounded-lg bg-[#0F3D5C] px-6 py-3 text-sm font-semibold text-white hover:bg-[#0D2E47]">Close</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
