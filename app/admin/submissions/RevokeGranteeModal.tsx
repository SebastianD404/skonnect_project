"use client";

import { useRef, useState } from "react";
import { AlertTriangle, ChevronDown, FileText, Loader2, Upload, X } from "lucide-react";
import { compressImageForUpload } from "@/lib/image-compression";
import {
  isSkeapRevocationReason,
  isSkeapRevocationProofType,
  isSkeapRevocationProofOption,
  MAX_SKEAP_REVOCATION_PROOF_SIZE,
  SKEAP_REVOCATION_REASONS,
  SKEAP_REVOCATION_PROOF_TYPES,
  type SkeapRevocationProofOption,
  type SkeapRevocationProofType,
  type SkeapRevocationReason,
} from "@/lib/skeap-revocation";

type RevocationNotificationStatus = "NOT_REQUIRED" | "PENDING" | "SENDING" | "FAILED" | "SENT";

interface RevokeGranteeModalProps {
  granteeId: string;
  granteeName: string;
  open: boolean;
  submitting: boolean;
  error?: string | null;
  notice?: string | null;
  notificationStatus?: RevocationNotificationStatus | null;
  revocationSaved?: boolean;
  archiveRefreshFailed?: boolean;
  onClose: () => void;
  onConfirm: (
    granteeId: string,
    reason: SkeapRevocationReason,
    additionalNotes: string,
    isPermanentlyDisqualified: boolean,
    proofType: SkeapRevocationProofType | "",
    proofFile: File | null,
  ) => void;
}

