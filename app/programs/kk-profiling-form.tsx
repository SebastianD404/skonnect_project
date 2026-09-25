"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import { OFFICIAL_SITIOS } from "@/lib/kk";
import DocumentOCRValidationExample, { type DocumentOCRKey, type DocumentOCRState } from "@/app/components/DocumentOCRValidationExample";
import { doesOcrTextMatchName } from "@/lib/ocrNameVerification";
import { ChevronDown, Eye, EyeOff } from "lucide-react";

const initialForm = {
  lastName: "",
  firstName: "",
  middleInitial: "",
  sitio: "",
  barangay: "Pico",
  municipality: "La Trinidad",
  province: "Benguet",
  sex: "",
  age: "",
  birthDate: "",
  email: "",
  facebook: "",
  contactNumber: "",
  civilStatus: "",
  youthClassification: "",
  youthAgeGroup: "",
  workStatus: "",
  educationalBackground: "",
  registeredSKVoter: "",
  votedLastSK: "",
  registeredNationalVoter: "",
  attendedKKAssembly: "",
  assemblyTimes: "",
  noAssemblyReason: "",
  consent: false,
};

const REQUIRED_DOCUMENT_TYPE = "Valid ID + Certificate of Residency";
const KK_PROFILING_DRAFT_KEY = "skonnect:kk-profiling-draft";
const KK_PROFILING_FILES_DB = "skonnect-kk-profiling-files";
const KK_PROFILING_FILES_STORE = "documents";
type ProfilingDocumentKey = "front" | "back" | "residency";

function openProfilingFilesDb() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(KK_PROFILING_FILES_DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(KK_PROFILING_FILES_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveProfilingFile(key: ProfilingDocumentKey, file: File | null) {
  const db = await openProfilingFilesDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(KK_PROFILING_FILES_STORE, "readwrite");
    transaction.objectStore(KK_PROFILING_FILES_STORE).put(file, key);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

async function loadProfilingFiles() {
  const db = await openProfilingFilesDb();
  const files = await Promise.all(
    (["front", "back", "residency"] as ProfilingDocumentKey[]).map(
      (key) =>
        new Promise<[ProfilingDocumentKey, File | null]>((resolve, reject) => {
          const request = db
            .transaction(KK_PROFILING_FILES_STORE, "readonly")
            .objectStore(KK_PROFILING_FILES_STORE)
            .get(key);
          request.onsuccess = () => resolve([key, request.result ?? null]);
          request.onerror = () => reject(request.error);
        })
    )
  );
  db.close();
  return Object.fromEntries(files) as Partial<Record<ProfilingDocumentKey, File | null>>;
}

async function clearProfilingFiles() {
  const db = await openProfilingFilesDb();
  await new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(KK_PROFILING_FILES_STORE, "readwrite");
    transaction.objectStore(KK_PROFILING_FILES_STORE).clear();
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
}

function computeAgeFromBirthDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return undefined;
  }

  const birthDate = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(birthDate.getTime())) {
    return undefined;
  }

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  let age = currentYear - birthYear;
  if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDay < birthDay)) {
    age -= 1;
  }

  return age;
}

function SelectWithChevron({
  children,
  className = "",
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select {...props} className={`w-full appearance-none ${className}`}>
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
        aria-hidden="true"
      />
    </div>
  );
}


