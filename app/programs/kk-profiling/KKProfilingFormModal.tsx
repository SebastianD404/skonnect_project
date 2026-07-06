"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { X } from "lucide-react";

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

type SelectedFiles = {
  front?: File | null;
  back?: File | null;
  single?: File | null;
};

type PreviewUrls = {
  front?: string;
  back?: string;
  single?: string;
};

type Props = {
  isOpen: boolean;
  registration: KKProfilingRegistrationData;
  onClose: () => void;
  onSaved: (updated: KKProfilingRegistrationData) => void;
};

function computeAgeFromBirthDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return "";
  }

  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(birthDate.getTime())) {
    return "";
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  let age = currentYear - birthDate.getUTCFullYear();
  if (currentMonth < birthDate.getUTCMonth() || (currentMonth === birthDate.getUTCMonth() && currentDay < birthDate.getUTCDate())) {
    age -= 1;
  }

  return age >= 0 ? String(age) : "";
}

export default function KKProfilingFormModal({ isOpen, registration, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    fullName: registration.fullName ?? "",
    address: registration.address ?? "",
    sex: registration.sex ?? "",
    age: registration.age ? String(registration.age) : "",
    birthDate: registration.birthDate ? registration.birthDate.slice(0, 10) : "",
    email: registration.email ?? "",
    facebook: registration.facebook ?? "",
    contactNumber: registration.contactNumber ?? "",
    civilStatus: registration.civilStatus ?? "",
    youthClassification: registration.youthClassification ?? "",
    youthAgeGroup: registration.youthAgeGroup ?? "",
    workStatus: registration.workStatus ?? "",
    educationalBackground: registration.educationalBackground ?? "",
    registeredSKVoter: registration.registeredSKVoter ?? "",
    votedLastSK: registration.votedLastSK ?? "",
    registeredNationalVoter: registration.registeredNationalVoter ?? "",
    attendedKKAssembly: registration.attendedKKAssembly ?? "",
    assemblyTimes: registration.assemblyTimes ?? "",
    noAssemblyReason: registration.noAssemblyReason ?? "",
  });
  const [idDocumentType, setIdDocumentType] = useState(registration.idDocumentType ?? "Valid ID");
  const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({ front: null, back: null, single: null });
  const [previewUrls, setPreviewUrls] = useState<PreviewUrls>({});
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [previewModalAlt, setPreviewModalAlt] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      fullName: registration.fullName ?? "",
      address: registration.address ?? "",
      sex: registration.sex ?? "",
      age: registration.age ? String(registration.age) : "",
      birthDate: registration.birthDate ? registration.birthDate.slice(0, 10) : "",
      email: registration.email ?? "",
      facebook: registration.facebook ?? "",
      contactNumber: registration.contactNumber ?? "",
      civilStatus: registration.civilStatus ?? "",
      youthClassification: registration.youthClassification ?? "",
      youthAgeGroup: registration.youthAgeGroup ?? "",
      workStatus: registration.workStatus ?? "",
      educationalBackground: registration.educationalBackground ?? "",
      registeredSKVoter: registration.registeredSKVoter ?? "",
      votedLastSK: registration.votedLastSK ?? "",
      registeredNationalVoter: registration.registeredNationalVoter ?? "",
      attendedKKAssembly: registration.attendedKKAssembly ?? "",
      assemblyTimes: registration.assemblyTimes ?? "",
      noAssemblyReason: registration.noAssemblyReason ?? "",
    });
    setIdDocumentType(registration.idDocumentType ?? "Valid ID");
    setSelectedFiles({ front: null, back: null, single: null });
    setMessage(null);
  }, [registration]);

  useEffect(() => {
    const urls: PreviewUrls = {};

    if (selectedFiles.front) {
      urls.front = URL.createObjectURL(selectedFiles.front);
    }
    if (selectedFiles.back) {
      urls.back = URL.createObjectURL(selectedFiles.back);
    }
    if (selectedFiles.single) {
      urls.single = URL.createObjectURL(selectedFiles.single);
    }

    setPreviewUrls(urls);
    return () => {
      Object.values(urls).forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [selectedFiles.front, selectedFiles.back, selectedFiles.single]);

  if (!isOpen) {
    return null;
  }

  function setField<Key extends keyof typeof form>(key: Key, value: typeof form[Key]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleBirthDateChange(value: string) {
    setForm((current) => ({
      ...current,
      birthDate: value,
      age: computeAgeFromBirthDate(value),
    }));
  }

  function handleIdDocumentTypeChange(value: string) {
    setIdDocumentType(value);
    if (value === "Valid ID") {
      setSelectedFiles({ front: null, back: null, single: null });
    } else {
      setSelectedFiles({ single: null, front: null, back: null });
    }
  }

  function handleFileChange(field: keyof SelectedFiles, file: File | null) {
    setSelectedFiles((current) => ({
      ...current,
      [field]: file,
    }));
  }

  function removeFile(field: keyof SelectedFiles) {
    setSelectedFiles((current) => ({
      ...current,
      [field]: null,
    }));
  }

  function openPreviewModal(url: string, alt: string) {
    setPreviewModalUrl(url);
    setPreviewModalAlt(alt);
  }

  function closePreviewModal() {
    setPreviewModalUrl(null);
    setPreviewModalAlt("");
  }

  function fileLabel(field: keyof SelectedFiles) {
    if (field === "front") return "Front of ID";
    if (field === "back") return "Back of ID";
    return "Document file";
  }

  function renderPreview(field: keyof SelectedFiles, file: File | null) {
    if (!file) {
      return null;
    }

    const url = previewUrls[field];
    const isImage = file.type.startsWith("image/");
    const isTooLarge = file.size > 10 * 1024 * 1024;

    return (
      <div className="mt-3 grid gap-3 text-sm text-slate-700">
        {isImage && url ? (
          <button
            type="button"
            onClick={() => openPreviewModal(url, `${fileLabel(field)} preview`)}
            className="group inline-flex h-24 w-24 overflow-hidden rounded-2xl bg-slate-100 p-1 text-left transition hover:shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-500"
          >
            <img src={url} alt={`${fileLabel(field)} preview`} className="h-full w-full rounded-2xl object-contain" />
          </button>
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-600">
            {file.name}
          </div>
        )}
        <div className="grid gap-1 text-xs text-slate-500">
          <div className="font-semibold text-slate-900">{fileLabel(field)}</div>
          <div className="flex flex-wrap gap-2 text-xs text-slate-500">
            <span>{formatBytes(file.size)}</span>
            <span>·</span>
            <span>{file.type || "Unknown format"}</span>
          </div>
        </div>
        {isTooLarge ? (
          <p className="rounded-xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700">
            File exceeds the 10MB limit. Please select a smaller file.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => removeFile(field)}
          className="inline-flex items-center justify-center rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
        >
          Remove
        </button>
      </div>
    );
  }

  function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  function validate() {
    if (!form.fullName.trim()) return "Full name is required.";
    if (!form.address.trim()) return "Address is required.";
    if (!form.sex.trim()) return "Sex is required.";
    if (!form.birthDate.trim()) return "Birth date is required.";
    if (!form.email.trim()) return "Email is required.";
    if (!form.contactNumber.trim()) return "Contact number is required.";
    if (!form.civilStatus.trim()) return "Civil status is required.";
    if (!form.youthClassification.trim()) return "Youth classification is required.";
    if (!form.youthAgeGroup.trim()) return "Youth age group is required.";
    if (!form.workStatus.trim()) return "Work status is required.";
    if (!form.educationalBackground.trim()) return "Educational background is required.";
    if (!form.registeredSKVoter.trim()) return "Registered SK voter status is required.";
    if (!form.votedLastSK.trim()) return "SK election participation is required.";
    if (!form.registeredNationalVoter.trim()) return "National voter status is required.";
    if (!form.attendedKKAssembly.trim()) return "KK Assembly attendance is required.";
    if (form.attendedKKAssembly === "Yes" && !form.assemblyTimes?.trim()) return "Please indicate how many assemblies you attended.";
    if (form.attendedKKAssembly === "No" && !form.noAssemblyReason?.trim()) return "Please explain why you did not attend a KK Assembly.";
    if (idDocumentType === "Valid ID") {
      if (!selectedFiles.front && !registration.idFrontFileUrl) return "Please upload the front of your valid ID.";
      if (!selectedFiles.back && !registration.idBackFileUrl) return "Please upload the back of your valid ID.";
    } else {
      if (!selectedFiles.single && !registration.idSingleFileUrl) return "Please upload your supporting document.";
    }
    return null;
  }

  async function handleSave() {
    setMessage(null);
    const validationError = validate();
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setIsSaving(true);
    try {
      const formData = new FormData();
      formData.append("fullName", form.fullName);
      formData.append("address", form.address);
      formData.append("sex", form.sex);
      formData.append("age", String(Number(form.age) || 0));
      formData.append("birthDate", form.birthDate);
      formData.append("email", form.email);
      formData.append("facebook", form.facebook);
      formData.append("contactNumber", form.contactNumber);
      formData.append("civilStatus", form.civilStatus);
      formData.append("youthClassification", form.youthClassification);
      formData.append("youthAgeGroup", form.youthAgeGroup);
      formData.append("workStatus", form.workStatus);
      formData.append("educationalBackground", form.educationalBackground);
      formData.append("registeredSKVoter", form.registeredSKVoter);
      formData.append("votedLastSK", form.votedLastSK);
      formData.append("registeredNationalVoter", form.registeredNationalVoter);
      formData.append("attendedKKAssembly", form.attendedKKAssembly);
      formData.append("assemblyTimes", form.assemblyTimes ?? "");
      formData.append("noAssemblyReason", form.noAssemblyReason ?? "");
      formData.append("documentType", idDocumentType);

      if (idDocumentType === "Valid ID") {
        if (selectedFiles.front) {
          formData.append("frontFile", selectedFiles.front);
        }
        if (selectedFiles.back) {
          formData.append("backFile", selectedFiles.back);
        }
      } else {
        if (selectedFiles.single) {
          formData.append("file", selectedFiles.single);
        }
      }

      const response = await fetch("/api/programs/kk-profiling/registration-with-id", {
        method: "PUT",
        body: formData,
      });

      const body = await response.json();
      if (!response.ok) {
        setMessage(body.error || "Unable to save changes. Please try again.");
        return;
      }

      onSaved({
        ...registration,
        ...body,
      });
      onClose();
    } catch (error) {
      setMessage("Unable to save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
      <div className="relative mx-auto w-full max-w-5xl overflow-hidden rounded-[2rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
          <div>
            <h2 className="text-xl font-semibold text-slate-950">KK Profiling Registration</h2>
            <p className="mt-1 text-sm text-slate-500">Review and edit your submitted registration details.</p>
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
        <div className="max-h-[80vh] overflow-y-auto p-6">
          {message ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {message}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Full name</span>
              <input
                value={form.fullName}
                onChange={(e) => setField("fullName", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
            <label className="flex flex-col sm:col-span-2">
              <span className="text-sm font-semibold">Address</span>
              <input
                value={form.address}
                onChange={(e) => setField("address", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Sex</span>
              <select
                value={form.sex}
                onChange={(e) => setField("sex", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Select</option>
                <option>Male</option>
                <option>Female</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Birth date</span>
              <input
                type="date"
                min="1995-01-01"
                max={`${new Date().getFullYear()}-12-31`}
                value={form.birthDate}
                onChange={(event) => {
                  const value = event.target.value;
                  const selectedYear = Number(value.slice(0, 4));
                  const currentYear = new Date().getFullYear();
                  if (value >= "1995-01-01" && value <= `${currentYear}-12-31` && selectedYear < currentYear) {
                    handleBirthDateChange(value);
                  }
                }}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Age</span>
              <input
                type="number"
                value={form.age}
                readOnly
                className="mt-1 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm text-slate-600"
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Email address</span>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setField("email", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Facebook account</span>
              <input
                value={form.facebook}
                onChange={(e) => setField("facebook", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
          </div>

          <label className="flex flex-col">
            <span className="text-sm font-semibold">Contact number</span>
            <input
              value={form.contactNumber}
              onChange={(e) => setField("contactNumber", e.target.value)}
              className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            />
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Civil status</span>
              <select
                value={form.civilStatus}
                onChange={(e) => setField("civilStatus", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Select</option>
                <option>Single</option>
                <option>Married</option>
                <option>Widowed</option>
                <option>Divorced</option>
                <option>Separated</option>
                <option>Annulled</option>
                <option>Live-in</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Youth classification</span>
              <select
                value={form.youthClassification}
                onChange={(e) => setField("youthClassification", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Select</option>
                <option>In school Youth</option>
                <option>Out of School Youth</option>
                <option>Working Youth</option>
                <option>Person w/ Disability</option>
                <option>Children In Conflict with Law</option>
                <option>Indigenous People</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Youth age group</span>
              <select
                value={form.youthAgeGroup}
                onChange={(e) => setField("youthAgeGroup", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Select</option>
                <option>Child Youth (15-17 yrs old)</option>
                <option>Core Youth (18-24 yrs old)</option>
                <option>Young Adult (15-30 yrs old)</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Work status</span>
              <select
                value={form.workStatus}
                onChange={(e) => setField("workStatus", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Select</option>
                <option>Employed</option>
                <option>Unemployed</option>
                <option>Self-Employed</option>
                <option>Currently looking for a Job</option>
                <option>Not Interested Looking for a Job</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col">
            <span className="text-sm font-semibold">Educational background</span>
            <select
              value={form.educationalBackground}
              onChange={(e) => setField("educationalBackground", e.target.value)}
              className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="">Select</option>
              <option>Elementary Level</option>
              <option>Elementary Graduate</option>
              <option>High school Level</option>
              <option>High school Graduate</option>
              <option>Vocational Graduate</option>
              <option>College Level</option>
              <option>College Graduate</option>
              <option>Masters Level</option>
              <option>Masters Graduate</option>
              <option>Doctorate Level</option>
              <option>Doctorate Graduate</option>
            </select>
          </label>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Registered SK voter?</span>
              <select
                value={form.registeredSKVoter}
                onChange={(e) => setField("registeredSKVoter", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Voted last SK election?</span>
              <select
                value={form.votedLastSK}
                onChange={(e) => setField("votedLastSK", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              >
                <option value="">Select</option>
                <option>Yes</option>
                <option>No</option>
              </select>
            </label>
          </div>

          <label className="flex flex-col">
            <span className="text-sm font-semibold">Registered national voter?</span>
            <select
              value={form.registeredNationalVoter}
              onChange={(e) => setField("registeredNationalVoter", e.target.value)}
              className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="">Select</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </label>

          <label className="flex flex-col">
            <span className="text-sm font-semibold">Attended KK Assembly?</span>
            <select
              value={form.attendedKKAssembly}
              onChange={(e) => setField("attendedKKAssembly", e.target.value)}
              className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
            >
              <option value="">Select</option>
              <option>Yes</option>
              <option>No</option>
            </select>
          </label>

          {form.attendedKKAssembly === "Yes" ? (
            <label className="flex flex-col">
              <span className="text-sm font-semibold">If yes, how many times</span>
              <input
                value={form.assemblyTimes ?? ""}
                onChange={(e) => setField("assemblyTimes", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
          ) : null}

          {form.attendedKKAssembly === "No" ? (
            <label className="flex flex-col">
              <span className="text-sm font-semibold">If no, why</span>
              <input
                value={form.noAssemblyReason ?? ""}
                onChange={(e) => setField("noAssemblyReason", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </label>
          ) : null}

          <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-4">
              <label className="flex flex-col gap-2 text-sm">
                <span className="font-semibold">Identification document type</span>
                <select
                  value={idDocumentType}
                  onChange={(e) => handleIdDocumentTypeChange(e.target.value)}
                  className="rounded-2xl border border-slate-300 bg-white px-4 py-3"
                >
                  <option>Valid ID</option>
                  <option>Birth Certificate</option>
                  <option>Other supporting document</option>
                </select>
              </label>

              {idDocumentType === "Valid ID" ? (
                <div className="space-y-3 rounded-[1.5rem] border border-slate-300 bg-white p-4">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">Currently on file</p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">Valid ID</p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {registration.idFrontFileUrl ? (
                        <button
                          type="button"
                          onClick={() => openPreviewModal(registration.idFrontFileUrl ?? "", "Front of ID")}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                        >
                          <span>📄</span> View front
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">No front file</span>
                      )}
                      {registration.idBackFileUrl ? (
                        <button
                          type="button"
                          onClick={() => openPreviewModal(registration.idBackFileUrl ?? "", "Back of ID")}
                          className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                        >
                          <span>📄</span> View back
                        </button>
                      ) : (
                        <span className="text-xs text-slate-500">No back file</span>
                      )}
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedFiles.front || selectedFiles.back ? "📸 Replacement files selected" : "Upload replacement"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {selectedFiles.front || selectedFiles.back
                        ? "Your new files will replace the current ones on file."
                        : "Select new files to update your identification documents."}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 rounded-[1.5rem] border border-slate-300 bg-white p-4">
                  <div className="text-sm">
                    <p className="font-semibold text-slate-900">Currently on file</p>
                    <p className="mt-2 text-xs uppercase tracking-wide text-slate-500">{registration.idDocumentType || "Not uploaded"}</p>
                    {registration.idSingleFileUrl ? (
                      <button
                        type="button"
                        onClick={() => openPreviewModal(registration.idSingleFileUrl ?? "", "Uploaded document")}
                        className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                      >
                        <span>📄</span> View document
                      </button>
                    ) : (
                      <span className="mt-3 block text-xs text-slate-500">No document on file</span>
                    )}
                  </div>

                  <div className="border-t border-slate-200 pt-3">
                    <p className="text-sm font-semibold text-slate-900">
                      {selectedFiles.single ? "📸 Replacement file selected" : "Upload replacement"}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {selectedFiles.single
                        ? "Your new file will replace the current document on file."
                        : "Select a new file to update your supporting document."}
                    </p>
                  </div>
                </div>
              )}

              {idDocumentType === "Valid ID" ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="flex flex-col gap-3 rounded-[1.75rem] bg-white p-4 shadow-sm">
                    <span className="font-semibold text-slate-900">Front of ID</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFileChange("front", event.target.files?.[0] ?? null)}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    />
                    {renderPreview("front", selectedFiles.front ?? null)}
                  </label>
                  <label className="flex flex-col gap-3 rounded-[1.75rem] bg-white p-4 shadow-sm">
                    <span className="font-semibold text-slate-900">Back of ID</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => handleFileChange("back", event.target.files?.[0] ?? null)}
                      className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                    />
                    {renderPreview("back", selectedFiles.back ?? null)}
                  </label>
                </div>
              ) : (
                <label className="flex flex-col gap-3 rounded-[1.75rem] bg-white p-4 shadow-sm">
                  <span className="font-semibold text-slate-900">Document file</span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(event) => handleFileChange("single", event.target.files?.[0] ?? null)}
                    className="rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm"
                  />
                  {renderPreview("single", selectedFiles.single ?? null)}
                </label>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:justify-between sm:items-center">
          <p className="text-sm text-slate-600">Your current status: <strong>{registration.reviewStatus}</strong></p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="inline-flex justify-center rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save changes & Resubmit"}
            </button>
          </div>
        </div>
      </div>

      {previewModalUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="relative mx-auto max-w-2xl rounded-[2rem] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-5">
              <h3 className="text-lg font-semibold text-slate-950">{previewModalAlt}</h3>
              <button
                type="button"
                onClick={closePreviewModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition hover:bg-slate-200"
                aria-label="Close preview"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex items-center justify-center bg-slate-50 p-6">
              <img
                src={previewModalUrl}
                alt={previewModalAlt}
                className="max-h-96 max-w-full rounded-2xl object-contain"
              />
            </div>
            <div className="flex justify-end border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closePreviewModal}
                className="inline-flex justify-center rounded-2xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
