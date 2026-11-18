"use client";

import { CheckCircle2, Clock, ExternalLink, Loader2, LoaderCircle, Pencil, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { rejectKKProfilingApplication } from "./actions";
import type { KKProfilingRegistration } from "./types";
import { getExactAge } from "@/lib/skeap-age";
import { getKKYouthAgeGroup } from "@/lib/kk-youth-age";
import { formatSexLabel, parseSex } from "@/lib/sex";

type MasterlistProfileDraft = {
  fullName: string;
  birthDate: string;
  sex: string;
  youthClassification: string;
  address: string;
  sitio: string;
  contactNumber: string;
  registeredSKVoter: string;
};

function toDateInputValue(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function getMasterlistProfileDraft(registration: KKProfilingRegistration): MasterlistProfileDraft {
  const sex = parseSex(registration.kkProfile?.sex ?? registration.sex);
  return {
    fullName: registration.kkProfile?.fullName || registration.fullName,
    birthDate: toDateInputValue(registration.birthDate),
    sex: sex ? formatSexLabel(sex) : "Not specified",
    youthClassification: registration.youthClassification,
    address: registration.address,
    sitio: registration.kkProfile?.purok ?? "",
    contactNumber: registration.kkProfile?.contactNumber || registration.contactNumber,
    registeredSKVoter: registration.registeredSKVoter === "No" ? "No" : "Yes",
  };
}

const profileInputClassName =
  "h-[46px] w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none transition focus:border-cyan-600 focus:ring-2 focus:ring-cyan-600/10";

function ReadOnlyField({
  label,
  value,
  editing = false,
  children,
}: {
  label: string;
  value: React.ReactNode;
  editing?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 text-left">
      <span className="mb-1 block text-left text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      {editing && children ? (
        children
      ) : (
        <div className="min-h-11 w-full break-words rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-left text-sm font-medium text-slate-900">
          {value || "N/A"}
        </div>
      )}
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
  registration: initialRegistration,
  onClose,
  onEdit,
  editInView = false,
  onReturn,
  onStatusUpdate,
}: {
  registration: KKProfilingRegistration;
  onClose: () => void;
  onEdit?: () => void;
  editInView?: boolean;
  onReturn?: (updatedRegistration: KKProfilingRegistration) => void;
  onStatusUpdate?: (status: "Approved" | "Returned" | "Rejected" | "For Physical CTC", registrationId: string) => void;
}) {
  const [registration, setRegistration] = useState(initialRegistration);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState<string | null>(null);
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
  const [isPassingDigitalReview, setIsPassingDigitalReview] = useState(false);
  const [isConfirmingPhysicalCtc, setIsConfirmingPhysicalCtc] = useState(false);
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSuccess, setApproveSuccess] = useState<string | null>(null);
  const [isProfileEditing, setIsProfileEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [profileEditError, setProfileEditError] = useState<string | null>(null);
  const [isConfirmingScholarAgeOut, setIsConfirmingScholarAgeOut] = useState(false);
  const [profileDraft, setProfileDraft] = useState(() => getMasterlistProfileDraft(initialRegistration));

  const normalizedReviewStatus = (registration.reviewStatus ?? "pending").trim().toLowerCase().replace(/_/g, " ");
  const isApproved = normalizedReviewStatus === "approved";
  const isRejected = normalizedReviewStatus === "rejected";
  const isWithdrawn = normalizedReviewStatus === "withdrawn";
  const isReturned = normalizedReviewStatus === "returned";
  const isForPhysicalCtc = normalizedReviewStatus === "for physical ctc";
  const canReviewDigitally = ["pending", "pending review", "manual review", "resubmitted"].includes(
    normalizedReviewStatus,
  );
  const isLocked = isApproved || isRejected || isWithdrawn;
  const canReturn = canReviewDigitally;
  const initialRegistrationId = initialRegistration.id;

  useEffect(() => {
    let active = true;

    void fetch(`/api/admin/kk-profiling/${initialRegistrationId}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "Unable to load complete member details.");
        }
        if (active) {
          setRegistration(data as KKProfilingRegistration);
          setProfileDraft(getMasterlistProfileDraft(data as KKProfilingRegistration));
          setDetailsError(null);
        }
      })
      .catch((error) => {
        if (active) {
          setDetailsError(error instanceof Error ? error.message : "Unable to load complete member details.");
        }
      })
      .finally(() => {
        if (active) setDetailsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [initialRegistrationId]);

  useEffect(() => {
    if (!isRejectionOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isRejecting) {
        setIsRejectionOpen(false);
        setRejectionNotes("");
        setRejectionError(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRejectionOpen, isRejecting]);

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

  const kkProfile = registration.kkProfile;
  const kkSexLabel = kkProfile?.sex === "MALE"
    ? "Male"
    : kkProfile?.sex === "FEMALE"
      ? "Female"
      : kkProfile?.sex === "NOT_SPECIFIED"
        ? "Not specified"
        : registration.sex;
  const hasActiveScholarship = ["ACTIVE", "PROBATIONARY"].includes(
    registration.user?.grantee?.status?.toUpperCase() ?? "",
  );
  const calculatedAge = profileDraft.birthDate
    ? getExactAge(new Date(`${profileDraft.birthDate}T00:00:00.000Z`))
    : null;
  const calculatedAgeGroup = calculatedAge === null ? null : getKKYouthAgeGroup(calculatedAge);

  const updateProfileDraft = <K extends keyof MasterlistProfileDraft>(
    key: K,
    value: MasterlistProfileDraft[K],
  ) => {
    setProfileDraft((current) => ({ ...current, [key]: value }));
    setIsConfirmingScholarAgeOut(false);
    setProfileEditError(null);
  };

  const handleSaveMasterlistProfile = async () => {
    if (calculatedAge === null || calculatedAge < 0) {
      setProfileEditError("Enter a valid date of birth that is not in the future.");
      return;
    }
    if (calculatedAge >= 31 && hasActiveScholarship && !isConfirmingScholarAgeOut) {
      setIsConfirmingScholarAgeOut(true);
      return;
    }

    setIsSavingProfile(true);
    setProfileEditError(null);
    try {
      const response = await fetch(`/api/admin/registry/masterlist/${registration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...profileDraft,
          confirmActiveScholarAgeOut: isConfirmingScholarAgeOut,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data?.code === "ACTIVE_SCHOLAR_CONFIRMATION_REQUIRED") {
          setIsConfirmingScholarAgeOut(true);
          return;
        }
        throw new Error(data?.error || "Failed to save profile changes.");
      }

      const updatedRegistration = data as KKProfilingRegistration;
      onReturn?.(updatedRegistration);
      setRegistration(updatedRegistration);
      if (String(updatedRegistration.reviewStatus).toLowerCase() === "archived") {
        onClose();
        return;
      }
      setProfileDraft(getMasterlistProfileDraft(updatedRegistration));
      setIsProfileEditing(false);
      setIsConfirmingScholarAgeOut(false);
    } catch (error) {
      setProfileEditError(error instanceof Error ? error.message : "Failed to save profile changes.");
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handlePassDigitalReview = async () => {
    setApproveError(null);
    setApproveSuccess(null);
    setIsPassingDigitalReview(true);

    try {
      const response = await fetch(`/api/admin/kk-profiling/${registration.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reviewAction: "PASS_DIGITAL_REVIEW",
          reviewStatus: "For Physical CTC",
          reviewNotes: "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to pass digital review.");
      }

      setApproveSuccess("Digital screening is complete. The applicant has been asked to present their Original / CTC.");
      if (onReturn) {
        onReturn(data as KKProfilingRegistration);
      }
      onClose();
      onStatusUpdate?.("For Physical CTC", registration.id);
    } catch (error) {
      setApproveError(error instanceof Error ? error.message : "Failed to pass digital review.");
    } finally {
      setIsPassingDigitalReview(false);
    }
  };

  const handleConfirmPhysicalCtc = async () => {
    setApproveError(null);
    setApproveSuccess(null);
    setIsConfirmingPhysicalCtc(true);

    try {
      const response = await fetch(`/api/admin/kk-profiling/${registration.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewAction: "CONFIRM_PHYSICAL_CTC",
          reviewStatus: "Approved",
          reviewNotes: "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to confirm physical CTC.");
      }

      setApproveSuccess("Physical Original / CTC verification is complete. This KK profile is now approved.");
      onReturn?.(data as KKProfilingRegistration);
      onClose();
      onStatusUpdate?.("Approved", registration.id);
    } catch (error) {
      setApproveError(error instanceof Error ? error.message : "Failed to confirm physical CTC.");
    } finally {
      setIsConfirmingPhysicalCtc(false);
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
          reviewAction: "RETURN_FOR_EDITS",
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
      const result = await rejectKKProfilingApplication(registration.id, notes);
      if (result.error) {
        throw new Error(result.error);
      }

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
          reviewAction: "REOPEN",
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

  return typeof document === "undefined"
    ? null
    : createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="kk-profiling-submission-title"
        className="relative flex h-[90vh] max-h-[900px] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white text-left shadow-2xl"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 px-6 pt-6">
          <div className="min-w-0">
            <h3 id="kk-profiling-submission-title" className="break-words text-left text-xl font-semibold text-slate-900">Katipunan ng Kabataan (KK) Profiling — Submission</h3>
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-left text-sm text-slate-500">
              <span>Submitted on {new Date(registration.submittedAt).toLocaleString()}</span>
              <span className="inline-flex items-center gap-2">
                <span className="font-medium text-slate-600">Review status</span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    isApproved
                      ? "bg-emerald-100 text-emerald-800"
                      : isWithdrawn
                      ? "border border-slate-200 bg-slate-100 text-slate-600"
                      : isRejected
                      ? "bg-rose-100 text-rose-800"
                      : isForPhysicalCtc
                      ? "border border-sky-200 bg-sky-50 text-sky-700"
                      : isReturned
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
            {editInView && isProfileEditing ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                Editing
              </span>
            ) : editInView ? (
              <button
                type="button"
                onClick={() => {
                  setProfileDraft(getMasterlistProfileDraft(registration));
                  setProfileEditError(null);
                  setIsConfirmingScholarAgeOut(false);
                  setIsProfileEditing(true);
                }}
                disabled={detailsLoading}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
                Edit Profile
              </button>
            ) : onEdit && !isLocked && !isProfileEditing ? (
              <button
                type="button"
                onClick={onEdit}
                disabled={detailsLoading}
                className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
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
        <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-6 pb-6 pt-4 [scrollbar-gutter:stable]">
          {isForPhysicalCtc ? (
            <div className="mb-4 flex items-start gap-2.5 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-sky-900">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
              <p>Digital screening complete. Physical Original / CTC verification is pending at the Barangay Pico SK Office.</p>
            </div>
          ) : null}
          {detailsLoading ? (
            <div
              className="flex min-h-full flex-col items-center justify-center gap-3 py-8 text-center"
              role="status"
              aria-live="polite"
            >
              <LoaderCircle className="h-7 w-7 animate-spin text-slate-500" aria-hidden="true" />
              <p className="text-sm font-semibold text-slate-700">Loading complete application details...</p>
              <div className="mt-3 w-full animate-pulse space-y-4" aria-hidden="true">
                <div className="h-5 w-40 rounded bg-slate-100" />
                <div className="h-3 w-full rounded bg-slate-100" />
                <div className="h-11 w-full rounded-xl bg-slate-100" />
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="h-16 rounded-xl bg-slate-100" />
                  <div className="h-16 rounded-xl bg-slate-100" />
                  <div className="h-16 rounded-xl bg-slate-100" />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="h-16 rounded-xl bg-slate-100" />
                  <div className="h-16 rounded-xl bg-slate-100" />
                </div>
                <div className="h-11 w-full rounded-xl bg-slate-100" />
              </div>
            </div>
          ) : null}
          <div hidden={detailsLoading} aria-hidden={detailsLoading}>
          {detailsError ? (
            <p role="alert" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Additional profile details could not be loaded. Showing the saved registration details.
            </p>
          ) : null}
          {isWithdrawn ? (
            <section
              role="status"
              className="mb-5 rounded-xl border border-slate-200 bg-slate-100/80 p-4 text-slate-700"
            >
              <p className="text-sm font-semibold">Application withdrawn</p>
              <p className="mt-1 text-sm">
                Withdrawn on {registration.withdrawnAt
                  ? new Date(registration.withdrawnAt).toLocaleString()
                  : "a date not recorded"}.
              </p>
              {registration.withdrawalReason ? (
                <p className="mt-2 text-sm">Reason: {registration.withdrawalReason}</p>
              ) : null}
            </section>
          ) : null}
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
          <div className="grid min-w-0 grid-cols-1 gap-4">
            <div className="col-span-full mb-1 mt-2 border-b border-slate-200 pb-2">
              <h4 className="break-words text-left text-lg font-bold text-slate-800">PART I: Profile</h4>
              <p className="mt-1 text-left text-sm text-slate-600">Please ensure the accuracy of your responses by providing truthful and complete information in all required fields.</p>
            </div>

            <div className="col-span-full">
              <ReadOnlyField
                label="Complete Name (Family, First, Middle)"
                value={kkProfile?.fullName || registration.fullName}
                editing={isProfileEditing}
              >
                <input
                  type="text"
                  value={profileDraft.fullName}
                  onChange={(event) => updateProfileDraft("fullName", event.target.value)}
                  className={profileInputClassName}
                  autoComplete="name"
                />
              </ReadOnlyField>
            </div>
            <div className="col-span-full">
              <ReadOnlyField
                label="Complete Address"
                value={registration.address}
                editing={isProfileEditing}
              >
                <input
                  type="text"
                  value={profileDraft.address}
                  onChange={(event) => updateProfileDraft("address", event.target.value)}
                  className={profileInputClassName}
                  autoComplete="street-address"
                />
              </ReadOnlyField>
            </div>
            <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ReadOnlyField label="Sitio / Purok" value={kkProfile?.purok} editing={isProfileEditing}>
                <input
                  type="text"
                  value={profileDraft.sitio}
                  onChange={(event) => updateProfileDraft("sitio", event.target.value)}
                  className={profileInputClassName}
                />
              </ReadOnlyField>
              <ReadOnlyField label="Barangay" value={kkProfile?.barangay} />
              <ReadOnlyField label="Place of Birth" value={kkProfile?.placeOfBirth} />
            </div>
            <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-3">
              <ReadOnlyField label="Sex" value={kkSexLabel} editing={isProfileEditing}>
                <select
                  value={profileDraft.sex}
                  onChange={(event) => updateProfileDraft("sex", event.target.value)}
                  className={profileInputClassName}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Not specified">Not specified</option>
                </select>
              </ReadOnlyField>
              <ReadOnlyField
                label="Birth Date"
                value={new Date(kkProfile?.birthDate || registration.birthDate).toLocaleDateString()}
                editing={isProfileEditing}
              >
                <input
                  type="date"
                  value={profileDraft.birthDate}
                  onChange={(event) => updateProfileDraft("birthDate", event.target.value)}
                  className={profileInputClassName}
                  required
                />
              </ReadOnlyField>
              {isProfileEditing ? (
                <div className="min-w-0 text-left">
                  <span className="mb-1 block text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Age</span>
                  <div
                    className={`flex h-[46px] w-full items-center break-words rounded-xl border px-4 py-2.5 text-left text-sm font-medium ${
                      calculatedAge !== null && calculatedAge >= 31
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-slate-300 bg-slate-50 text-slate-900"
                    }`}
                    aria-live="polite"
                  >
                    {calculatedAge !== null && calculatedAge >= 0
                      ? `${calculatedAge} yrs old${calculatedAgeGroup ? ` · ${calculatedAgeGroup}` : ""}`
                      : "Enter a valid birth date"}
                  </div>
                </div>
              ) : (
                <ReadOnlyField label="Age" value={registration.age} />
              )}
            </div>
            {isProfileEditing && calculatedAge !== null && calculatedAge >= 31 ? (
              <div role="alert" className="col-span-full rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                Age-Out Notice (31+ yrs old): Exceeds the Katipunan ng Kabataan age limit (15–30 under RA 10742). Saving will automatically archive this profile and move it to Archived KK Youth.
                {hasActiveScholarship ? (
                  <span className="mt-1 block">
                    Saving will also mark the active SKEAP scholarship as <strong>Aged Out / Concluded</strong>.
                  </span>
                ) : null}
                {isConfirmingScholarAgeOut ? (
                  <span className="mt-1 block font-semibold">
                    Confirm that you want to conclude this resident&apos;s active SKEAP scholarship before saving the age-out archive.
                  </span>
                ) : null}
              </div>
            ) : null}

            <div className="col-span-full grid grid-cols-1 gap-4 md:grid-cols-2">
              <ReadOnlyField label="Email Address" value={kkProfile?.email || registration.email} />
              <ReadOnlyField label="Facebook Account (Name)" value={registration.facebook} />
            </div>

            <div className="col-span-full">
              <ReadOnlyField
                label="Contact Number"
                value={kkProfile?.contactNumber || registration.contactNumber}
                editing={isProfileEditing}
              >
                <input
                  type="tel"
                  value={profileDraft.contactNumber}
                  onChange={(event) => updateProfileDraft("contactNumber", event.target.value)}
                  className={profileInputClassName}
                  autoComplete="tel"
                />
              </ReadOnlyField>
            </div>

            <h4 className="col-span-full mb-1 mt-6 break-words border-b border-slate-200 pb-2 text-left text-lg font-bold text-slate-800">
              PART II: Demographic Characteristics
            </h4>

            <ReadOnlyField label="Civil Status" value={registration.civilStatus} />

            <ReadOnlyField
              label="Youth Classification"
              value={registration.youthClassification}
              editing={isProfileEditing}
            >
              <input
                type="text"
                value={profileDraft.youthClassification}
                onChange={(event) => updateProfileDraft("youthClassification", event.target.value)}
                className={profileInputClassName}
              />
            </ReadOnlyField>

            <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Youth Age Group" value={registration.youthAgeGroup} />
              <ReadOnlyField label="Work Status" value={registration.workStatus} />
            </div>

            <div className="col-span-full">
              <ReadOnlyField label="Educational Background" value={registration.educationalBackground} />
            </div>

            <div className="col-span-full grid grid-cols-1 gap-4 sm:grid-cols-3">
              <ReadOnlyField
                label="Registered SK Voter?"
                value={registration.registeredSKVoter}
                editing={isProfileEditing}
              >
                <select
                  value={profileDraft.registeredSKVoter}
                  onChange={(event) => updateProfileDraft("registeredSKVoter", event.target.value)}
                  className={profileInputClassName}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </ReadOnlyField>
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
                {registration.photoFileUrl ? (
                  <PrintableDocumentCard title="2x2 ID Picture" subtitle="Profile photo" url={registration.photoFileUrl} />
                ) : null}
                {registration.birthCertificateFileUrl ? (
                  <PrintableDocumentCard title="Birth Certificate" subtitle="Foundational identity document" url={registration.birthCertificateFileUrl} />
                ) : null}
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
                {!registration.photoFileUrl && !registration.birthCertificateFileUrl && !registration.idFrontFileUrl && !registration.idBackFileUrl && !registration.idSingleFileUrl ? (
                  <p className="col-span-1 text-sm text-slate-600 md:col-span-2">No uploaded ID documents were stored for this registration.</p>
                ) : null}
              </div>
            </div>

          </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-10 shrink-0 border-t border-slate-100 bg-white/90 p-4 backdrop-blur">
          {approveError || returnError || (!isRejectionOpen && rejectionError) || reopenError ? (
            <div role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {approveError || returnError || (!isRejectionOpen && rejectionError) || reopenError}
            </div>
          ) : null}
          {approveSuccess || returnSuccess ? (
            <div className="mb-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{approveSuccess || returnSuccess}</div>
          ) : null}
          {profileEditError ? (
            <div role="alert" className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
              {profileEditError}
            </div>
          ) : null}

          {isProfileEditing ? (
            <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row">
              <button
                type="button"
                onClick={() => {
                  setProfileDraft(getMasterlistProfileDraft(registration));
                  setProfileEditError(null);
                  setIsConfirmingScholarAgeOut(false);
                  setIsProfileEditing(false);
                }}
                disabled={isSavingProfile}
                className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleSaveMasterlistProfile()}
                disabled={isSavingProfile || detailsLoading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                {isSavingProfile
                  ? "Saving..."
                  : isConfirmingScholarAgeOut
                    ? "Confirm & Save Changes"
                    : "Save Changes"}
              </button>
            </div>
          ) : (
          <>
          {canReturn && isCorrectionOpen ? (
            <div className="mt-4 w-full animate-in slide-in-from-bottom-2 border-t border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800/50">
              <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200">
                <span className="mb-2 block">Correction notes</span>
                <textarea
                  rows={4}
                  value={correctionNotes}
                  onChange={(event) => setCorrectionNotes(event.target.value)}
                  className="min-h-[100px] w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-sky-500 dark:focus:ring-sky-500/30"
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
                  disabled={isReturning || isRejecting || isPassingDigitalReview || isConfirmingPhysicalCtc}
                  className="inline-flex justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isReturning ? "Returning..." : "Confirm Return"}
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
                disabled={detailsLoading}
                className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Reopen for Resubmission
              </button>
            ) : null}
            {isReturned ? (
              <button
                type="button"
                disabled
                className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-semibold text-slate-400"
              >
                <Clock className="h-4 w-4" aria-hidden="true" />
                Awaiting Youth Re-upload
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
                    disabled={detailsLoading}
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
                    disabled={detailsLoading || isPassingDigitalReview || isConfirmingPhysicalCtc}
                    className="inline-flex justify-center rounded-md border border-rose-200 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50"
                  >
                    Reject Application
                  </button>
                  <button
                    type="button"
                    onClick={handlePassDigitalReview}
                    disabled={detailsLoading || isPassingDigitalReview || isConfirmingPhysicalCtc}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {isPassingDigitalReview ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                    {isPassingDigitalReview ? "Passing..." : "Pass Digital Review"}
                  </button>
                </>
                ) : null}
              </div>
            ) : null}
            {isForPhysicalCtc ? (
              <button
                type="button"
                onClick={handleConfirmPhysicalCtc}
                disabled={detailsLoading || isConfirmingPhysicalCtc || isPassingDigitalReview}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isConfirmingPhysicalCtc ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <CheckCircle2 className="h-4 w-4" aria-hidden="true" />}
                {isConfirmingPhysicalCtc ? "Confirming..." : "Confirm Physical CTC"}
              </button>
            ) : null}

          </div>
          </>
          )}
        </div>
        {canReturn && isRejectionOpen && typeof document !== "undefined"
          ? createPortal(
              <div
                className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm"
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget && !isRejecting) {
                    setIsRejectionOpen(false);
                    setRejectionNotes("");
                    setRejectionError(null);
                  }
                }}
              >
                <section
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="kk-rejection-title"
                  aria-describedby="kk-rejection-description"
                  className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
                >
                  <div className="flex items-start justify-between gap-4 border-b border-rose-100 px-6 py-5">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Application decision</p>
                      <h2 id="kk-rejection-title" className="mt-1 text-lg font-bold text-slate-900">
                        Are you sure you want to reject this application?
                      </h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejectionOpen(false);
                        setRejectionNotes("");
                        setRejectionError(null);
                      }}
                      disabled={isRejecting}
                      className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                      aria-label="Close rejection confirmation"
                    >
                      <X className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </div>
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      void handleReject();
                    }}
                    className="space-y-4 p-6"
                  >
                    <p id="kk-rejection-description" className="text-sm leading-6 text-slate-600">
                      The applicant will see the reason and will not be able to edit or resubmit this registration.
                    </p>
                    <label htmlFor="kk-rejection-reason" className="block text-sm font-semibold text-slate-800">
                      Reason for Rejection <span className="text-rose-700" aria-hidden="true">*</span>
                    </label>
                    <textarea
                      id="kk-rejection-reason"
                      rows={4}
                      required
                      autoFocus
                      aria-invalid={Boolean(rejectionError)}
                      aria-describedby={rejectionError ? "kk-rejection-error" : undefined}
                      value={rejectionNotes}
                      onChange={(event) => setRejectionNotes(event.target.value)}
                      maxLength={1000}
                      disabled={isRejecting}
                      className="min-h-[110px] w-full resize-y rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20 disabled:bg-slate-50"
                      placeholder="For example: Duplicate submission, invalid ID, or residency requirements not met."
                    />
                    {rejectionError ? (
                      <p id="kk-rejection-error" role="alert" className="text-sm text-rose-700">
                        {rejectionError}
                      </p>
                    ) : null}
                    <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setIsRejectionOpen(false);
                          setRejectionNotes("");
                          setRejectionError(null);
                        }}
                        disabled={isRejecting}
                        className="inline-flex justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={
                          isRejecting ||
                          isReturning ||
                          isPassingDigitalReview ||
                          isConfirmingPhysicalCtc ||
                          !rejectionNotes.trim()
                        }
                        className="inline-flex justify-center rounded-xl border border-rose-300 bg-white px-4 py-2.5 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isRejecting ? "Rejecting..." : "Confirm Rejection"}
                      </button>
                    </div>
                  </form>
                </section>
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>,
    document.body,
  );
}