export default function KKProfilingForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [idFiles, setIdFiles] = useState<{ front?: File | null; back?: File | null; residency?: File | null }>({ front: null, back: null, residency: null });
  const [successMessage, setSuccessMessage] = useState("Your KK Profiling application has been received and is now pending verification.");
  const [successRedirectTo, setSuccessRedirectTo] = useState("/programs/kk-profiling/status");
  const [successCredentials, setSuccessCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [accountExistsFallback, setAccountExistsFallback] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isCheckingStatus, setIsCheckingStatus] = useState(true);
  const [hasLoadedDraft, setHasLoadedDraft] = useState(false);
  const [ocrValidationState, setOcrValidationState] = useState<Record<DocumentOCRKey, DocumentOCRState>>({
    front: { status: "idle", file: null },
    back: { status: "idle", file: null },
    residency: { status: "idle", file: null },
  });

  const isOcrVerified = Object.values(ocrValidationState).every((state) => state.status === "success");

  useEffect(() => {
    let active = true;
    void loadProfilingFiles()
      .then((files) => {
        if (active && Object.values(files).some(Boolean)) {
          setIdFiles((current) => ({ ...current, ...files }));
        }
      })
      .catch((error) => console.warn("Unable to restore KK profiling documents", error));

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    try {
      const savedDraft = window.sessionStorage.getItem(KK_PROFILING_DRAFT_KEY);
      if (savedDraft) {
        const parsedDraft = JSON.parse(savedDraft);
        if (parsedDraft && typeof parsedDraft === "object") {
          setForm({ ...initialForm, ...parsedDraft });
        }
      }
    } catch (error) {
      console.warn("Unable to restore KK profiling draft", error);
    } finally {
      setHasLoadedDraft(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedDraft) return;

    try {
      window.sessionStorage.setItem(KK_PROFILING_DRAFT_KEY, JSON.stringify(form));
    } catch (error) {
      console.warn("Unable to save KK profiling draft", error);
    }
  }, [form, hasLoadedDraft]);

  // Check if user is already approved and redirect
  useEffect(() => {
    let mounted = true;

    async function checkApprovedProfile() {
      try {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        if (!sessionResponse.ok) {
          if (mounted) setIsCheckingStatus(false);
          return;
        }

        const sessionData = await sessionResponse.json();
        if (!sessionData.user) {
          if (mounted) setIsCheckingStatus(false);
          return;
        }

        const response = await fetch("/api/my/kk-profile", { cache: "no-store", credentials: "include" });
        if (!mounted) return;
        if (response.ok) {
          const data = await response.json();
          const profileStatus = data.profile?.status || "";
          const isApprovedStatus = profileStatus.toLowerCase().includes("approved");

          if (isApprovedStatus) {
            router.replace("/programs/kk-profiling/status");
            return;
          }
        }

        setIsCheckingStatus(false);
      } catch {
        if (mounted) setIsCheckingStatus(false);
      }
    }

    void checkApprovedProfile();

    return () => {
      mounted = false;
    };
  }, [router]);

  // ID file preview effect

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    if (key === "birthDate") {
      const birthDateValue = String(value);
      const computedAge = computeAgeFromBirthDate(birthDateValue);
      return setForm((s) => ({
        ...s,
        birthDate: birthDateValue,
        age: computedAge !== undefined ? String(computedAge) : "",
      }));
    }

    setForm((s) => ({
      ...s,
      [key]: value,
    }));
  }

  function normalizedMiddleInitial(value: string) {
    return value
      .replace(/[^a-zA-Z\s.'-]/g, "")
      .replace(/\s+/g, " ")
      .slice(0, 80);
  }

  function normalizeText(value: string) {
    return String(value)
      .trim()
      .toLowerCase()
      .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
      .replace(/[^a-z0-9 ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parseIsoDate(value: string) {
    const parts = String(value).split("-").map(Number);
    if (parts.length !== 3) return null;
    const [year, month, day] = parts;
    if (
      Number.isNaN(year) ||
      Number.isNaN(month) ||
      Number.isNaN(day) ||
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31
    ) {
      return null;
    }
    return new Date(Date.UTC(year, month - 1, day));
  }

  function parseDateCandidatesFromText(text: string) {
    const normalizedText = String(text)
      .replace(/[\u2018\u2019\u201C\u201D]/g, "'")
      .replace(/[^0-9\-\/\. ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const results: Date[] = [];

    const pushUniqueDate = (date: Date | null) => {
      if (!date || Number.isNaN(date.getTime())) return;
      const iso = date.toISOString();
      if (!results.some((existing) => existing.toISOString() === iso)) {
        results.push(date);
      }
    };

    const ymdRegex = /(?<!\d)(\d{4})[\/\-. ](\d{1,2})[\/\-. ](\d{1,2})(?!\d)/g;
    let match: RegExpExecArray | null;
    while ((match = ymdRegex.exec(normalizedText))) {
      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        pushUniqueDate(new Date(Date.UTC(year, month - 1, day)));
      }
    }

    const mdyRegex = /(?<!\d)(\d{1,2})[\/\-. ](\d{1,2})[\/\-. ](\d{4})(?!\d)/g;
    while ((match = mdyRegex.exec(normalizedText))) {
      const first = Number(match[1]);
      const second = Number(match[2]);
      const year = Number(match[3]);

      const maybeMdy = first >= 1 && first <= 12 && second >= 1 && second <= 31
        ? new Date(Date.UTC(year, first - 1, second))
        : null;
      const maybeDmy = second >= 1 && second <= 12 && first >= 1 && first <= 31
        ? new Date(Date.UTC(year, second - 1, first))
        : null;

      pushUniqueDate(maybeMdy);
      if (maybeDmy && maybeDmy.toISOString() !== maybeMdy?.toISOString()) {
        pushUniqueDate(maybeDmy);
      }
    }

    return results;
  }

  function doesProfileNameMatchIdText() {
    const firstName = String(form.firstName || "").trim();
    const lastName = String(form.lastName || "").trim();

    if (!firstName || !lastName) {
      return true;
    }

    const frontText = ocrValidationState.front.status === "success"
      ? String(ocrValidationState.front.text ?? "")
      : "";

    if (!frontText) {
      return true;
    }

    return doesOcrTextMatchName(firstName, lastName, frontText, 0.8);
  }

  function doesProfileBirthDateMatchIdText() {
    const profileDate = parseIsoDate(form.birthDate);
    if (!profileDate) {
      return true;
    }

    const idTexts = [ocrValidationState.front, ocrValidationState.back]
      .filter((state) => state.status === "success")
      .map((state) => state.text ?? "");

    const candidates = idTexts.flatMap((text) => parseDateCandidatesFromText(text));
    if (candidates.length === 0) {
      return true;
    }

    return candidates.some((date) => date.getTime() === profileDate.getTime());
  }

  function handleIdFileChange(field: keyof typeof idFiles, file: File | null) {
    void saveProfilingFile(field, file).catch((error) => console.warn("Unable to save KK profiling document", error));
    setIdFiles((current) => ({
      ...current,
      [field]: file,
    }));
  }

  function removeIdFile(field: keyof typeof idFiles) {
    void saveProfilingFile(field, null).catch((error) => console.warn("Unable to remove KK profiling document", error));
    setIdFiles((current) => ({
      ...current,
      [field]: null,
    }));
  }

  async function handleTriggerMagicLink(email: string) {
    if (!email.trim()) {
      setMessage("Please enter your email to receive a one-time access link.");
      return;
    }

    try {
      setMessage(null);
      setMagicLinkSent(false);
      const browserSupabase = createBrowserClient();
      const { error } = await browserSupabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/login?next=${encodeURIComponent(successRedirectTo)}`,
        },
      });

      if (error) {
        console.error("Magic link send failed", error.message);
        setMessage("Unable to send the access link. Please try again.");
      } else {
        setMagicLinkSent(true);
        setMessage("A one-time access link has been sent to your email.");
      }
    } catch (error) {
      console.error("Magic link send failed", error);
      setMessage("Unable to send the access link. Please try again.");
    }
  }

  function validate() {
    if (!form.lastName.trim()) return "Last name is required";
    if (!form.firstName.trim()) return "First name is required";
    if (!form.middleInitial.trim()) return "Middle name is required";
    if (!form.sitio.trim()) return "Sitio is required";
    if (!form.barangay.trim()) return "Barangay is required";
    if (!form.municipality.trim()) return "Municipality is required";
    if (!form.province.trim()) return "Province is required";
    if (!form.sex) return "Sex is required";
    if (!form.age) return "Age is required";
    if (!form.birthDate) return "Birth date is required";
    if (!form.email.trim()) return "Email is required";
    if (!form.facebook.trim()) return "Facebook account name is required";
    if (!form.contactNumber.trim()) return "Contact number is required";
    if (!form.civilStatus) return "Civil status is required";
    if (!form.youthClassification) return "Youth classification is required";
    if (!form.youthAgeGroup) return "Youth age group is required";
    if (!form.workStatus) return "Work status is required";
    if (!form.educationalBackground) return "Educational background is required";
    if (!form.registeredSKVoter) return "Registered SK voter status is required";
    if (!form.votedLastSK) return "SK election participation status is required";
    if (!form.registeredNationalVoter) return "Registered national voter status is required";
    if (!form.attendedKKAssembly) return "KK assembly attendance status is required";
    if (form.attendedKKAssembly === "Yes" && !form.assemblyTimes) {
      return "Please indicate how many KK assemblies you attended.";
    }
    if (form.attendedKKAssembly === "No" && !form.noAssemblyReason) {
      return "Please indicate why you did not attend KK assemblies.";
    }
    if (!form.consent) return "You must agree to the informed consent";
    
    if (!idFiles.front || !idFiles.back) {
      return "Please upload both the front and back of your valid ID.";
    }

    if (!idFiles.residency) {
      return "Please upload your Certificate of Residency.";
    }

    if (!isOcrVerified) {
      return "Please complete OCR validation for each uploaded document before submitting.";
    }

    if (!doesProfileNameMatchIdText()) {
      return "Your name does not match the name on your ID.";
    }

    if (!doesProfileBirthDateMatchIdText()) {
      return "Your birthdate does not match the birthdate on your ID.";
    }
    
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setAccountExistsFallback(false);
    setMagicLinkSent(false);

    const err = validate();
    if (err) {
      setMessage(err);
      return;
    }

    setSubmitting(true);
    try {
      const fullName = [form.firstName.trim(), form.middleInitial.trim(), form.lastName.trim()]
        .filter(Boolean)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();

      const address = [form.sitio.trim(), form.barangay.trim(), form.municipality.trim(), form.province.trim()]
        .filter(Boolean)
        .join(", ");

      // Create FormData for submission with files
      const formData = new FormData();
      
      // Add all form fields
      formData.append("lastName", form.lastName);
      formData.append("firstName", form.firstName);
      formData.append("middleInitial", form.middleInitial);
      formData.append("sitio", form.sitio);
      formData.append("barangay", form.barangay);
      formData.append("municipality", form.municipality);
      formData.append("province", form.province);
      formData.append("sex", form.sex);
      formData.append("age", form.age);
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
      formData.append("assemblyTimes", form.assemblyTimes);
      formData.append("noAssemblyReason", form.noAssemblyReason);
      formData.append("consent", String(form.consent));
      formData.append("fullName", fullName);
      formData.append("address", address);

      // Add ID files
      formData.append("documentType", REQUIRED_DOCUMENT_TYPE);
      formData.append("frontFile", idFiles.front as File);
      formData.append("backFile", idFiles.back as File);
      formData.append("residencyFile", idFiles.residency as File);

      const res = await fetch("/api/programs/kk-profiling/register-with-id", {
        method: "POST",
        credentials: "same-origin",
        body: formData,
      });

      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setForm(initialForm);
        window.sessionStorage.removeItem(KK_PROFILING_DRAFT_KEY);
        void clearProfilingFiles().catch((error) => console.warn("Unable to clear KK profiling documents", error));
        setIdFiles({ front: null, back: null, residency: null });
        setOcrValidationState({
          front: { status: "idle", file: null },
          back: { status: "idle", file: null },
          residency: { status: "idle", file: null },
        });
        setMessage(null);
        setSuccessMessage(
          body?.message ||
            "Your KK Profiling request has been received and is now pending verification. An SKonnect account was created automatically so you can monitor your status and receive updates."
        );
        setSuccessRedirectTo(body?.redirectTo || "/programs/kk-profiling/status");
        setSuccessCredentials(
          body?.credentials && body.credentials.username && body.credentials.temporaryPassword
            ? {
                username: body.credentials.username,
                temporaryPassword: body.credentials.temporaryPassword,
              }
            : null
        );

        let loggedIn = Boolean(body?.signedIn);
        if (!loggedIn && body?.credentials?.username && body?.credentials?.temporaryPassword) {
          try {
            const browserSupabase = createBrowserClient();
            const { error } = await browserSupabase.auth.signInWithPassword({
              email: body.credentials.username,
              password: body.credentials.temporaryPassword,
            });

            if (!error) {
              loggedIn = true;
            } else {
              console.error("KK profiling client auto-login failed", error.message);
            }
          } catch (loginError) {
            console.error("KK profiling client auto-login failed", loginError);
          }
        }

        setSignedIn(loggedIn);
        setShowSuccessModal(true);
      } else {
        if (body?.accountExists) {
          setAccountExistsFallback(true);
          setMessage("");
          return;
        }

        setMessage(body?.error ?? "Failed to submit. Please try again.");
      }
    } catch (error) {
      console.error("KK profiling submission failed", error);
      setMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      {isCheckingStatus ? (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA]">
          <div className="text-center">
            <div className="inline-flex h-12 w-12 animate-spin rounded-full border-4 border-slate-300 border-t-teal-600 mb-4"></div>
            <p className="text-sm text-slate-600">Loading...</p>
          </div>
        </div>
      ) : (
        <>
        <form onSubmit={handleSubmit} className="grid gap-x-4 gap-y-2 [&_label]:gap-1.5">
          <h3 className="text-xl font-bold text-slate-900">Katipunan ng Kabataan (KK) Profiling — Registration</h3>

      <div className="flex flex-col gap-6">
        <div className="relative rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
          <div className="min-w-0 pr-24">
            <strong>Informed Consent</strong>
            <p className="mt-2">The Profiling aims to gather KK member information for the National Youth Commission. Data will be stored and used for database management by the NYC. Participation is voluntary. No monetary compensation will be provided.</p>
          </div>
          <div className="absolute bottom-2 right-2">
            <button type="button" onClick={() => setShowConsentModal(true)} className="text-sm underline text-slate-700 transition duration-200 hover:text-slate-900 hover:bg-slate-100 hover:no-underline rounded-md px-2 py-1">View full consent</button>
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h3 className="border-b border-slate-200 pb-2 text-lg font-bold text-slate-900">PART I: Profile</h3>
            <p className="mt-2 text-sm text-slate-500">
              Please ensure the accuracy of your responses by providing truthful and complete information in all required fields.
            </p>
          </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Last Name *</span>
          <input value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} required className="rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">First Name *</span>
          <input value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} required className="rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Middle Name *</span>
          <input
            value={form.middleInitial}
            onChange={(e) => setField("middleInitial", normalizedMiddleInitial(e.target.value))}
            maxLength={80}
            required
            className="rounded-lg border px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Sitio *</span>
          <SelectWithChevron value={form.sitio} onChange={(e) => setField("sitio", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
            <option value="">Select sitio</option>
            {OFFICIAL_SITIOS.map((sitio) => (
              <option key={sitio} value={sitio}>{sitio}</option>
            ))}
          </SelectWithChevron>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Barangay *</span>
          <input value={form.barangay} readOnly className="rounded-lg border bg-slate-100 px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Municipality *</span>
          <input value={form.municipality} readOnly className="rounded-lg border bg-slate-100 px-3 py-2" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Province *</span>
          <input value={form.province} readOnly className="rounded-lg border bg-slate-100 px-3 py-2" />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Sex *</span>
          <SelectWithChevron value={form.sex} onChange={(e) => setField("sex", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
            <option value="">Select</option>
            <option>Male</option>
            <option>Female</option>
          </SelectWithChevron>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Birth Date *</span>
          <input
            type="date"
            min="1995-01-01"
            max={`${new Date().getFullYear()}-12-31`}
            value={form.birthDate}
            onChange={(e) => {
              const value = e.target.value;
              const selectedYear = Number(value.slice(0, 4));
              const currentYear = new Date().getFullYear();
              if (value >= "1995-01-01" && value <= `${currentYear}-12-31` && selectedYear < currentYear) {
                setField("birthDate", value);
              }
            }}
            required
            className="rounded-lg border px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Age *</span>
          <input
            type="number"
            min={0}
            value={form.age}
            readOnly
            aria-readonly="true"
            className="rounded-lg border bg-slate-100 px-3 py-2 text-slate-700"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Email Address *</span>
          <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required className="rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Facebook Account (Name) *</span>
          <input value={form.facebook} onChange={(e) => setField("facebook", e.target.value)} required className="rounded-lg border px-3 py-2" />
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Contact Number *</span>
        <input value={form.contactNumber} onChange={(e) => setField("contactNumber", e.target.value)} required className="rounded-lg border px-3 py-2" />
      </label>

        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h3 className="border-b border-slate-200 pb-2 text-lg font-bold text-slate-900">PART II: Demographic Characteristics</h3>
          </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Civil Status *</span>
        <SelectWithChevron value={form.civilStatus} onChange={(e) => setField("civilStatus", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
          <option value="">Select</option>
          <option>Single</option>
          <option>Married</option>
          <option>Widowed</option>
          <option>Divorced</option>
          <option>Separated</option>
          <option>Annulled</option>
          <option>Unknown</option>
          <option>Live-in</option>
        </SelectWithChevron>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Youth Classification *</span>
        <SelectWithChevron value={form.youthClassification} onChange={(e) => setField("youthClassification", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
          <option value="">Select</option>
          <option>In school Youth</option>
          <option>Out of School Youth</option>
          <option>Working Youth</option>
          <option>Person w/ Disability</option>
          <option>Children In Conflict with Law</option>
          <option>Indigenous People</option>
        </SelectWithChevron>
      </label>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Youth age Group *</span>
          <SelectWithChevron value={form.youthAgeGroup} onChange={(e) => setField("youthAgeGroup", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
            <option value="">Select</option>
            <option>Child Youth (15-17 yrs old)</option>
            <option>Core Youth (18-24 yrs old)</option>
            <option>Young Adult (15-30 yrs old)</option>
          </SelectWithChevron>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Work Status *</span>
          <SelectWithChevron value={form.workStatus} onChange={(e) => setField("workStatus", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
            <option value="">Select</option>
            <option>Employed</option>
            <option>Unemployed</option>
            <option>Self-Employed</option>
            <option>Currently looking for a Job</option>
            <option>Not Interested Looking for a Job</option>
          </SelectWithChevron>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Educational Background *</span>
        <SelectWithChevron value={form.educationalBackground} onChange={(e) => setField("educationalBackground", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
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
        </SelectWithChevron>
      </label>

      <div className="grid grid-cols-1 gap-x-4 gap-y-6 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Registered SK Voter? *</span>
          <SelectWithChevron value={form.registeredSKVoter} onChange={(e) => setField("registeredSKVoter", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
            <option value="">Select</option>
            <option>Yes</option>
            <option>No</option>
          </SelectWithChevron>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Did you vote last SK election? *</span>
          <SelectWithChevron value={form.votedLastSK} onChange={(e) => setField("votedLastSK", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
            <option value="">Select</option>
            <option>Yes</option>
            <option>No</option>
          </SelectWithChevron>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">Registered National Voter? *</span>
          <SelectWithChevron value={form.registeredNationalVoter} onChange={(e) => setField("registeredNationalVoter", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
            <option value="">Select</option>
            <option>Yes</option>
            <option>No</option>
          </SelectWithChevron>
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-semibold">Have you already attended a KK Assembly? *</span>
        <SelectWithChevron value={form.attendedKKAssembly} onChange={(e) => setField("attendedKKAssembly", e.target.value)} required className="rounded-lg border pl-3 pr-10 py-2">
          <option value="">Select</option>
          <option>Yes</option>
          <option>No</option>
        </SelectWithChevron>
      </label>

      {form.attendedKKAssembly === "Yes" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">If Yes, How many times</span>
          <SelectWithChevron value={form.assemblyTimes} onChange={(e) => setField("assemblyTimes", e.target.value)} className="rounded-lg border pl-3 pr-10 py-2">
            <option value="">Select</option>
            <option>1-2 Times</option>
            <option>3-4 Times</option>
            <option>5 and above</option>
          </SelectWithChevron>
        </label>
      )}

      {form.attendedKKAssembly === "No" && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold">If No, Why?</span>
          <SelectWithChevron value={form.noAssemblyReason} onChange={(e) => setField("noAssemblyReason", e.target.value)} className="rounded-lg border pl-3 pr-10 py-2">
            <option value="">Select</option>
            <option>There were no KK Assembly Meetings</option>
            <option>Not interested to attend</option>
          </SelectWithChevron>
        </label>
      )}

        </div>

        <div className="flex flex-col gap-5">
          <div>
            <h3 className="border-b border-slate-200 pb-2 text-lg font-bold text-slate-900">
              PART III: Valid ID and Certificate of Residency
            </h3>
            <p className="mt-2 text-sm text-slate-500">Please upload both a valid ID and a Certificate of Residency. Your residency document must state that you have lived in Barangay Pico for at least 8 months.</p>
          </div>

          <div className="space-y-4">
        <DocumentOCRValidationExample
          className="space-y-3"
          firstName={form.firstName}
          middleInitial={form.middleInitial}
          lastName={form.lastName}
          profileBirthDate={form.birthDate}
          initialFiles={idFiles}
          onFileSelected={(key, file) => {
            const field = key === "front" ? "front" : key === "back" ? "back" : "residency";
            handleIdFileChange(field as keyof typeof idFiles, file);
          }}
          onRemoveFile={(key) => {
            const field = key === "front" ? "front" : key === "back" ? "back" : "residency";
            handleIdFileChange(field as keyof typeof idFiles, null);
          }}
          onValidationChange={setOcrValidationState}
        />
          </div>

          <label className="flex items-start gap-3">
            <input type="checkbox" checked={form.consent} onChange={(e) => setField("consent", e.target.checked)} className="mt-1" />
            <span className="text-sm">I have read and understood the informed consent and agree to participate in Barangay Pico&apos;s KK Profiling (required). <button type="button" onClick={() => setShowConsentModal(true)} className="ml-2 text-sm underline">(Read consent)</button></span>
          </label>
        </div>
      </div>

      {showConsentModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40">
          <div className="min-h-screen flex items-center justify-center px-4 py-10">
            <div role="dialog" aria-modal="true" className="relative z-10 max-w-3xl w-full rounded-lg bg-white p-6 shadow-xl">
              <div className="flex items-start justify-between">
                <h4 className="text-lg font-semibold">Informed Consent — KK Profiling</h4>
                <button type="button" onClick={() => setShowConsentModal(false)} className="text-sm text-slate-500 hover:text-slate-900">Close</button>
              </div>
              <div className="mt-4 max-h-[70vh] overflow-y-auto text-sm text-slate-700 space-y-3">
                <p><strong>Katipunan ng Kabataan (KK) Profiling</strong></p>
                <p><strong>Consulting Agency:</strong> National Youth Commission (NYC), Quezon City, Philippines</p>
                <p><strong>1. Purpose of the Study</strong><br/>The Profiling aims to gather the information and data of the Katipunan ng Kabataan members. The information gathered in the KK Profiling will be stored to the upcoming SK Portal and will only be used for the purpose of database management handled by the National Youth Commission.</p>
                <p><strong>2. Terms and Duration of Participation</strong><br/>You are asked to join the study as participant in the KK Profiling. The conduct of the profiling will take 2 to 3 hours per Barangay; the data will serve as an updated National database of the Katipunan ng Kabataan members in the Philippines.</p>
                <p><strong>3. Risks/Confidentiality</strong><br/>Your participation in the study will be treated with utmost confidentiality. Any information collected from you will be used in the Database management. Also, your safety is also my primary concern. The profiling ensures that there will be no risk to encounter during the process of data collection.</p>
                <p><strong>4. Compensation</strong><br/>The activity is mandated by the Department of Interior and Local Government together with the National Youth Commission; there will be no monetary remuneration other than our sincerest gratitude for your time and effort. Your participation will be highly appreciated.</p>
                <p><strong>5. Inquiries</strong><br/>If you have any question/s on the administration of the survey question or the study in general, please do not hesitate to contact the research proponent through the following information: FB Account: SK Barangay Pico — Email Address: skbarangaypico@gmail.com</p>
                <p>By clicking &quot;Submit&quot; on the registration form you acknowledge that you have read and understood the information provided in this consent form and agree to participate in Barangay Pico&apos;s KK Profiling, including the use of your data as part of a corpus.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {accountExistsFallback && (
        <div className="mb-4 rounded-2xl border border-teal-200 bg-teal-50 p-4 text-slate-900 shadow-sm">
          <div className="flex items-center gap-2 text-teal-900 font-semibold text-sm">
            <svg className="h-5 w-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Welcome back! An account is already tied to this email.
          </div>
          <p className="mt-2 text-xs text-teal-700">
            It looks like you started your KK Profiling earlier. To protect your data and continue your SKEAP application smoothly, please verify your identity.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => router.push(`/login?next=${encodeURIComponent(successRedirectTo)}`)}
              className="inline-flex justify-center rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-700 transition"
            >
              Sign In to Continue
            </button>
            <button
              type="button"
              onClick={() => handleTriggerMagicLink(form.email)}
              className="inline-flex justify-center rounded-lg border border-teal-600 bg-white px-3 py-2 text-xs font-semibold text-teal-600 hover:bg-teal-50 transition"
            >
              Send One-Time Access Link
            </button>
          </div>
          {magicLinkSent && (
            <p className="mt-3 text-xs text-teal-700">A one-time access link has been sent to your email.</p>
          )}
        </div>
      )}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting || !isOcrVerified} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {submitting ? "Submitting..." : "Submit"}
        </button>
        {message && <p className="text-sm text-slate-700">{message}</p>}
      </div>
      </form>

      {showSuccessModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl ring-1 ring-slate-200">
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill ="currentColor" className="h-10 w-10">
                <path fillRule="evenodd" d="M12 2.25a9.75 9.75 0 1 0 0 19.5 9.75 9.75 0 0 0 0-19.5Zm4.72 7.78a.75.75 0 0 1 0 1.06l-5.5 5.5a.75.75 0 0 1-1.06 0l-2.5-2.5a.75.75 0 0 1 1.06-1.06l1.97 1.97 4.97-4.97a.75.75 0 0 1 1.06 0Z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Profiling submitted</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">{successMessage}</p>
            </div>
            {successCredentials ? (
              <div className="w-full rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left text-sm text-slate-700">
                <p className="font-semibold text-slate-900">Your default account credentials</p>
                <div className="mt-3 grid gap-2">
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                    <span className="text-slate-600">Email</span>
                    <span className="font-medium text-slate-900 break-all">{successCredentials.username}</span>
                  </div>
                  <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2">
                    <span className="text-slate-600">Temporary password</span>
                    <span className="font-medium text-slate-900 break-all">{successCredentials.temporaryPassword}</span>
                  </div>
                </div>
                <p className="mt-3 text-xs text-slate-500">
                  Use these credentials only if you need to sign in again before securing your account. We recommend securing your account now.
                </p>
              </div>
            ) : null}

            <div className="text-sm text-slate-600">
              {!signedIn && (
                <p>
                  You are not currently signed in. Use the credentials above to log in, or secure your account first before applying.
                </p>
              )}
            </div>

            <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  const target = signedIn
                    ? successRedirectTo
                    : `/login?next=${encodeURIComponent(successRedirectTo)}`;
                  router.push(target);
                }}
                className="inline-flex justify-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                {signedIn ? "View KK Profiling Status" : "Sign in to view status"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSuccessModal(false);
                  const securePath = `/secure-account?redirect=${encodeURIComponent(successRedirectTo)}`;
                  router.push(signedIn ? securePath : `/login?next=${encodeURIComponent(securePath)}`);
                }}
                className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Secure Account
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
        </>
      )}
    </>
  );
}
