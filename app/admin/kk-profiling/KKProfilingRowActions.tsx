"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { AlertTriangle, Archive, Eye, LockKeyhole, X } from "lucide-react";
import {
  KK_MEMBER_ARCHIVE_REASONS,
  type KKMemberArchiveReasonOption,
} from "@/lib/kk-member-archive";
import { AdminKKProfilingFormView } from "./AdminKKProfilingFormView";
import type { KKProfilingRegistration } from "./types";

interface RegistrationRowActionsProps {
  registration: KKProfilingRegistration;
  onArchive?: (
    id: string,
    reason: KKMemberArchiveReasonOption,
    customReason: string,
  ) => Promise<ArchiveBlocker | void>;
  onUpdate: (registration: KKProfilingRegistration) => void;
  onStatusUpdate: (status: "Approved" | "Returned" | "Rejected" | "For Physical CTC", registrationId: string) => void;
  compact?: boolean;
  cardView?: boolean;
}

interface ArchiveBlocker {
  granteeStatus: string;
  searchQuery: string;
}

export function KKProfilingRowActions({ registration, onArchive, onUpdate, onStatusUpdate, compact = false, cardView = false }: RegistrationRowActionsProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [archiveBlocker, setArchiveBlocker] = useState<ArchiveBlocker | null>(null);
  const [confirmAction, setConfirmAction] = useState<"archive" | null>(null);
  const [archiveReason, setArchiveReason] = useState<KKMemberArchiveReasonOption | "">("");
  const [customArchiveReason, setCustomArchiveReason] = useState("");
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<KKProfilingRegistration>(registration);
  const granteeStatus = (registration.user?.grantee?.status ?? registration.skeapStatus)?.toUpperCase();
  const isActiveGrantee = granteeStatus === "ACTIVE" || granteeStatus === "PROBATIONARY";
  const profileName = registration.user?.kkProfile ?? registration.kkProfile;
  const profileSearchQuery = [
    profileName?.lastName,
    profileName?.firstName,
    profileName?.middleName,
  ]
    .filter((name): name is string => Boolean(name?.trim()))
    .join(" ")
    .replace(/[.,]/g, " ")
    .replace(/\s+/g, " ")
    .trim() ||
    (profileName?.fullName ?? registration.fullName)
      .replace(/[.,]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const handleConfirmAction = async () => {
    const isCustomReasonValid =
      archiveReason !== "Other (Specify)" || Boolean(customArchiveReason.trim());
    if (!onArchive || !archiveReason || !isCustomReasonValid) return;
    setIsConfirmingAction(true);
    setActionError(null);
    try {
      const result = await onArchive(registration.id, archiveReason, customArchiveReason);
      if (result) {
        setArchiveBlocker(result);
        setConfirmAction(null);
        return;
      }
      setConfirmAction(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setIsConfirmingAction(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setEditError(null);

    try {
      const response = await fetch(`/api/admin/kk-profiling/${registration.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editForm,
          age: Number(editForm.age),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || "Failed to save registration");
      }

      onUpdate(data as KKProfilingRegistration);
      setShowEdit(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Failed to save registration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={`flex items-center justify-end ${compact ? "gap-1.5" : "gap-2"}`}>
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        className={`inline-flex ${
          onArchive
            ? cardView
              ? "h-9 w-9 rounded-lg"
              : compact
                ? "h-8 w-8 rounded-full"
                : "h-10 w-10 rounded-full"
            : "gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium"
        } items-center justify-center text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600`}
        title={`View details for ${registration.fullName} application`}
        aria-label={`View details for ${registration.fullName} application`}
      >
        <Eye className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} transition`} aria-hidden="true" />
        {!onArchive ? <span className="leading-none">View</span> : null}
      </button>
      {onArchive ? (
        isActiveGrantee ? (
          <button
            type="button"
            onClick={() => setArchiveBlocker({
              granteeStatus: granteeStatus ?? "ACTIVE",
              searchQuery: profileSearchQuery,
            })}
            className={`group inline-flex ${cardView ? "h-9 w-9 rounded-lg" : compact ? "h-8 w-8 rounded-full" : "h-10 w-10 rounded-full"} items-center justify-center border border-slate-200 bg-slate-100 text-slate-500 transition hover:bg-slate-200`}
            title="Active SKEAP grantees must be managed in Active Grantees first"
            aria-label="Active SKEAP grantee archive restriction"
          >
            <LockKeyhole className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} transition`} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              setArchiveReason("");
              setCustomArchiveReason("");
              setConfirmAction("archive");
            }}
            className={`group inline-flex ${cardView ? "h-9 w-9 rounded-lg" : compact ? "h-8 w-8 rounded-full" : "h-10 w-10 rounded-full"} items-center justify-center border border-amber-200 bg-amber-50 text-amber-700 transition hover:border-amber-300 hover:bg-amber-100`}
            title="Archive profile"
            aria-label="Archive profile"
          >
            <Archive className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} transition`} aria-hidden="true" />
          </button>
        )
      ) : null}

      {showDetails && (
        <AdminKKProfilingFormView
          registration={registration}
          onClose={() => setShowDetails(false)}
          editInView={Boolean(onArchive)}
          onEdit={onArchive
            ? undefined
            : () => {
                setEditForm(registration);
                setShowEdit(true);
              }}
          onReturn={(updatedRegistration) => {
            onUpdate(updatedRegistration);
          }}
          onStatusUpdate={onStatusUpdate}
        />
      )}

      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="relative max-h-[90vh] w-full max-w-3xl overflow-auto rounded-[1.75rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Edit registration</h3>
                <p className="mt-1 text-sm text-slate-500">Update youth participant details and save changes.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowEdit(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close edit modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-6 grid gap-4">
              {editError ? (
                <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  {editError}
                </div>
              ) : null}

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Complete Name</span>
                <input
                  value={editForm.fullName}
                  onChange={(e) => setEditForm((current) => ({ ...current, fullName: e.target.value }))}
                  className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Email</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((current) => ({ ...current, email: e.target.value }))}
                  className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Address</span>
                <input
                  value={editForm.address}
                  onChange={(e) => setEditForm((current) => ({ ...current, address: e.target.value }))}
                  className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Sex</span>
                  <input
                    value={editForm.sex}
                    onChange={(e) => setEditForm((current) => ({ ...current, sex: e.target.value }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Age</span>
                  <input
                    type="number"
                    min={0}
                    value={editForm.age}
                    onChange={(e) => setEditForm((current) => ({ ...current, age: Number(e.target.value) }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Birth Date</span>
                  <input
                    type="date"
                    value={new Date(editForm.birthDate).toISOString().slice(0, 10)}
                    onChange={(e) => setEditForm((current) => ({ ...current, birthDate: e.target.value }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
              </div>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Facebook Account</span>
                <input
                  value={editForm.facebook}
                  onChange={(e) => setEditForm((current) => ({ ...current, facebook: e.target.value }))}
                  className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Contact Number</span>
                <input
                  value={editForm.contactNumber}
                  onChange={(e) => setEditForm((current) => ({ ...current, contactNumber: e.target.value }))}
                  className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Civil Status</span>
                <input
                  value={editForm.civilStatus}
                  onChange={(e) => setEditForm((current) => ({ ...current, civilStatus: e.target.value }))}
                  className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Youth Classification</span>
                  <input
                    value={editForm.youthClassification}
                    onChange={(e) => setEditForm((current) => ({ ...current, youthClassification: e.target.value }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Youth Age Group</span>
                  <input
                    value={editForm.youthAgeGroup}
                    onChange={(e) => setEditForm((current) => ({ ...current, youthAgeGroup: e.target.value }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
              </div>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Work Status</span>
                <input
                  value={editForm.workStatus}
                  onChange={(e) => setEditForm((current) => ({ ...current, workStatus: e.target.value }))}
                  className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                />
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Educational Background</span>
                <input
                  value={editForm.educationalBackground}
                  onChange={(e) => setEditForm((current) => ({ ...current, educationalBackground: e.target.value }))}
                  className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                />
              </label>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Registered SK Voter?</span>
                  <input
                    value={editForm.registeredSKVoter}
                    onChange={(e) => setEditForm((current) => ({ ...current, registeredSKVoter: e.target.value }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Voted last SK?</span>
                  <input
                    value={editForm.votedLastSK}
                    onChange={(e) => setEditForm((current) => ({ ...current, votedLastSK: e.target.value }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Registered Natl. Voter?</span>
                  <input
                    value={editForm.registeredNationalVoter}
                    onChange={(e) => setEditForm((current) => ({ ...current, registeredNationalVoter: e.target.value }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
              </div>

              <label className="flex items-center gap-3 rounded-lg border px-3 py-3 bg-slate-50">
                <input
                  type="checkbox"
                  checked={!!editForm.consent}
                  onChange={(e) => setEditForm((current) => ({ ...current, consent: e.target.checked }))}
                  className="h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <span className="text-sm text-slate-700">Consent recorded</span>
              </label>

              <label className="flex flex-col">
                <span className="text-sm font-semibold">Attended KK Assembly?</span>
                <input
                  value={editForm.attendedKKAssembly}
                  onChange={(e) => setEditForm((current) => ({ ...current, attendedKKAssembly: e.target.value }))}
                  className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                />
              </label>

              {editForm.attendedKKAssembly === "Yes" ? (
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">If Yes, how many times?</span>
                  <input
                    value={editForm.assemblyTimes ?? ""}
                    onChange={(e) => setEditForm((current) => ({ ...current, assemblyTimes: e.target.value }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
              ) : null}

              {editForm.attendedKKAssembly === "No" ? (
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">If No, why?</span>
                  <input
                    value={editForm.noAssemblyReason ?? ""}
                    onChange={(e) => setEditForm((current) => ({ ...current, noAssemblyReason: e.target.value }))}
                    className="mt-1 rounded-lg border px-3 py-2 text-sm text-slate-700"
                  />
                </label>
              ) : null}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setShowEdit(false)}
                  className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={isSaving}
                  className="inline-flex justify-center rounded-full bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {archiveBlocker && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="active-grantee-archive-title"
            className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
          >
            <div className="h-1 w-full bg-gradient-to-r from-cyan-500 to-slate-800" />
            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 id="active-grantee-archive-title" className="text-lg font-bold tracking-tight text-slate-900">
                    {archiveBlocker.granteeStatus === "GRADUATED"
                      ? "View in Graduated Grantees"
                      : archiveBlocker.granteeStatus === "REVOKED" || archiveBlocker.granteeStatus === "REMOVED"
                        ? "View in Revoked Grantees"
                        : "Manage in Grantees first"}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {archiveBlocker.granteeStatus === "GRADUATED"
                      ? "This scholar’s record is in the graduated grantee archive."
                      : archiveBlocker.granteeStatus === "REVOKED" || archiveBlocker.granteeStatus === "REMOVED"
                        ? "This scholar’s record is in the revoked grantee list."
                        : "This youth is currently an Active SKEAP Grantee. Update or close their scholarship status in Grantees before archiving their KK profile."}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setArchiveBlocker(null)}
                  className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close grantee notice"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <div className="mt-5 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setArchiveBlocker(null)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <Link
                  href={getArchiveBlockerHref(archiveBlocker)}
                  className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  {getArchiveBlockerLabel(archiveBlocker)} →
                </Link>
              </div>
            </div>
          </section>
        </div>,
        document.body,
      ) : null}

      {confirmAction && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-confirmation-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
          >
            <>
                <div className="h-1 w-full bg-gradient-to-r from-amber-300 via-orange-400 to-amber-500" />
                <div className="p-5">
                  <div className="flex items-start gap-3 text-left">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-100">
                      <Archive className="h-[18px] w-[18px]" aria-hidden="true" />
                    </div>
                    <div className="min-w-0 pt-0.5">
                      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-amber-700">Member record</p>
                      <h3 id="profile-confirmation-title" className="mt-1 text-lg font-bold tracking-tight text-slate-900">
                        Archive this profile?
                      </h3>
                      <p className="mt-1.5 text-sm leading-5 text-slate-600">
                        <span className="font-semibold text-slate-800">{registration.fullName}</span>&apos;s profile will be removed from active Members reports. The record will remain available for audit purposes.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="shrink-0 rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                      aria-label="Close archive confirmation"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <label className="mt-4 block text-left">
                    <span className="mb-1.5 block text-xs font-semibold text-slate-700">Archive reason</span>
                    <select
                      value={archiveReason}
                      onChange={(event) => {
                        const value = event.target.value;
                        setArchiveReason(
                          KK_MEMBER_ARCHIVE_REASONS.find((reason) => reason === value) ?? "",
                        );
                        setCustomArchiveReason("");
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10"
                    >
                      <option value="">Select a reason</option>
                      {KK_MEMBER_ARCHIVE_REASONS.map((reason) => (
                        <option key={reason} value={reason}>
                          {reason}
                        </option>
                      ))}
                    </select>
                    <div
                      className={`overflow-hidden transition-[max-height,opacity,margin] duration-200 ease-out ${
                        archiveReason === "Other (Specify)"
                          ? "mt-2 max-h-16 opacity-100"
                          : "max-h-0 opacity-0"
                      }`}
                      aria-hidden={archiveReason !== "Other (Specify)"}
                    >
                      <input
                        type="text"
                        value={customArchiveReason}
                        onChange={(event) => setCustomArchiveReason(event.target.value)}
                        placeholder="Specify archive reason..."
                        maxLength={120}
                        required={archiveReason === "Other (Specify)"}
                        disabled={archiveReason !== "Other (Specify)"}
                        aria-label="Specify archive reason"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/10"
                      />
                    </div>
                  </label>
                  {archiveReason ? (
                    <p aria-live="polite" className="mt-2 text-xs leading-5 text-slate-500">
                      {archiveReason === "Transferred Residence"
                        ? "Resident relocated outside Barangay Pico. An automated notice will be sent to their SKonnect account and email."
                        : archiveReason === "Voluntary Withdrawal / Opt-Out"
                          ? "Resident requested removal from active SK rosters (RA 10173). An automated confirmation will be sent to their SKonnect account and email."
                          : archiveReason === "Duplicate or Invalid Record"
                            ? "Double entry or unverified non-resident account. An automated notice will be sent to their SKonnect account and email."
                            : archiveReason === "Deceased"
                              ? "Vital status record update for SK audit history. No email or in-app notification will be sent to this account."
                              : "Custom administrative archive reason. An automated notice will be sent to their SKonnect account and email."}
                    </p>
                  ) : null}
                  {actionError ? (
                    <p role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      {actionError}
                    </p>
                  ) : null}
                  <div className="mt-4 flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setConfirmAction(null)}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmAction}
                      disabled={
                        isConfirmingAction ||
                        !archiveReason ||
                        (archiveReason === "Other (Specify)" && !customArchiveReason.trim())
                      }
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      {isConfirmingAction ? "Archiving..." : "Archive profile"}
                    </button>
                  </div>
                </div>
            </>
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}

function getArchiveBlockerHref(blocker: ArchiveBlocker) {
  const search = blocker.searchQuery.trim();
  const encodedSearch = search ? `?search=${encodeURIComponent(search)}` : "";
  if (blocker.granteeStatus === "GRADUATED") return `/admin/grantees/records${encodedSearch}`;
  if (blocker.granteeStatus === "REVOKED" || blocker.granteeStatus === "REMOVED") {
    return `/admin/skeap/revoked${encodedSearch}`;
  }
  return `/admin/grantees${encodedSearch}`;
}

function getArchiveBlockerLabel(blocker: ArchiveBlocker) {
  if (blocker.granteeStatus === "GRADUATED") return "Go to Graduated Grantees";
  if (blocker.granteeStatus === "REVOKED" || blocker.granteeStatus === "REMOVED") {
    return "Go to Revoked Grantees";
  }
  return "Go to Grantees";
}
