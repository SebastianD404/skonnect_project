"use client";

import { ExternalLink, Pencil, X } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { KKProfilingRegistration } from "./types";

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
      <span className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5 text-base font-medium text-slate-900">
        {value || "N/A"}
      </span>
    </div>
  );
}

function PrintableDocumentCard({
  title,
  subtitle,
  url,
  fullWidth = false,
}: {
  title: string;
  subtitle: string;
  url: string;
  fullWidth?: boolean;
}) {
  return (
    <div className={fullWidth ? "col-span-1 md:col-span-2" : "col-span-1"}>
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex min-w-0 items-center gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100">
            <img src={url} alt={`${title} thumbnail`} className="h-full w-full object-cover" />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="text-sm font-bold text-slate-900">{title}</span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{subtitle}</span>
          </div>
        </div>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-800"
        >
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          <span>View file</span>
        </a>
      </div>
    </div>
  );
}

export function AdminKKProfilingFormView({
  registration,
  onClose,
  onEdit,
  onReturn,
  onStatusUpdate,
}: {
  registration: KKProfilingRegistration;
  onClose: () => void;
  onEdit?: () => void;
  onReturn?: (updatedRegistration: KKProfilingRegistration) => void;
  onStatusUpdate?: (status: "Approved" | "Returned") => void;
}) {
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const router = useRouter();
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);

  const isApproved = registration.reviewStatus === "Approved";
  const isLocked = ["approved", "rejected"].includes((registration.reviewStatus || "").toLowerCase());
  const canReturn = !isLocked;

  const resetCorrectionFlow = () => {
    setCorrectionNotes("");
    setIsCorrectionOpen(false);
    setReturnError(null);
  };

  const handleClose = () => {
    resetCorrectionFlow();
    onClose();
  };

  const handleApprove = async () => {
    setApproveError(null);
    setApproveSuccess(null);
    setIsApproving(true);

    try {
      const response = await fetch(`/api/admin/kk-profiling/${registration.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewStatus: "Approved",
          reviewNotes: "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to approve registration.");
      }

      setApproveSuccess("This registration was approved successfully. The applicant can now apply for SKEAP and register for events.");
      if (onReturn) {
        onReturn(data as KKProfilingRegistration);
      }
      onClose();
      onStatusUpdate?.("Approved");
      router.refresh();
    } catch (error) {
      setApproveError(error instanceof Error ? error.message : "Failed to approve registration.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReturn = async () => {
    const notes = correctionNotes.trim();
    setReturnError(null);
    setReturnSuccess(null);

    if (!notes) {
      setReturnError("Please enter a note explaining what the applicant needs to correct.");
      return;
    }

    setIsReturning(true);

    try {
      const response = await fetch(`/api/admin/kk-profiling/${registration.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewStatus: "Returned",
          reviewNotes: notes,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to return registration for correction.");
      }

      setReturnSuccess("This registration was returned for correction successfully.");
      if (onReturn) {
        onReturn(data as KKProfilingRegistration);
      }
      onClose();
      onStatusUpdate?.("Returned");
      router.refresh();
    } catch (error) {
      setReturnError(error instanceof Error ? error.message : "Failed to return registration for correction.");
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 px-4 py-6">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 px-6 pt-6">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Katipunan ng Kabataan (KK) Profiling — Submission</h3>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
              <span>Submitted on {new Date(registration.submittedAt).toLocaleString()}</span>
              <span className="inline-flex items-center gap-2">
                <span className="font-medium text-slate-600">Review status</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isApproved
                      ? "bg-emerald-100 text-emerald-800"
                      : registration.reviewStatus === "Returned"
                      ? "bg-rose-100 text-rose-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {registration.reviewStatus || "Pending"}
                </span>
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && !isLocked ? (
              <button
                type="button"
                onClick={onEdit}
                className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                title="Edit registration"
                aria-label="Edit registration"
              >
                <Pencil className="h-4 w-4 transition" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleClose}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="px-6 pt-4 text-sm text-slate-500">
          <p>
            <span className="font-medium text-slate-600">Informed consent:</span> This registrant indicated consent when submitting the KK profiling form.
          </p>
          {registration.reviewNotes ? (
            <div className="mt-3">
              <p className="font-medium text-slate-600">Admin review notes</p>
              <p className="mt-1 whitespace-pre-wrap">{registration.reviewNotes}</p>
            </div>
          ) : null}
        </div>

        <hr className="mt-6 mb-4 border-t border-slate-200" />

        <div className="max-h-[calc(90vh-10rem)] overflow-x-hidden overflow-y-auto px-6 pb-6 pt-0">
          {/* Form layout identical to youth form but read-only */}
          <div className="grid gap-4">
            <div className="mb-4 border-b border-slate-200 pb-3">
              <h4 className="text-lg font-semibold text-slate-950">PART I: Profile</h4>
              <p className="mt-1 text-sm text-slate-600">Please ensure the accuracy of your responses by providing truthful and complete information in all required fields.</p>
            </div>

            <ReadOnlyField label="Complete Name (Family, First, Middle)" value={registration.fullName} />
            <ReadOnlyField label="Complete Address" value={registration.address} />

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadOnlyField label="Sex" value={registration.sex} />
              <ReadOnlyField label="Age" value={registration.age} />
              <ReadOnlyField label="Birth Date" value={new Date(registration.birthDate).toLocaleDateString()} />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ReadOnlyField label="Email Address" value={registration.email} />
              <ReadOnlyField label="Facebook Account (Name)" value={registration.facebook} />
            </div>

            <ReadOnlyField label="Contact Number" value={registration.contactNumber} />

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

            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-900">Uploaded identification</p>
              <p className="mt-2 text-sm text-slate-600">{registration.idDocumentType || "Not uploaded"}</p>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                {registration.idFrontFileUrl ? (
                  <PrintableDocumentCard title="Front of ID" subtitle="Identity Document" url={registration.idFrontFileUrl} />
                ) : null}
                {registration.idBackFileUrl ? (
                  <PrintableDocumentCard title="Back of ID" subtitle="Identity Document" url={registration.idBackFileUrl} />
                ) : null}
                {registration.idSingleFileUrl ? (
                  <PrintableDocumentCard
                    title="Certificate of Residency"
                    subtitle="Verified proof of address - PDF"
                    url={registration.idSingleFileUrl}
                    fullWidth
                  />
                ) : null}
                {!registration.idFrontFileUrl && !registration.idBackFileUrl && !registration.idSingleFileUrl ? (
                  <p className="col-span-1 text-sm text-slate-600 md:col-span-2">No uploaded ID documents were stored for this registration.</p>
                ) : null}
              </div>
            </div>

          </div>
        </div>

        <div className="shrink-0 rounded-b-xl border-t border-slate-200 bg-white px-6 py-4">
          {approveError || returnError ? (
            <div className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{approveError || returnError}</div>
          ) : null}
          {approveSuccess || returnSuccess ? (
            <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{approveSuccess || returnSuccess}</div>
          ) : null}

          {canReturn ? (
            <div className={`overflow-hidden transition-all duration-200 ${isCorrectionOpen ? "mb-4 max-h-40 opacity-100" : "max-h-0 opacity-0"}`}>
              <label className="block">
                <span className="text-sm font-medium text-slate-700">Correction notes</span>
                <textarea
                  rows={3}
                  value={correctionNotes}
                  onChange={(event) => setCorrectionNotes(event.target.value)}
                  className="mt-2 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-900"
                  placeholder="Explain what the applicant needs to fix in this new submission..."
                />
              </label>
            </div>
          ) : null}

          <div className="flex items-center justify-end gap-3">
            {canReturn ? (
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {isCorrectionOpen ? (
                <>
                  <button
                    type="button"
                    onClick={resetCorrectionFlow}
                    className="inline-flex justify-center rounded-md px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleReturn}
                    disabled={isReturning}
                    className="inline-flex justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isReturning ? "Returning..." : "Confirm Return"}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setIsCorrectionOpen(true)}
                    className="inline-flex justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Request Correction
                  </button>
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="inline-flex justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isApproving ? "Approving..." : "Approve Registration"}
                  </button>
                </>
              )}
            </div>
            ) : null}

            <button
              type="button"
              onClick={handleClose}
              className="inline-flex items-center justify-center rounded-lg bg-[#0F3D5C] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[#0D2E47]"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
