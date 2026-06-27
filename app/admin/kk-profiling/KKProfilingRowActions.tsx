"use client";

import { useEffect, useState } from "react";
import { FileText, Trash2, X } from "lucide-react";
import { AdminKKProfilingFormView } from "./AdminKKProfilingFormView";

interface Registration {
  id: string;
  fullName: string;
  email: string;
  address: string;
  sex: string;
  age: number;
  birthDate: string;
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
  consent?: boolean;
  submittedAt: string;
}

interface RegistrationRowActionsProps {
  registration: Registration;
  onDelete: (id: string) => Promise<void>;
  onUpdate: (registration: Registration) => void;
}

export function KKProfilingRowActions({ registration, onDelete, onUpdate }: RegistrationRowActionsProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Registration>(registration);

  useEffect(() => {
    setEditForm(registration);
  }, [registration]);

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onDelete(registration.id);
    } finally {
      setIsDeleting(false);
      setShowConfirmDelete(false);
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

      onUpdate(data as Registration);
      setShowEdit(false);
    } catch (error) {
      setEditError(error instanceof Error ? error.message : "Failed to save registration");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setShowDetails(true)}
        className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
        title="View full form"
      >
        <FileText className="h-4 w-4 transition group-hover:text-slate-900" />
      </button>
      <button
        type="button"
        onClick={() => setShowConfirmDelete(true)}
        className="group inline-flex h-10 w-10 items-center justify-center rounded-full border border-red-200 bg-red-50 text-red-700 transition hover:border-red-300 hover:bg-red-100"
        title="Delete registration"
      >
        <Trash2 className="h-4 w-4 transition group-hover:text-red-900" />
      </button>

      {showDetails && (
        <AdminKKProfilingFormView
          registration={registration}
          onClose={() => setShowDetails(false)}
          onEdit={() => setShowEdit(true)}
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

      {showConfirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="w-full max-w-lg rounded-[1.75rem] bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.32em] text-red-600">Delete registration</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-950">Are you sure you want to delete this?</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close delete confirmation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-600">
              This will be permanently deleted and cannot be recovered. Please confirm only if you are sure.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShowConfirmDelete(false)}
                className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isDeleting}
                className="inline-flex justify-center rounded-full bg-red-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Yes, delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
