"use client";

import { useEffect, useState } from "react";
import { ExternalLink, FileImage, UploadCloud, X } from "lucide-react";
import { OFFICIAL_SITIOS } from "@/lib/kk";

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
  residencyStatementAcknowledgement?: boolean;
  reviewStatus: string;
  submittedAt?: string | null;
};

type SelectedFiles = {
  front?: File | null;
  back?: File | null;
  single?: File | null;
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

function splitEditName(fullName: string) {
  const parts = fullName.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  return {
    firstName: parts[0] ?? "",
    lastName: parts.length > 1 ? parts[parts.length - 1] : "",
    middleName: parts.length > 2 ? parts.slice(1, -1).join(" ") : "",
  };
}

function splitEditAddress(address: string) {
  const parts = address.split(",").map((part) => part.trim()).filter(Boolean);
  const sitioIndex = parts.findIndex((part) => OFFICIAL_SITIOS.some((sitio) => sitio.toLowerCase() === part.toLowerCase()));
  return {
    sitio: sitioIndex >= 0 ? parts[sitioIndex] : parts[0] ?? "",
    barangay: parts.find((part) => /pico/i.test(part)) ?? "Pico",
    municipality: parts.find((part) => /la trinidad/i.test(part)) ?? "La Trinidad",
    province: parts.find((part) => /benguet/i.test(part)) ?? "Benguet",
  };
}

function getEditFormValues(registration: KKProfilingRegistrationData) {
  const name = splitEditName(registration.fullName ?? "");
  const address = splitEditAddress(registration.address ?? "");
  return {
    ...name,
    ...address,
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
  };
}

export default function KKProfilingFormModal({ isOpen, registration, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => getEditFormValues(registration));
  const [selectedFiles, setSelectedFiles] = useState<SelectedFiles>({ front: null, back: null, single: null });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(getEditFormValues(registration));
    setSelectedFiles({ front: null, back: null, single: null });
    setMessage(null);
  }, [registration]);

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

  function handleFileChange(field: keyof SelectedFiles, file: File | null) {
    setSelectedFiles((current) => ({
      ...current,
      [field]: file,
    }));
  }

  function renderDropzone(field: keyof SelectedFiles, title: string, accept: string, helper: string) {
    const file = selectedFiles[field];
    const inputId = `replacement-${field}`;

    return (
      <label
        htmlFor={inputId}
        className={`flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${
          file ? "border-green-500 bg-green-50" : "border-slate-300 bg-slate-50 hover:border-blue-400 hover:bg-slate-100"
        }`}
      >
        {file ? (
          <>
            <span className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-700">{title}</span>
            <FileImage className="mb-2 h-8 w-8 text-green-600" aria-hidden="true" />
            <span className="max-w-full truncate text-sm font-semibold text-green-800">Selected: {file.name}</span>
            <span className="mt-1 text-xs text-green-700">Click to replace</span>
          </>
        ) : (
          <>
            <span className="mb-2 text-sm font-semibold text-slate-900">{title}</span>
            <UploadCloud className="mb-2 h-8 w-8 text-slate-400" aria-hidden="true" />
            <span className="text-sm"><span className="font-medium text-blue-600">Click to upload</span> <span className="text-slate-500">or drag and drop</span></span>
            <span className="mt-2 text-xs text-slate-500">{helper}</span>
          </>
        )}
        <input
          id={inputId}
          type="file"
          accept={accept}
          onChange={(event) => handleFileChange(field, event.target.files?.[0] ?? null)}
          className="hidden"
        />
      </label>
    );
  }

  function validate() {
    if (!form.lastName.trim() || !form.firstName.trim() || !form.middleName.trim()) return "First, middle, and last name are required.";
    if (!form.sitio.trim() || !form.barangay.trim() || !form.municipality.trim() || !form.province.trim()) return "Complete address details are required.";
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
    if (!selectedFiles.front && !registration.idFrontFileUrl) return "Please upload the front of your valid ID.";
    if (!selectedFiles.back && !registration.idBackFileUrl) return "Please upload the back of your valid ID.";
    if (!selectedFiles.single && !registration.idSingleFileUrl) return "Please upload your Certificate of Residency.";
    // Residency confirmation is captured from the uploaded document itself; no checkbox required.
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
      const fullName = [form.firstName, form.middleName, form.lastName].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      const address = [form.sitio, form.barangay, form.municipality, form.province].filter(Boolean).join(", ");
      formData.append("fullName", fullName);
      formData.append("address", address);
      formData.append("lastName", form.lastName);
      formData.append("firstName", form.firstName);
      formData.append("middleInitial", form.middleName);
      formData.append("sitio", form.sitio);
      formData.append("barangay", form.barangay);
      formData.append("municipality", form.municipality);
      formData.append("province", form.province);
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
      formData.append("documentType", "Valid ID + Certificate of Residency");

      if (selectedFiles.front) {
        formData.append("frontFile", selectedFiles.front);
      }
      if (selectedFiles.back) {
        formData.append("backFile", selectedFiles.back);
      }
      if (selectedFiles.single) {
        formData.append("residencyFile", selectedFiles.single);
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
      <div className="relative mx-auto flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/70 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-5 sm:px-8">
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
        <div className="kk-profiling-edit-form min-h-0 flex-1 space-y-4 overflow-y-auto p-6 sm:p-8 [&_.grid]:gap-y-4 [&_label]:gap-1.5">
          {message ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {message}
            </div>
          ) : null}

          <div>
            <h3 className="mb-4 text-lg font-semibold text-slate-950">PART I: Profile</h3>
            <p className="mt-1 text-sm text-slate-600">Please ensure the accuracy of your responses by providing truthful and complete information in all required fields.</p>
          </div>

          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-last-name" className="text-sm font-semibold">Last Name *</label>
              <input
                id="edit-last-name"
                value={form.lastName}
                onChange={(e) => setField("lastName", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-first-name" className="text-sm font-semibold">First Name *</label>
              <input
                id="edit-first-name"
                value={form.firstName}
                onChange={(e) => setField("firstName", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="edit-middle-name" className="text-sm font-semibold">Middle Name *</label>
              <input
                id="edit-middle-name"
                value={form.middleName}
                onChange={(e) => setField("middleName", e.target.value)}
                className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"
              />
            </div>
          </div>

          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5"><label htmlFor="edit-sitio" className="text-sm font-semibold">Sitio *</label><select id="edit-sitio" value={form.sitio} onChange={(e) => setField("sitio", e.target.value)} className="mt-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm"><option value="">Select sitio</option>{OFFICIAL_SITIOS.map((sitio) => <option key={sitio} value={sitio}>{sitio}</option>)}</select></div>
            <div className="flex flex-col gap-1.5"><label htmlFor="edit-barangay" className="text-sm font-semibold">Barangay *</label><input id="edit-barangay" value={form.barangay} readOnly className="mt-1 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm" /></div>
            <div className="flex flex-col gap-1.5"><label htmlFor="edit-municipality" className="text-sm font-semibold">Municipality *</label><input id="edit-municipality" value={form.municipality} readOnly className="mt-1 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm" /></div>
            <div className="flex flex-col gap-1.5"><label htmlFor="edit-province" className="text-sm font-semibold">Province *</label><input id="edit-province" value={form.province} readOnly className="mt-1 rounded-2xl border border-slate-300 bg-slate-100 px-4 py-3 text-sm" /></div>
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

          <div>
            <h3 className="mt-10 mb-6 text-lg font-semibold text-slate-950">PART II: Demographic Characteristics</h3>
          </div>

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

          <section className="space-y-5 border-y border-slate-200 py-5" aria-labelledby="document-management-heading">
            <div>
              <h3 id="document-management-heading" className="text-lg font-semibold text-slate-950">Document management</h3>
              <p className="mt-1 text-sm text-slate-600">Review the documents currently on file or choose replacements below.</p>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900">Currently on file</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {[
                  ["Front of ID", registration.idFrontFileUrl],
                  ["Back of ID", registration.idBackFileUrl],
                  ["Certificate of Residency", registration.idSingleFileUrl],
                ].map(([title, url]) => (
                  <a
                    key={title}
                    href={url || undefined}
                    target={url ? "_blank" : undefined}
                    rel={url ? "noreferrer noopener" : undefined}
                    className="group flex min-h-20 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-400 hover:bg-slate-50"
                  >
                    <FileImage className="h-5 w-5 shrink-0 text-slate-400" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{title}<span className="mt-1 block text-xs font-normal text-slate-500">{url ? "Available to view" : "Not uploaded"}</span></span>
                    {url ? <ExternalLink className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:text-blue-600" aria-hidden="true" /> : null}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-semibold text-slate-900">Upload replacement</p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {renderDropzone("front", "Front of ID", "image/*", "PNG, JPG (max. 10MB)")}
                {renderDropzone("back", "Back of ID", "image/*", "PNG, JPG (max. 10MB)")}
                {renderDropzone("single", "Certificate of Residency", "image/*,application/pdf", "PNG, JPG, PDF (max. 10MB)")}
              </div>
            </div>
          </section>
        </div>
        <div className="flex shrink-0 flex-col gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
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

    </div>
  );
}
