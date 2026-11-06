"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Archive, FileText, Trash2, X } from "lucide-react";
import { AdminKKProfilingFormView } from "./AdminKKProfilingFormView";
import type { KKProfilingRegistration } from "./types";

interface RegistrationRowActionsProps {
  registration: KKProfilingRegistration;
  onDelete: (id: string) => Promise<void>;
  onArchive?: (id: string) => Promise<void>;
  onUpdate: (registration: KKProfilingRegistration) => void;
  onStatusUpdate: (status: "Approved" | "Returned" | "Rejected", registrationId: string) => void;
  compact?: boolean;
}

export function KKProfilingRowActions({ registration, onDelete, onArchive, onUpdate, onStatusUpdate, compact = false }: RegistrationRowActionsProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [confirmAction, setConfirmAction] = useState<"delete" | "archive" | null>(null);
  const [isConfirmingAction, setIsConfirmingAction] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<KKProfilingRegistration>(registration);
  const isActiveGrantee = ["ACTIVE", "PROBATIONARY"].includes(
    registration.user?.grantee?.status ?? ""
  );

  useEffect(() => {
    setEditForm(registration);
  }, [registration]);

  const handleConfirmAction = async () => {
    setIsConfirmingAction(true);
    setActionError(null);
    try {
      if (onArchive) {
        await onArchive(registration.id);
      } else {
        await onDelete(registration.id);
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
    <div className={`flex items-center ${compact ? "justify-end gap-1.5" : "gap-2"}`}>
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        className={`group inline-flex ${compact ? "h-8 w-8" : "h-10 w-10"} items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50`}
        title="View full form"
      >
        <FileText className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} transition group-hover:text-slate-900`} />
      </button>
      <button
        type="button"
        onClick={() => setConfirmAction(onArchive ? "archive" : "delete")}
        className={`group inline-flex ${compact ? "h-8 w-8" : "h-10 w-10"} items-center justify-center rounded-full border transition ${
          onArchive
            ? "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300 hover:bg-amber-100"
            : "border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100"
        }`}
        title={onArchive ? "Archive profile" : "Delete registration"}
        aria-label={onArchive ? "Archive profile" : "Delete registration"}
      >
        {onArchive ? (
          <Archive className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} transition`} />
        ) : (
          <Trash2 className={`${compact ? "h-3.5 w-3.5" : "h-4 w-4"} transition group-hover:text-red-900`} />
        )}
      </button>

      {showDetails && (
        <AdminKKProfilingFormView
          registration={registration}
          onClose={() => setShowDetails(false)}
          onEdit={() => setShowEdit(true)}
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

      {confirmAction && typeof document !== "undefined" ? createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/45 px-4 py-6 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-confirmation-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-white/70 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.24)]"
          >
            {confirmAction === "archive" ? (
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
                  {isActiveGrantee ? (
                    <div className="mt-3 flex gap-2.5 rounded-xl border border-amber-200/80 bg-amber-50/80 p-3 text-left">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                      <p className="text-sm leading-5 text-amber-950">
                        <span className="font-semibold">Scholarship impact</span>
                        <span className="mt-0.5 block text-amber-900">
                          {registration.fullName} is an active SKEAP grantee. Archiving this profile will also revoke their active scholarship status.
                        </span>
                      </p>
                    </div>
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
                      disabled={isConfirmingAction}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Archive className="h-4 w-4" aria-hidden="true" />
                      {isConfirmingAction ? "Archiving..." : "Archive profile"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="p-6">
                <div className="relative text-center">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="absolute right-0 top-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                    aria-label="Close delete confirmation"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <p className="pr-8 text-sm font-semibold uppercase tracking-[0.32em] text-red-600">
                    Delete registration
                  </p>
                  <h3 id="profile-confirmation-title" className="mt-3 text-center text-lg font-semibold text-slate-900">
                    Are you sure you want to delete this?
                  </h3>
                </div>
                <p className="mt-4 break-words whitespace-normal text-center text-sm leading-relaxed text-slate-600">
                  This will be permanently deleted and cannot be recovered. Please confirm only if you are sure.
                </p>
                {actionError ? <p role="alert" className="mt-3 text-center text-sm text-red-700">{actionError}</p> : null}

                <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => setConfirmAction(null)}
                    className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmAction}
                    disabled={isConfirmingAction}
                    className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                  >
                    {isConfirmingAction ? "Deleting..." : "Yes, delete"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  );
}
