"use client";

import { Pencil, X } from "lucide-react";
import { useState } from "react";
import type { KKProfilingRegistration } from "./types";

export function AdminKKProfilingFormView({
  registration,
  onClose,
  onEdit,
  onReturn,
}: {
  registration: KKProfilingRegistration;
  onClose: () => void;
  onEdit?: () => void;
  onReturn?: (updatedRegistration: KKProfilingRegistration) => void;
}) {
  const [reviewNotes, setReviewNotes] = useState(registration.reviewNotes ?? "");
  const [isReturning, setIsReturning] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [returnSuccess, setReturnSuccess] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);

  const isApproved = registration.reviewStatus === "Approved";
  const canReturn = !isApproved;
  const returnButtonLabel = registration.reviewStatus === "Pending" ? "Return for correction" : "Update return";

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
    } catch (error) {
      setApproveError(error instanceof Error ? error.message : "Failed to approve registration.");
    } finally {
      setIsApproving(false);
    }
  };

  const handleReturn = async () => {
    const notes = reviewNotes.trim();
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
    } catch (error) {
      setReturnError(error instanceof Error ? error.message : "Failed to return registration for correction.");
    } finally {
      setIsReturning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
      <div className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[1.75rem] bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-slate-950">Katipunan ng Kabataan (KK) Profiling — Submission</h3>
            <p className="mt-1 text-sm text-slate-500">Submitted on {new Date(registration.submittedAt).toLocaleString()}</p>
          </div>
          <div className="flex items-center gap-2">
            {onEdit ? (
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
              onClick={onClose}
              className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
              aria-label="Close details"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>
        <div className="mt-6">
          {/* Informed consent box */}
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
              <p className="font-semibold text-slate-900">Admin review notes</p>
              <p className="mt-2 text-slate-700">{registration.reviewNotes || "No notes have been added."}</p>
            </div>
          </div>

          {canReturn ? (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-slate-900">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-base font-semibold text-emerald-950">Approve this registration</p>
                  <p className="mt-2 text-sm text-emerald-900">
                    This applicant has verified their identity and provided all required information. They will be able to apply for SKEAP and register for events after approval.
                  </p>
                </div>
                {approveError ? (
                  <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {approveError}
                  </div>
                ) : null}
                {approveSuccess ? (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {approveSuccess}
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleApprove}
                    disabled={isApproving}
                    className="inline-flex justify-center rounded-full bg-emerald-700 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isApproving ? "Approving..." : "Approve registration"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {canReturn ? (
            <div className="mt-6 rounded-3xl border border-amber-200 bg-amber-50 p-5 text-sm text-slate-900">
              <div className="flex flex-col gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">Return this registration for correction</p>
                  <p className="mt-2 text-sm text-slate-700">
                    Send this registration back to the applicant and require them to update their KK Profiling submission.
                  </p>
                </div>
                <label className="block">
                  <span className="text-sm font-semibold">Return notes</span>
                  <textarea
                    rows={4}
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                    className="mt-2 w-full resize-none rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-amber-200"
                    placeholder="Explain what the applicant should correct or update."
                  />
                </label>
                {returnError ? (
                  <div className="rounded-3xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {returnError}
                  </div>
                ) : null}
                {returnSuccess ? (
                  <div className="rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {returnSuccess}
                  </div>
                ) : null}
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={handleReturn}
                    disabled={isReturning}
                    className="inline-flex justify-center rounded-full bg-amber-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-amber-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isReturning ? "Returning..." : returnButtonLabel}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-600 flex items-center justify-center">
                  <span className="text-white font-semibold">✓</span>
                </div>
                <div>
                  <p className="font-semibold text-emerald-900">Approved</p>
                  <p className="text-sm text-emerald-800">This registration has been approved. The applicant can now apply for SKEAP and register for events.</p>
                </div>
              </div>
            </div>
          )}

          {/* Form layout identical to youth form but read-only */}
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

              {registration.idDocumentType === "Valid ID" ? (
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
                  {!registration.idFrontFileUrl && !registration.idBackFileUrl ? (
                    <p className="mt-4 text-sm text-slate-600">No front/back ID images were uploaded for this registration.</p>
                  ) : null}
                </div>
              ) : registration.idSingleFileUrl ? (
                <div className="mt-4">
                  <a
                    href={registration.idSingleFileUrl}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                  >
                    View uploaded document
                  </a>
                </div>
              ) : (
                <p className="mt-4 text-sm text-slate-600">No uploaded ID documents were stored for this registration.</p>
              )}
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
