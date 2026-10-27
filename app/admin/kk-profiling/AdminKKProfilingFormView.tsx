"use client";

import { ExternalLink, Pencil, X } from "lucide-react";
import { useState } from "react";
import type { KKProfilingRegistration } from "./types";

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 text-left">
      <span className="mb-1 block text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="w-full break-words rounded-xl border border-slate-100 bg-slate-50 p-3 text-left text-sm font-medium text-slate-900">
        {value || "N/A"}
      </div>
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
  onStatusUpdate?: (status: "Approved" | "Returned" | "Rejected", registrationId: string) => void;
}) {
  const [correctionNotes, setCorrectionNotes] = useState("");
  const [isReturning, setIsReturning] = useState(false);
  const [isCorrectionOpen, setIsCorrectionOpen] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [isRejectionOpen, setIsRejectionOpen] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [isReopenConfirmOpen, setIsReopenConfirmOpen] = useState(false);
  const [isReopening, setIsReopening] = useState(false);
  const [reopenError, setReopenError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);

  const isApproved = registration.reviewStatus?.toLowerCase() === "approved";
  const isRejected = registration.reviewStatus?.toLowerCase() === "rejected";
  const isLocked = isApproved || isRejected;
  const canReturn = !isLocked;

  const resetCorrectionFlow = () => {
    setCorrectionNotes("");
    setIsCorrectionOpen(false);
    setReturnError(null);
    setRejectionNotes("");
    setIsRejectionOpen(false);
    setRejectionError(null);
    setIsReopenConfirmOpen(false);
    setReopenError(null);
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
      onStatusUpdate?.("Approved", registration.id);
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
      onStatusUpdate?.("Returned", registration.id);
    } catch (error) {
      setReturnError(error instanceof Error ? error.message : "Failed to return registration for correction.");
    } finally {
      setIsReturning(false);
    }
  };

  const handleReject = async () => {
    const notes = rejectionNotes.trim();
    setRejectionError(null);

    if (!notes) {
      setRejectionError("Add a reason so the applicant understands why the registration was rejected.");
      return;
    }

    setIsRejecting(true);
    try {
      const response = await fetch(`/api/admin/kk-profiling/${registration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewStatus: "Rejected", reviewNotes: notes }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to reject registration.");
      }

      onReturn?.(data as KKProfilingRegistration);
      onClose();
      onStatusUpdate?.("Rejected", registration.id);
    } catch (error) {
      setRejectionError(error instanceof Error ? error.message : "Failed to reject registration.");
    } finally {
      setIsRejecting(false);
    }
  };

  const handleReopen = async () => {
    setReopenError(null);
    setIsReopening(true);

    try {
      const response = await fetch(`/api/admin/kk-profiling/${registration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewStatus: "Returned",
          reviewNotes: "This application has been reopened for resubmission. Please review and update your registration, then submit it again.",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to reopen registration.");
      }

      onReturn?.(data as KKProfilingRegistration);
      onClose();
      onStatusUpdate?.("Returned", registration.id);
    } catch (error) {
      setReopenError(error instanceof Error ? error.message : "Failed to reopen registration.");
    } finally {
      setIsReopening(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 sm:p-6">
      <div className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white text-left shadow-2xl">
        <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6">
          <div className="min-w-0">
            <h3 className="break-words text-left text-xl font-semibold text-slate-900">Katipunan ng Kabataan (KK) Profiling — Submission</h3>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-left text-sm text-slate-500">
              <span>Submitted on {new Date(registration.submittedAt).toLocaleString()}</span>
              <span className="inline-flex items-center gap-2">
                <span className="font-medium text-slate-600">Review status</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isApproved
                      ? "bg-emerald-100 text-emerald-800"
                      : isRejected
                      ? "bg-rose-100 text-rose-800"
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
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 pb-6 pt-4">
          <div className="mb-6 space-y-3 text-left text-sm text-slate-600">
            <p>
              <span className="font-medium text-slate-700">Informed consent:</span> This registrant indicated consent when submitting the KK profiling form.
            </p>
            {registration.reviewNotes ? (
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="font-medium text-slate-700">Admin review notes</p>
                <p className="mt-1 break-words whitespace-pre-wrap">{registration.reviewNotes}</p>
              </div>
            ) : null}
          </div>
          {/* Form layout identical to youth form but read-only */}
          <div className="grid min-w-0 grid-cols-1 gap-4">
            <div className="col-span-full mb-1 mt-2 border-b border-slate-200 pb-2">
              <h4 className="break-words text-left text-lg font-bold text-slate-800">PART I: Profile</h4>
              <p className="mt-1 text-left text-sm text-slate-600">Please ensure the accuracy of your responses by providing truthful and complete information in all required fields.</p>
            </div>

            <div className="col-span-full">
              <ReadOnlyField label="Complete Name (Family, First, Middle)" value={registration.fullName} />
            </div>
            <div className="col-span-full">
              <ReadOnlyField label="Complete Address" value={registration.address} />
            </div>

            <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadOnlyField label="Sex" value={registration.sex} />
              <ReadOnlyField label="Birth Date" value={new Date(registration.birthDate).toLocaleDateString()} />
              <ReadOnlyField label="Age" value={registration.age} />
            </div>

            <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2">
              <ReadOnlyField label="Email Address" value={registration.email} />
              <ReadOnlyField label="Facebook Account (Name)" value={registration.facebook} />
            </div>

            <div className="col-span-full">
              <ReadOnlyField label="Contact Number" value={registration.contactNumber} />
            </div>

            <h4 className="col-span-full mb-1 mt-6 break-words border-b border-slate-200 pb-2 text-left text-lg font-bold text-slate-800">
              PART II: Demographic Characteristics
            </h4>

            <ReadOnlyField label="Civil Status" value={registration.civilStatus} />

            <ReadOnlyField label="Youth Classification" value={registration.youthClassification} />

            <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Youth Age Group" value={registration.youthAgeGroup} />
              <ReadOnlyField label="Work Status" value={registration.workStatus} />
            </div>

            <div className="col-span-full">
              <ReadOnlyField label="Educational Background" value={registration.educationalBackground} />
            </div>

            <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ReadOnlyField label="Registered SK Voter?" value={registration.registeredSKVoter} />
              <ReadOnlyField label="Did you vote last SK election?" value={registration.votedLastSK} />
              <ReadOnlyField label="Registered National Voter?" value={registration.registeredNationalVoter} />
            </div>

            <div className="col-span-full">
              <ReadOnlyField label="Have you already attended a KK Assembly?" value={registration.attendedKKAssembly} />
            </div>

            {registration.attendedKKAssembly === "Yes" && (
              <ReadOnlyField label="If Yes, how many times" value={registration.assemblyTimes} />
            )}

            {registration.attendedKKAssembly === "No" && (
              <ReadOnlyField label="If No, why?" value={registration.noAssemblyReason} />
            )}

            <div className="col-span-full mt-6 space-y-4">
              <h4 className="break-words border-b border-slate-200 pb-2 text-left text-lg font-bold text-slate-800">
                PART III: Identification Documents
              </h4>
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
                    subtitle="Proof of address"
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

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white/90 p-4 backdrop-blur">
          {approveError || returnError || rejectionError || reopenError ? (
            <div role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {approveError || returnError || rejectionError || reopenError}
            </div>
          ) : null}
          {approveSuccess || returnSuccess ? (
            <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{approveSuccess || returnSuccess}</div>
          ) : null}

          {canReturn && isCorrectionOpen ? (
            <div className="mt-4 w-full animate-in slide-in-from-bottom-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className="mb-2 block">Correction notes</span>
                <textarea
                  rows={4}
                  value={correctionNotes}
                  onChange={(event) => setCorrectionNotes(event.target.value)}
                  className="min-h-[100px] w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
                  placeholder="Explain what the applicant needs to fix in this new submission..."
                />
              </label>
              <div className="mt-4 flex w-full items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={resetCorrectionFlow}
                  disabled={isReturning}
                  className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReturn}
                  disabled={isReturning || isRejecting || isApproving}
                  className="inline-flex justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isReturning ? "Returning..." : "Confirm Return"}
                </button>
              </div>
            </div>
          ) : null}
          {canReturn && isRejectionOpen ? (
            <div className="mb-4 w-full rounded-xl border border-rose-200 bg-rose-50/70 p-4 dark:border-rose-900/60 dark:bg-rose-950/20">
              <p className="text-sm font-semibold text-rose-900 dark:text-rose-200">Reject this registration?</p>
              <p className="mb-3 break-words whitespace-normal text-sm leading-tight text-rose-800 dark:text-rose-200">
                The applicant will see this reason and will not be able to edit or resubmit this form.
              </p>
              <textarea
                rows={3}
                required
                aria-label="Reason for rejection"
                value={rejectionNotes}
                onChange={(event) => setRejectionNotes(event.target.value)}
                className="min-h-[80px] w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300/60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-500 dark:focus:ring-slate-500/30"
                placeholder="Explain why this registration cannot be approved."
              />
              <div className="mt-2 flex w-full justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsRejectionOpen(false);
                    setRejectionNotes("");
                    setRejectionError(null);
                  }}
                  disabled={isRejecting}
                  className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isRejecting || isReturning || isApproving}
                  className="inline-flex justify-center rounded-xl bg-rose-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isRejecting ? "Rejecting..." : "Confirm Rejection"}
                </button>
              </div>
            </div>
          ) : null}
          {isRejected && isReopenConfirmOpen ? (
            <div className="mb-4 w-full rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-semibold text-slate-900">Reopen this application?</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-600">
                The applicant will be able to edit and resubmit this registration. The application will move to Returned.
              </p>
              <div className="mt-3 flex w-full justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsReopenConfirmOpen(false);
                    setReopenError(null);
                  }}
                  disabled={isReopening}
                  className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReopen}
                  disabled={isReopening}
                  className="inline-flex justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isReopening ? "Reopening..." : "Confirm Reopen"}
                </button>
              </div>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {isRejected && !isReopenConfirmOpen ? (
              <button
                type="button"
                onClick={() => {
                  setIsReopenConfirmOpen(true);
                  setReopenError(null);
                }}
                className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reopen for Resubmission
              </button>
            ) : null}
            {canReturn && !isCorrectionOpen ? (
              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                {!isRejectionOpen ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCorrectionOpen(true);
                      setIsRejectionOpen(false);
                    }}
                    className="inline-flex justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    Request Correction
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsRejectionOpen(true);
                      setIsCorrectionOpen(false);
                      setReturnError(null);
                    }}
                    className="inline-flex justify-center rounded-md border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Reject Registration
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
                ) : null}
              </div>
            ) : null}

          </div>
        </div>
      </div>
    </div>
  );
}