export default function RevokeGranteeModal({
  granteeId,
  granteeName,
  open,
  submitting,
  error,
  notice,
  notificationStatus,
  revocationSaved = false,
  archiveRefreshFailed = false,
  onClose,
  onConfirm,
}: RevokeGranteeModalProps) {
  const [reason, setReason] = useState<SkeapRevocationReason | "">("");
  const [additionalNotes, setAdditionalNotes] = useState("");
  const [isPermanentlyDisqualified, setIsPermanentlyDisqualified] = useState(false);
  const [proofType, setProofType] = useState<SkeapRevocationProofOption | "">("");
  const [otherDocumentType, setOtherDocumentType] = useState("");
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofError, setProofError] = useState<string | null>(null);
  const [isPreparingProof, setIsPreparingProof] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const requiresProof = reason === "UNBECOMING_ACTS";
  const resolvedProofType: SkeapRevocationProofType | "" = proofType === "Others"
    ? otherDocumentType.trim().length >= 3
      ? `Other: ${otherDocumentType.trim()}`
      : ""
    : isSkeapRevocationProofType(proofType)
      ? proofType
      : "";
  const canConfirm =
    reason.trim().length >= 5 &&
    isSkeapRevocationReason(reason) &&
    (!requiresProof || (Boolean(resolvedProofType) && Boolean(proofFile) && Boolean(additionalNotes.trim()) && !isPreparingProof));

  const close = () => {
    if (!submitting) {
      setReason("");
      setAdditionalNotes("");
      setIsPermanentlyDisqualified(false);
      setProofType("");
      setOtherDocumentType("");
      setProofFile(null);
      setProofError(null);
      if (proofInputRef.current) proofInputRef.current.value = "";
      onClose();
    }
  };
  const prepareProofFile = async (file: File | undefined) => {
    if (!file || isPreparingProof) return;
    setProofError(null);

    const extension = file.name.split(".").pop()?.toLowerCase();
    const validMime =
      file.type === "application/pdf" ||
      file.type === "image/jpeg" ||
      file.type === "image/jpg" ||
      file.type === "image/png" ||
      file.type === "image/webp";
    if (!validMime || !["pdf", "jpg", "jpeg", "png", "webp"].includes(extension ?? "")) {
      setProofFile(null);
      setProofError("Upload a PDF, JPG, JPEG, PNG, or WEBP document.");
      return;
    }
    if (!file.size || file.size > MAX_SKEAP_REVOCATION_PROOF_SIZE) {
      setProofFile(null);
      setProofError("Supporting proof must be a non-empty file of 10 MB or less.");
      return;
    }

    setIsPreparingProof(true);
    try {
      const preparedFile = await compressImageForUpload(file, { maxWidth: 1600, quality: 0.8 });
      if (preparedFile.size > MAX_SKEAP_REVOCATION_PROOF_SIZE) {
        setProofFile(null);
        setProofError("Supporting proof must be 10 MB or less after preparation.");
        return;
      }
      setProofFile(preparedFile);
    } catch (error) {
      setProofFile(null);
      setProofError(error instanceof Error ? error.message : "Unable to prepare the selected proof document.");
    } finally {
      setIsPreparingProof(false);
    }
  };
  const formatFileSize = (size: number) =>
    size >= 1024 * 1024
      ? `${(size / (1024 * 1024)).toFixed(2)} MB`
      : `${Math.max(1, Math.round(size / 1024))} KB`;

  const actionLabel = !revocationSaved
    ? "Confirm Revocation"
    : archiveRefreshFailed && notificationStatus === "SENT"
      ? "Retry Archive Refresh"
      : notificationStatus === "FAILED"
        ? "Retry Notification"
        : "Check Notification";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="revoke-grantee-title"
        aria-describedby="revoke-grantee-description"
        className="max-h-[90vh] w-full max-w-lg space-y-5 overflow-y-auto rounded-2xl border border-rose-200/80 bg-white px-6 py-4 shadow-2xl"
      >
        <div className="space-y-2">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-100 bg-rose-50 text-rose-600">
                <AlertTriangle className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 id="revoke-grantee-title" className="text-base font-bold tracking-tight text-slate-900">
                Revoke Grantee
              </h2>
            </div>
            <button
              type="button"
              onClick={close}
              disabled={submitting}
              aria-label="Close revoke grantee dialog"
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <p id="revoke-grantee-description" className="text-sm leading-relaxed text-slate-600">
            {revocationSaved
              ? `${granteeName}'s scholarship is revoked. Retry the notification or close this dialog; the revocation will not be repeated.`
              : `Are you sure you want to revoke this scholarship? This action will tag ${granteeName} as Revoked, transfer their record to Revoked Grantees, and automatically notify them via email.`}
          </p>
          {!revocationSaved ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
              This action changes SKEAP scholarship status only. It does not archive the youth&apos;s KK Registry profile.
            </p>
          ) : null}
        </div>

        {error && !revocationSaved ? (
          <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}
        {notice ? (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          >
            {notice}
          </div>
        ) : null}

        <div className="mb-4 flex flex-col gap-3">
          <label htmlFor="revoke-grantee-reason" className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Reason for Revocation
            </span>
            <div className="relative">
              <select
                id="revoke-grantee-reason"
                value={reason}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setReason(isSkeapRevocationReason(value) ? value : "");
                }}
                disabled={submitting || revocationSaved}
                required
                className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-11 text-sm text-slate-900 outline-none transition focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
              >
                <option value="">Select a reason</option>
                {SKEAP_REVOCATION_REASONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                aria-hidden="true"
              />
            </div>
          </label>
          <div
            aria-hidden={!requiresProof}
            className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
              requiresProof ? "grid-rows-[1fr] opacity-100" : "pointer-events-none grid-rows-[0fr] opacity-0"
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <section className="space-y-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4">
                <div>
                  <label htmlFor="revoke-grantee-proof-type" className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Supporting Proof Document <span className="text-rose-600">Required</span>
                  </label>
                  <div className="relative mt-2">
                    <select
                      id="revoke-grantee-proof-type"
                      value={proofType}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        const nextProofType = isSkeapRevocationProofOption(value) ? value : "";
                        setProofType(nextProofType);
                        if (nextProofType !== "Others") setOtherDocumentType("");
                      }}
                      disabled={submitting || revocationSaved || !requiresProof}
                      className="w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-11 text-sm text-slate-900 outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 disabled:bg-slate-50"
                    >
                      <option value="">Select document type</option>
                      {SKEAP_REVOCATION_PROOF_TYPES.map((option) => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" aria-hidden="true" />
                  </div>
                  <div
                    aria-hidden={proofType !== "Others"}
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${
                      proofType === "Others"
                        ? "mt-3 grid-rows-[1fr] opacity-100"
                        : "pointer-events-none grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <label htmlFor="revoke-grantee-other-proof-type" className="flex flex-col gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Specify Document Type
                          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-rose-700">
                            Required
                          </span>
                        </span>
                        <input
                          id="revoke-grantee-other-proof-type"
                          type="text"
                          value={otherDocumentType}
                          onChange={(event) => setOtherDocumentType(event.currentTarget.value)}
                          disabled={submitting || revocationSaved || proofType !== "Others" || !requiresProof}
                          required={proofType === "Others"}
                          maxLength={80}
                          placeholder="e.g., MSWDO Case Report, Court Order, Sworn Affidavit"
                          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-rose-400 focus:ring-2 focus:ring-rose-500/20 disabled:cursor-not-allowed disabled:bg-slate-50"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <input
                  ref={proofInputRef}
                  id="revoke-grantee-proof-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  disabled={submitting || revocationSaved || !requiresProof || isPreparingProof}
                  onChange={(event) => {
                    const input = event.currentTarget;
                    void prepareProofFile(input.files?.[0]);
                    input.value = "";
                  }}
                  className="sr-only"
                />
                {proofFile ? (
                  <div className="flex min-w-0 items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-cyan-700" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800" title={proofFile.name}>{proofFile.name}</p>
                      <p className="text-[10px] text-slate-500">{formatFileSize(proofFile.size)}</p>
                    </div>
                    <label
                      htmlFor="revoke-grantee-proof-file"
                      className={`cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold text-cyan-800 hover:bg-cyan-50 ${
                        revocationSaved ? "pointer-events-none opacity-50" : "cursor-pointer"
                      }`}
                    >
                      Replace
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setProofFile(null);
                        if (proofInputRef.current) proofInputRef.current.value = "";
                      }}
                      disabled={submitting || revocationSaved}
                      aria-label="Remove supporting proof"
                      className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-rose-700 disabled:opacity-50"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <label
                    htmlFor="revoke-grantee-proof-file"
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void prepareProofFile(event.dataTransfer.files[0]);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed px-4 py-5 text-center transition ${
                      isPreparingProof
                        ? "border-slate-300 bg-slate-100"
                        : "border-rose-200 bg-white hover:border-rose-400 hover:bg-rose-50/30"
                    }`}
                  >
                    {isPreparingProof ? (
                      <Loader2 className="h-5 w-5 animate-spin text-slate-500" aria-hidden="true" />
                    ) : (
                      <Upload className="h-5 w-5 text-rose-500" aria-hidden="true" />
                    )}
                    <span className="mt-2 text-sm font-semibold text-slate-700">
                      {isPreparingProof ? "Preparing document..." : "Choose or drop supporting proof"}
                    </span>
                    <span className="mt-1 text-xs text-slate-500">PDF, JPG, JPEG, PNG, or WEBP · max 10 MB</span>
                  </label>
                )}
                {proofError ? <p role="alert" className="text-xs font-medium text-rose-700">{proofError}</p> : null}
                <p className="text-xs leading-relaxed text-slate-500">
                  Official documentation is required to review an incident-related revocation.
                </p>
              </section>
            </div>
          </div>
          <label htmlFor="revoke-grantee-additional-notes" className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              {requiresProof ? "INCIDENT SUMMARY & CASE DETAILS" : "Additional Notes"}
              {requiresProof ? (
                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-rose-700">
                  Required
                </span>
              ) : (
                <span className="ml-2 font-medium normal-case text-slate-400">(Optional)</span>
              )}
            </span>
            <textarea
              id="revoke-grantee-additional-notes"
              rows={3}
              value={additionalNotes}
              onChange={(event) => setAdditionalNotes(event.currentTarget.value)}
              disabled={submitting || revocationSaved}
              maxLength={1000}
              placeholder={
                requiresProof
                  ? "Describe the incident, date, and Barangay/Police blotter or case reference number..."
                  : reason === "OTHER_SCHOLARSHIP"
                    ? "Add context, such as the other scholarship agency"
                    : "Add supporting context or remarks for this revocation..."
              }
              className="w-full min-h-24 max-h-40 resize-y overflow-y-auto rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-500 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </label>
          <label className="flex items-start gap-3 rounded-xl border border-rose-100 bg-rose-50/60 p-3 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPermanentlyDisqualified}
              onChange={(event) => setIsPermanentlyDisqualified(event.currentTarget.checked)}
              disabled={submitting || revocationSaved}
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
            />
            <span className="leading-5">
              Permanent Disqualification (Criminal act or act unbecoming of a student — permanently bars SKEAP reapplication)
            </span>
          </label>
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {revocationSaved ? "Close" : "Cancel"}
          </button>
          <button
            type="button"
            onClick={() => {
              if (canConfirm) {
                onConfirm(
                  granteeId,
                  reason,
                  additionalNotes.trim(),
                  isPermanentlyDisqualified,
                  resolvedProofType,
                  proofFile,
                );
              }
            }}
            disabled={
              submitting ||
              !canConfirm ||
              (revocationSaved &&
                (notificationStatus === "SENT" || notificationStatus === "NOT_REQUIRED") &&
                !archiveRefreshFailed)
            }
            className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            {submitting ? (revocationSaved ? "Retrying..." : "Revoking...") : actionLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
