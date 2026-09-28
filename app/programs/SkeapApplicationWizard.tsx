"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useState } from "react";
import { FileText, UploadCloud } from "lucide-react";
import {
  CORE_UPLOAD_KEYS,
  SKEAP_UPLOAD_KEY,
  SKEAP_UPLOAD_LABELS,
  normalizeUploadRequirement,
  type SkeapUploadKey,
} from "@/lib/skeap-upload";
import SmartPortraitDropzone from "@/components/SmartPortraitDropzone";
import type { KKProfile } from "@/lib/kk-profile-client";

type UploadedFile = {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  url?: string;
  error?: string;
  requirement?: string;
};

type SkeapUploadValue = {
  name?: string;
  url: string;
};

function getUploadLabelForKey(key: SkeapUploadKey) {
  return SKEAP_UPLOAD_LABELS[key] || SKEAP_UPLOAD_LABELS.other;
}

function parseDateValue(value: string) {
  const parts = value.split("-");
  if (parts.length !== 3) return null;

  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
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

function computeAgeFromDateValue(value: string) {
  const birthDate = parseDateValue(value);
  if (!birthDate) return undefined;

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth();
  const currentDay = now.getUTCDate();

  const birthYear = birthDate.getUTCFullYear();
  const birthMonth = birthDate.getUTCMonth();
  const birthDay = birthDate.getUTCDate();

  let age = currentYear - birthYear;
  if (
    currentMonth < birthMonth ||
    (currentMonth === birthMonth && currentDay < birthDay)
  ) {
    age -= 1;
  }

  return age;
}

function getRequiredUploadKeys(requirements?: string[]) {
  const requiredKeys = new Set<SkeapUploadKey>(CORE_UPLOAD_KEYS);
  requirements?.forEach((req) => {
    const key = normalizeUploadRequirement(req);
    if (key !== SKEAP_UPLOAD_KEY.OTHER) {
      requiredKeys.add(key);
    }
  });
  return Array.from(requiredKeys);
}

function findUploadFileForKey(files: UploadedFile[], key: SkeapUploadKey) {
  const exactMatch = files.find((file) => file.status === "done" && file.url && file.requirement === key);
  if (exactMatch) return exactMatch;

  return files.find((file) => {
    if (file.status !== "done" || !file.url) return false;
    if (!file.requirement) {
      return normalizeUploadRequirement(file.name || "") === key;
    }
    return false;
  });
}

function formatPermanentAddress(parts: Array<string | undefined | null>) {
  return parts
    .filter((part): part is string => Boolean(part && String(part).trim()))
    .map((part) => String(part).trim())
    .join(", ");
}

function parseProfileName(fullName: string) {
  const normalizedName = fullName.trim();
  if (normalizedName.includes(",")) {
    const [lastName, rest] = normalizedName.split(",", 2).map((part) => part.trim());
    const nameParts = rest.split(/\s+/).filter(Boolean);
    const firstName = nameParts.shift() || "";
    const middleInitial = nameParts.join(" ");
    return { lastName, firstName, middleInitial };
  }

  const nameParts = normalizedName.split(/\s+/).filter(Boolean);
  if (nameParts.length === 1) {
    return { lastName: "", firstName: nameParts[0], middleInitial: "" };
  }
  if (nameParts.length === 2) {
    return { lastName: nameParts[1], firstName: nameParts[0], middleInitial: "" };
  }
  return {
    lastName: nameParts[nameParts.length - 1] || "",
    firstName: nameParts[0] || "",
    middleInitial: nameParts.slice(1, -1).join(" "),
  };
}

function isUploadCompleteForKey(files: UploadedFile[], key: SkeapUploadKey) {
  return files.some((file) => {
    if (file.status !== "done" || !file.url) return false;
    if (file.requirement === key) return true;
    const normalizedRequirement = normalizeUploadRequirement(file.requirement || file.name || "");
    if (normalizedRequirement === key) return true;
    return normalizeUploadRequirement(file.name || "") === key;
  });
}

const STEPS = ["Profile", "School", "Educational Background", "Uploads"] as const;
const YEAR_LEVELS = [
  "Incoming Freshman",
  "1st Year",
  "2nd Year",
  "3rd Year",
  "4th Year",
  "5th Year",
  "6th Year",
];
const FIELD_VALIDATION_MESSAGES: Record<string, readonly string[]> = {
  lastName: ["Last name and first name are required."],
  firstName: ["Last name and first name are required."],
  permanentAddress: ["Permanent address is required."],
  schoolName: ["School / Institution is required."],
  dateOfBirth: ["Date of birth is required."],
  placeOfBirth: ["Place of birth is required."],
  age: ["Age is required.", "Please enter a valid age."],
  civilStatus: ["Civil status is required."],
  gender: ["Gender is required."],
  contactNumber: ["Contact number is required."],
  emailAddress: ["Email address is required."],
  photo: ["Please upload a 2x2 photo (ID)."],
  photoFile: ["Please upload a valid 2x2 photo.", "Please upload a 2x2 photo (ID)."],
  registeredVoter: ["Please indicate Registered Voter (Yes/No)."],
  course: ["Course is required."],
  yearLevel: ["Year level is required."],
  fathersName: ["Father's name is required."],
  fathersContact: ["Father's contact is required."],
  mothersMaidenName: ["Mother's maiden name is required."],
  mothersOccupation: ["Mother's occupation is required."],
  mothersContact: ["Mother's contact is required."],
  totalFamilyMonthlyIncome: ["Total family monthly income is required."],
};

export default function SkeapApplicationWizard({ onSubmitted, requirements, footerActionsTarget, userProfile }: { onSubmitted: (reference: string) => void; requirements?: string[]; footerActionsTarget?: HTMLElement | null; userProfile: KKProfile }) {
  const [step, setStep] = useState(0);
  const parsedProfileName = parseProfileName(userProfile.fullName || "");
  const profileBirthDate = userProfile.birthDate ? String(userProfile.birthDate).slice(0, 10) : "";
  const profileAge = profileBirthDate ? computeAgeFromDateValue(profileBirthDate) : undefined;
  const profileVoterStatus = userProfile.registration?.registeredNationalVoter || userProfile.registeredNationalVoter;

  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [gwa, setGwa] = useState("");

  

  // Full SKEAP form fields (mirror DOCX)
  const lastName = parsedProfileName.lastName;
  const firstName = parsedProfileName.firstName;
  const middleInitial = parsedProfileName.middleInitial;
  const [schoolName, setSchoolName] = useState("");
  const applicantName = `${lastName}${firstName ? `, ${firstName}` : ""}${middleInitial ? ` ${middleInitial}` : ""}`;
  const permanentAddress = formatPermanentAddress([userProfile.purok, userProfile.barangay, userProfile.addressLine]);
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const dateOfBirth = profileBirthDate;
  const age = profileAge !== undefined ? String(profileAge) : String(userProfile.age ?? "");
  const civilStatus = userProfile.registration?.civilStatus || userProfile.civilStatus || "";
  const gender = userProfile.registration?.sex || userProfile.sex || "";
  const [fathersName, setFathersName] = useState("");
  const [fathersOccupation, setFathersOccupation] = useState("");
  const [fathersContact, setFathersContact] = useState("");
  const [mothersMaidenName, setMothersMaidenName] = useState("");
  const [mothersOccupation, setMothersOccupation] = useState("");
  const [mothersContact, setMothersContact] = useState("");
  const [contactNumber, setContactNumber] = useState(userProfile.contactNumber || "");
  const emailAddress = userProfile.email || "";
  const [registeredVoter, setRegisteredVoter] = useState<boolean | null>(
    typeof profileVoterStatus === "string"
      ? profileVoterStatus.toLowerCase() === "yes" || profileVoterStatus.toLowerCase() === "true"
      : null
  );
  const [totalFamilyMonthlyIncome, setTotalFamilyMonthlyIncome] = useState("");
  const isIncomingFreshman = yearLevel === "Incoming Freshman";

  function getUploadLabel(key: SkeapUploadKey) {
    if (key === SKEAP_UPLOAD_KEY.ENROLLMENT_CERT && isIncomingFreshman) {
      return "Notice of Admission / SHS Report Card";
    }
    return SKEAP_UPLOAD_LABELS[key];
  }

  // Educational background
  const [elementarySchool, setElementarySchool] = useState("");
  const [elementaryYearGraduated, setElementaryYearGraduated] = useState("");
  const [highSchool, setHighSchool] = useState("");
  const [highSchoolYearGraduated, setHighSchoolYearGraduated] = useState("");
  const [college, setCollege] = useState("");
  const [collegeYearGraduated, setCollegeYearGraduated] = useState("");
  const [vocational, setVocational] = useState("");
  const [vocationalYearGraduated, setVocationalYearGraduated] = useState("");

  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!message) return;

    const timer = window.setTimeout(() => setMessage(null), 3000);
    return () => window.clearTimeout(timer);
  }, [message]);

  const enrollmentFileUrl = useMemo(() => {
    const byRequirement = files.find((f) => f.status === "done" && f.requirement === SKEAP_UPLOAD_KEY.ENROLLMENT_CERT);
    if (byRequirement) return byRequirement.url;
    const byName = files.find((f) => f.status === "done" && f.name.toLowerCase().includes("enroll"));
    if (byName) return byName.url;
    return files.find((f) => f.status === "done")?.url;
  }, [files]);

  const photoFileRecord = useMemo(
    () => files.find((f) => f.status === "done" && f.url && f.requirement === SKEAP_UPLOAD_KEY.PHOTO),
    [files]
  );

  const photoFileUrl = photoFileRecord?.url;

  const reportCardFileUrl = useMemo(() => {
    const byRequirement = files.find((f) => f.status === "done" && f.requirement === SKEAP_UPLOAD_KEY.GRADE_REPORT);
    if (byRequirement) return byRequirement.url;
    const byName = files.find((f) => f.status === "done" && f.name.toLowerCase().includes("report"));
    if (byName) return byName.url;
    return files.filter((f) => f.status === "done")[1]?.url;
  }, [files]);

  function validateStep() {
    if (step === 0) {
      if (!lastName.trim() || !firstName.trim()) return "Last name and first name are required.";
      if (!permanentAddress.trim()) return "Permanent address is required.";
      if (!schoolName.trim()) return "School / Institution is required.";
      if (!dateOfBirth.trim()) return "Date of birth is required.";
      if (!placeOfBirth.trim()) return "Place of birth is required.";
      if (!age.trim()) return "Age is required.";
      const parsedAge = Number(age);
      if (Number.isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 120) return "Please enter a valid age.";
      if (!civilStatus.trim()) return "Civil status is required.";
      if (!gender.trim()) return "Gender is required.";
      if (!contactNumber.trim()) return "Contact number is required.";
      if (!emailAddress.trim()) return "Email address is required.";
      if (!photoFileUrl) return "Please upload a 2x2 photo (ID).";
      if (registeredVoter === null) return "Please indicate Registered Voter (Yes/No).";
      if (registeredVoter === true && Number(age) >= 18) {
        if (!isUploadCompleteForKey(files, SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE)) {
          return "Please upload a photocopy of the voter's certificate.";
        }
      }
    }
    if (step === 1) {
      if (!course.trim()) return "Course is required.";
      if (!yearLevel.trim()) return "Year level is required.";
      if (!fathersName.trim()) return "Father's name is required.";
      if (!fathersContact.trim()) return "Father's contact is required.";
      if (!mothersMaidenName.trim()) return "Mother's maiden name is required.";
      if (!mothersOccupation.trim()) return "Mother's occupation is required.";
      if (!mothersContact.trim()) return "Mother's contact is required.";
      if (!totalFamilyMonthlyIncome.trim()) return "Total family monthly income is required.";
    }
    if (step === 3) {
      const requiredKeys = getRequiredUploadKeys(requirements);
      const missingKeys = requiredKeys.filter((key) => !isUploadCompleteForKey(files, key));
      if (missingKeys.length > 0) {
        const label = SKEAP_UPLOAD_LABELS[missingKeys[0]] || "Required document";
        return `Please upload the required file: ${label}.`;
      }
    }
    return null;
  }

  function markFieldValid(name: string) {
    setInvalidFields((prev) => {
      if (!prev.has(name)) return prev;
      const copy = new Set(prev);
      copy.delete(name);
      return copy;
    });

    const matchingMessages = FIELD_VALIDATION_MESSAGES[name] ?? [];
    const isUploadKey = Object.values(SKEAP_UPLOAD_KEY).includes(name as SkeapUploadKey);
    setMessage((current) => {
      if (!current) return current;
      if (matchingMessages.includes(current)) return null;
      if (isUploadKey && current.startsWith("Please upload the required file:")) return null;
      return current;
    });
  }

  function markFieldsInvalid(names: string[]) {
    setInvalidFields(new Set(names));
  }

  function collectInvalidFieldsForStep(currentStep: number) {
    const missing: string[] = [];
    if (currentStep === 0) {
      if (!lastName.trim()) missing.push("lastName");
      if (!firstName.trim()) missing.push("firstName");
      if (!permanentAddress.trim()) missing.push("permanentAddress");
      if (!schoolName.trim()) missing.push("schoolName");
      if (!dateOfBirth.trim()) missing.push("dateOfBirth");
      if (!placeOfBirth.trim()) missing.push("placeOfBirth");
      if (!age.trim()) missing.push("age");
      if (!civilStatus.trim()) missing.push("civilStatus");
      if (!gender.trim()) missing.push("gender");
      if (!contactNumber.trim()) missing.push("contactNumber");
      if (!emailAddress.trim()) missing.push("emailAddress");
      if (!photoFileUrl) missing.push("photoFile");
      if (registeredVoter === null) missing.push("registeredVoter");
      if (registeredVoter === true && Number(age) >= 18) {
        if (!isUploadCompleteForKey(files, SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE)) {
          missing.push(SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE);
        }
      }
    }
    if (currentStep === 1) {
      if (!course.trim()) missing.push("course");
      if (!yearLevel.trim()) missing.push("yearLevel");
      if (!fathersName.trim()) missing.push("fathersName");
      if (!fathersContact.trim()) missing.push("fathersContact");
      if (!mothersMaidenName.trim()) missing.push("mothersMaidenName");
      if (!mothersOccupation.trim()) missing.push("mothersOccupation");
      if (!mothersContact.trim()) missing.push("mothersContact");
      if (!totalFamilyMonthlyIncome.trim()) missing.push("totalFamilyMonthlyIncome");
    }
    if (currentStep === 3) {
      const missingKeys = getRequiredUploadKeys(requirements).filter((key) => !isUploadCompleteForKey(files, key));
      if (missingKeys.length > 0) missing.push(...missingKeys);
    }
    if (missing.length) markFieldsInvalid(missing);
  }

  function goNext() {
    const err = validateStep();
    if (err) {
      collectInvalidFieldsForStep(step);
      if (step !== 3) {
        setMessage(err);
      }
      focusFirstInvalidInStep(step);
      return;
    }
    // clear any prior message before moving forward
    setMessage(null);
    setInvalidFields(new Set());
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function focusFirstInvalidInStep(currentStep: number) {
    try {
      if (currentStep === 3) {
        const missingKeys = getRequiredUploadKeys(requirements).filter((key) => !isUploadCompleteForKey(files, key));
        if (missingKeys.length > 0) {
          const missingKey = missingKeys[0];
          const uploadCard = document.getElementById(`upload-${missingKey}`);
          if (uploadCard) {
            uploadCard.scrollIntoView({ behavior: "smooth", block: "center" });
            uploadCard.focus();
            return;
          }
        }
      }

      const selector = currentStep === 0 ? "[data-required=profile]" : currentStep === 1 ? "[data-required=scholarship]" : "[data-required=profile]";
      const els = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector));
      const firstEmpty = els.find((el) => !(el as HTMLInputElement).value || !(el as HTMLInputElement).value.toString().trim());
      if (firstEmpty) {
        firstEmpty.scrollIntoView({ behavior: "smooth", block: "center" });
        (firstEmpty as HTMLElement).focus();
        return;
      }

      if (currentStep === 0) {
        const voterInput = document.querySelector<HTMLInputElement>("input[type=file][data-requirement=\"voter_certificate\"]");
        if (voterInput) {
          voterInput.scrollIntoView({ behavior: "smooth", block: "center" });
          voterInput.focus();
        }
      }
    } catch (e) {
      // ignore DOM focus errors
    }
  }

  function goBack() {
    setMessage(null);
    setStep((s) => Math.max(0, s - 1));
  }

  async function onChooseFiles(list: FileList | File[] | null, requirement?: string): Promise<string | null> {
    let id = "";
    try {
      const filesArray = Array.from(list || []);
      if (filesArray.length === 0) return null;

      const file = filesArray[0];
      id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const normalizedRequirement = requirement ? normalizeUploadRequirement(requirement) : normalizeUploadRequirement(file.name || "");
      const normalizedKey = normalizedRequirement || normalizeUploadRequirement(file.name || "");

      const newUpload: UploadedFile = {
        id,
        name: file.name,
        progress: 0,
        status: "queued",
        requirement: normalizedKey,
      };

      if (file.size === 0) {
        const errorText = "The selected file is empty. Please choose a non-empty file.";
        console.error("SKEAP upload failed: zero-byte file", { requirement, normalizedKey, fileName: file.name });
        setFiles((prev) => [
          ...prev.filter((f) => f.requirement !== normalizedKey),
          { ...newUpload, status: "error", error: errorText },
        ]);
        return errorText;
      }

      setFiles((prev) => [
        ...prev.filter((f) => f.requirement !== normalizedKey),
        newUpload,
      ]);

      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "uploading" } : f)));
      const result = await uploadWithProgress(file, (pct) => {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: pct } : f)));
      });
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "done", progress: 100, url: result.url } : f)));

      if (normalizedKey) {
        markFieldValid(normalizedKey);
      }
      return null;
    } catch (err) {
      const text = err instanceof Error ? err.message : "Upload failed";
      console.error("SKEAP upload failed", { requirement, error: text, rawError: err });
      if (id) {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error", error: text } : f)));
      }
      return text;
    }
  }

  async function submitApplication() {
    const err = validateStep();
    if (err) {
      collectInvalidFieldsForStep(step);
      setMessage(err);
      focusFirstInvalidInStep(step);
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const doneUrls = files.filter((f) => f.status === "done").map((f) => f.url).filter(Boolean) as string[];
      const requiredUploadKeys = getRequiredUploadKeys(requirements);
      const documentUploads = requiredUploadKeys.reduce<Partial<Record<SkeapUploadKey, SkeapUploadValue>>>((acc, key) => {
        const file = findUploadFileForKey(files, key);
        if (file?.status === "done" && file.url?.trim()) {
          acc[key] = { name: file.name, url: file.url.trim() };
        }
        return acc;
      }, {});

      const missingUploadKeys = requiredUploadKeys.filter((key) => !documentUploads[key]?.url?.trim());
      if (missingUploadKeys.length > 0) {
        setMessage(
          `Please upload required document${missingUploadKeys.length > 1 ? "s" : ""}: ${missingUploadKeys
            .map((key) => getUploadLabel(key) || key)
            .join(", ")}`
        );
        setSubmitting(false);
        return;
      }

      const enrollmentFileUrl =
        files.find((f) => f.status === "done" && f.requirement === SKEAP_UPLOAD_KEY.ENROLLMENT_CERT)?.url ||
        doneUrls[0] ||
        "";
      const reportCardFileUrl =
        files.find((f) => f.status === "done" && f.requirement === SKEAP_UPLOAD_KEY.GRADE_REPORT)?.url ||
        doneUrls.find((url) => url !== enrollmentFileUrl) ||
        doneUrls[1] ||
        "";
      const photoFileUrl =
        files.find((f) => f.status === "done" && f.requirement === SKEAP_UPLOAD_KEY.PHOTO)?.url ||
        doneUrls.find((url) => url !== enrollmentFileUrl && url !== reportCardFileUrl) ||
        doneUrls.find(Boolean) ||
        "";
      const voterCertificateFileUrl =
        files.find((f) => f.status === "done" && f.requirement === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE)?.url || null;

      if (!enrollmentFileUrl || !reportCardFileUrl) {
        setMessage(
          isIncomingFreshman
            ? "Please upload your Notice of Admission / SHS Report Card and latest grade report before submitting."
            : "Please upload the required enrollment and grade report files before submitting."
        );
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/skeap/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName,
          currentCourse: course,
          yearLevel,
          gwa: gwa,
          enrollmentFileUrl: enrollmentFileUrl || doneUrls[0],
          reportCardFileUrl: reportCardFileUrl || doneUrls[1],
          photoFileUrl: photoFileUrl || doneUrls.find(Boolean),
          // additional mirrored form fields (backend may ignore, but keep for future use)
          applicantName,
          permanentAddress,
          dateOfBirth,
          placeOfBirth,
          age,
          civilStatus,
          gender,
          fathersName,
          fathersOccupation,
          fathersContact,
          mothersMaidenName,
          mothersOccupation,
          mothersContact,
          contactNumber,
          emailAddress,
          registeredVoter,
          voterCertificateFileUrl: doneUrls.find((u, idx) => files.findIndex((f) => f.requirement === "voter_certificate" && f.url === u) >= 0) || null,
          totalFamilyMonthlyIncome,
          educationalBackground: {
            elementary: elementarySchool,
            elementaryYearGraduated,
            highSchool,
            highSchoolYearGraduated,
            college,
            collegeYearGraduated,
            vocational,
            vocationalYearGraduated,
          },
          uploadedFiles: documentUploads,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(body?.error || "Failed to submit SKEAP application.");
        return;
      }

      const reference = String(body.inquiryId || body.applicationId || "");
      onSubmitted(reference);
    } catch {
      setMessage("Network error while submitting application.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Application Form</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Complete your SKEAP application form</h2>
          </div>
        </div>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The fields below are the actual application form for SKEAP. Complete each section and upload the required documents to submit your application.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {STEPS.map((label, idx) => (
          <div
            key={label}
            className={`rounded-full px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] ${
              idx === step
                ? "bg-[#0F3D5C] text-white"
                : idx < step
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500"
            }`}
          >
            {label}
          </div>
        ))}
      </div>


      {step === 0 ? (
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6">
          <h4 className="text-sm font-semibold">Personal Information</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <label className="flex flex-col min-w-0">
              <span className="text-sm font-semibold">Last Name</span>
              <input
                readOnly
                value={lastName}
                data-required="profile"
                className={`mt-1 w-full min-w-0 cursor-not-allowed rounded-lg border bg-slate-50 px-3 py-2 text-slate-500 focus:outline-none ${invalidFields.has("lastName") ? "border-rose-600" : "border-slate-200"}`}
              />
            </label>
            <label className="flex flex-col min-w-0">
              <span className="text-sm font-semibold">First Name</span>
              <input
                readOnly
                value={firstName}
                data-required="profile"
                className={`mt-1 w-full min-w-0 cursor-not-allowed rounded-lg border bg-slate-50 px-3 py-2 text-slate-500 focus:outline-none ${invalidFields.has("firstName") ? "border-rose-600" : "border-slate-200"}`}
              />
            </label>
            <label className="flex flex-col min-w-0">
              <span className="text-sm font-semibold">M.I.</span>
              <input
                readOnly
                value={middleInitial}
                className="mt-1 w-full min-w-0 cursor-not-allowed rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-slate-500 focus:outline-none"
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 gap-4">
            <label className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">Permanent Address</span>
              <input
                readOnly
                data-required="profile"
                value={permanentAddress}
                className={`mt-1 w-full min-w-0 cursor-not-allowed rounded-lg border bg-slate-50 px-3 py-2 text-slate-500 focus:outline-none ${invalidFields.has("permanentAddress") ? "border-rose-600" : "border-slate-200"}`}
              />
            </label>
            <label className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">School / Institution</span>
              <select
                data-required="profile"
                value={schoolName}
                onChange={(e) => {
                  setSchoolName(e.target.value);
                  markFieldValid("schoolName");
                }}
                className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900 shadow-sm transition-colors focus:ring-2 ${invalidFields.has("schoolName") ? "border-rose-600 focus:border-rose-600 focus:ring-rose-200" : "border-slate-300 focus:border-slate-900 focus:ring-slate-900"}`}
              >
                <option value="">Select your school</option>
                <option value="Benguet State University (BSU)">Benguet State University (BSU)</option>
                <option value="King's College of the Philippines (KCP)">King's College of the Philippines (KCP)</option>
                <option value="Cordillera Career Development College (CCDC)">Cordillera Career Development College (CCDC)</option>
                <option value="Star Colleges">Star Colleges</option>
                <option value="BVS Colleges">BVS Colleges</option>
              </select>
            </label>
          </div>

          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 md:grid-cols-2">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Date of Birth</span>
              <input
                data-required="profile"
                type="date"
                min="1995-01-01"
                max={`${new Date().getFullYear() - 1}-12-31`}
                value={dateOfBirth}
                readOnly
                className={`mt-1 w-full cursor-not-allowed rounded-lg border bg-slate-50 px-3 py-2 text-slate-500 focus:outline-none ${invalidFields.has("dateOfBirth") ? "border-rose-600" : "border-slate-200"}`}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Place of Birth</span>
              <input
                data-required="profile"
                value={placeOfBirth}
                onChange={(e) => {
                  setPlaceOfBirth(e.target.value);
                  markFieldValid("placeOfBirth");
                }}
                className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900 shadow-sm transition-colors focus:ring-2 ${invalidFields.has("placeOfBirth") ? "border-rose-600 focus:border-rose-600 focus:ring-rose-200" : "border-slate-300 focus:border-slate-900 focus:ring-slate-900"}`}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Age</span>
              <input
                data-required="profile"
                type="number"
                min="0"
                value={age}
                readOnly
                className={`mt-1 w-full cursor-not-allowed rounded-lg border bg-slate-50 px-3 py-2 text-slate-500 focus:outline-none ${invalidFields.has("age") ? "border-rose-600" : "border-slate-200"}`}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Civil Status</span>
              <select
                disabled
                data-required="profile"
                value={civilStatus}
                className={`mt-1 w-full cursor-not-allowed rounded-lg border bg-slate-50 px-3 py-2 text-slate-500 ${invalidFields.has("civilStatus") ? "border-rose-600" : "border-slate-200"}`}
              >
                <option value="">Select status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Other">Other</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Gender</span>
              <select
                disabled
                data-required="profile"
                value={gender}
                className={`mt-1 w-full cursor-not-allowed rounded-lg border bg-slate-50 px-3 py-2 text-slate-500 ${invalidFields.has("gender") ? "border-rose-600" : "border-slate-200"}`}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Contact Number</span>
              <input
                data-required="profile"
                value={contactNumber}
                onChange={(e) => {
                  setContactNumber(e.target.value);
                  markFieldValid("contactNumber");
                }}
                className={`mt-1 w-full rounded-lg border bg-white px-3 py-2 text-slate-900 shadow-sm transition-colors focus:ring-2 ${invalidFields.has("contactNumber") ? "border-rose-600 focus:border-rose-600 focus:ring-rose-200" : "border-slate-300 focus:border-slate-900 focus:ring-slate-900"}`}
              />
            </label>
            <label className="flex flex-col md:col-span-2">
              <span className="text-sm font-semibold">Email Address</span>
              <input
                readOnly
                data-required="profile"
                value={emailAddress}
                className={`mt-1 w-full cursor-not-allowed rounded-lg border bg-slate-50 px-3 py-2 text-slate-500 focus:outline-none ${invalidFields.has("emailAddress") ? "border-rose-600" : "border-slate-200"}`}
              />
            </label>
            <div className="mt-2 md:col-span-2">
              <p className="mb-2 block text-sm font-semibold text-slate-900">2x2 Photo (ID) *</p>
              <p className="mb-4 text-sm text-slate-500">Upload a clear portrait photo. We will crop it to 2x2 for you.</p>
              <SmartPortraitDropzone
                uploadedUrl={photoFileUrl}
                uploadedName={photoFileRecord?.name}
                onFileSelected={async (file) => {
                  markFieldValid("photoFile");
                  const uploadError = await onChooseFiles([file], "2x2 Photo");
                  if (uploadError) throw new Error(uploadError);
                }}
                onPreview={(previewUrl) => setPreviewPhotoUrl(previewUrl)}
                onRemove={() => setFiles((prev) => prev.filter((file) => file.requirement !== SKEAP_UPLOAD_KEY.PHOTO))}
              />
              {invalidFields.has("photoFile") ? (
                <p className="mt-2 text-sm text-red-700">Please upload a valid 2x2 photo.</p>
              ) : null}
            </div>
            <div className="mt-2 flex flex-col gap-2 md:col-span-2">
              <span className="text-sm font-semibold text-slate-900">Registered Voter</span>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={registeredVoter === true}
                    onChange={() => {
                      setRegisteredVoter(true);
                      markFieldValid("registeredVoter");
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">Yes</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={registeredVoter === false}
                    onChange={() => {
                      setRegisteredVoter(false);
                      markFieldValid("registeredVoter");
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">No</span>
                </label>
              </div>
              <p className="text-xs text-slate-500">*(If yes, please present voter’s certificate and attach a photocopy of voter’s certificate for 18 years old and above only)</p>
              {registeredVoter === true && Number(age) >= 18 ? (
                <div className="mt-2">
                  <label className="text-sm font-semibold">Voter's certificate (photocopy)</label>
                  <div className="mt-2">
                    <input
                      data-required="profile"
                      data-requirement="voter_certificate"
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => onChooseFiles(e.target.files, 'voter_certificate')}
                      className={`w-full rounded-xl border px-3 py-2 text-sm ${invalidFields.has("voter_certificate") ? "border-rose-600" : "border-slate-300"}`}
                    />
                    {(() => {
                      const voterFile = files.find((f) => f.requirement === 'voter_certificate' && f.status === 'done' && typeof f.url === 'string' && f.url.trim());
                      return voterFile ? (
                        <div className="mt-2 text-xs text-slate-600">Uploaded: <a href={voterFile.url} target="_blank" rel="noreferrer" className="underline">View file</a></div>
                      ) : null;
                    })()}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <EditableField label="Current / Intended Course" value={course} onChange={setCourse} placeholder="e.g., BS Information Technology" />
            <label className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Year level</span>
              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="">Select year level</option>
                {YEAR_LEVELS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            <h4 className="text-sm font-semibold">FAMILY BACKGROUND</h4>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Father's Name</span>
                <input
                  data-required="profile"
                  value={fathersName}
                  onChange={(e) => {
                    setFathersName(e.target.value);
                    markFieldValid("fathersName");
                  }}
                  className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("fathersName") ? "border-rose-600" : "border-slate-300"}`}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Father's occupation</span>
                <input
                  data-required="profile"
                  value={fathersOccupation}
                  onChange={(e) => {
                    setFathersOccupation(e.target.value);
                    markFieldValid("fathersOccupation");
                  }}
                  className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("fathersOccupation") ? "border-rose-600" : "border-slate-300"}`}
                />
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Father's contact</span>
                <input
                  data-required="profile"
                  value={fathersContact}
                  onChange={(e) => {
                    setFathersContact(e.target.value);
                    markFieldValid("fathersContact");
                  }}
                  className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("fathersContact") ? "border-rose-600" : "border-slate-300"}`}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mother's maiden name</span>
                <input
                  data-required="profile"
                  value={mothersMaidenName}
                  onChange={(e) => {
                    setMothersMaidenName(e.target.value);
                    markFieldValid("mothersMaidenName");
                  }}
                  className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("mothersMaidenName") ? "border-rose-600" : "border-slate-300"}`}
                />
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mother's occupation</span>
                <input
                  data-required="profile"
                  value={mothersOccupation}
                  onChange={(e) => {
                    setMothersOccupation(e.target.value);
                    markFieldValid("mothersOccupation");
                  }}
                  className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("mothersOccupation") ? "border-rose-600" : "border-slate-300"}`}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mother's contact</span>
                <input
                  data-required="profile"
                  value={mothersContact}
                  onChange={(e) => {
                    setMothersContact(e.target.value);
                    markFieldValid("mothersContact");
                  }}
                  className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("mothersContact") ? "border-rose-600" : "border-slate-300"}`}
                />
              </label>
            </div>
            <div className="mt-3">
              <label className="flex flex-col">
                <span className="text-sm font-semibold">Total Family Monthly Income</span>
                <input
                  data-required="profile"
                  value={totalFamilyMonthlyIncome}
                  onChange={(e) => {
                    setTotalFamilyMonthlyIncome(e.target.value);
                    markFieldValid("totalFamilyMonthlyIncome");
                  }}
                  className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("totalFamilyMonthlyIncome") ? "border-rose-600" : "border-slate-300"}`}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

        {step === 2 ? (
          <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5">
            <h4 className="text-sm font-semibold">EDUCATIONAL BACKGROUND</h4>
            <div className="grid gap-3">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Elementary</span>
                  <input value={elementarySchool} onChange={(e) => setElementarySchool(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Year Graduated</span>
                  <input value={elementaryYearGraduated} onChange={(e) => setElementaryYearGraduated(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">High School</span>
                  <input value={highSchool} onChange={(e) => setHighSchool(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Year Graduated</span>
                  <input value={highSchoolYearGraduated} onChange={(e) => setHighSchoolYearGraduated(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">College</span>
                  <input value={college} onChange={(e) => setCollege(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Year Graduated</span>
                  <input value={collegeYearGraduated} onChange={(e) => setCollegeYearGraduated(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Vocational</span>
                  <input value={vocational} onChange={(e) => setVocational(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Year Graduated</span>
                  <input value={vocationalYearGraduated} onChange={(e) => setVocationalYearGraduated(e.target.value)} className="mt-1 rounded-xl border px-3 py-2" />
                </label>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-5">
          <p className="text-sm font-semibold text-slate-900">Upload your required application documents</p>

          <div className="mt-3 grid gap-3">
            {getRequiredUploadKeys(requirements).map((key) => {
              const label = getUploadLabel(key);
              const inputId = `file-input-${key}`;
              const matchingFile = findUploadFileForKey(files, key);
              const isReady = matchingFile?.status === "done" && Boolean(matchingFile.url);
              const statusLabel = matchingFile?.status === "done"
                ? "Ready"
                : matchingFile?.status === "uploading"
                ? `Uploading ${matchingFile.progress}%`
                : matchingFile?.status === "queued"
                ? "Queued"
                : matchingFile?.status === "error"
                ? "Failed"
                : "Pending";
              const statusBadgeClass = matchingFile?.status === "done"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : matchingFile?.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : matchingFile?.status === "uploading"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : "border-slate-200 bg-slate-100 text-slate-500";
              return (
                <div
                  key={key}
                  id={`upload-${key}`}
                  tabIndex={-1}
                  className={`flex flex-col rounded-2xl border p-5 ${invalidFields.has(key) ? "border-rose-600 bg-rose-50" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{label}</p>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusBadgeClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <input
                    id={inputId}
                    name={key}
                    type="file"
                    accept="image/*,application/pdf"
                    data-requirement={key}
                    onChange={(e) => {
                      onChooseFiles(e.target.files, key);
                      e.currentTarget.value = "";
                    }}
                    className="sr-only"
                    aria-label={`${isReady ? "Replace" : "Upload"} ${label}`}
                  />

                  {isReady && matchingFile ? (
                    <div className="mt-3 flex min-w-0 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-3 pl-4 shadow-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        <FileText className="h-5 w-5 shrink-0 text-emerald-500" aria-hidden="true" />
                        <span className="min-w-0 truncate text-sm font-medium text-slate-900">{matchingFile.name}</span>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2">
                        <a
                          href={matchingFile.url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-900"
                        >
                          View
                        </a>
                        <label
                          htmlFor={inputId}
                          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          Replace
                        </label>
                      </div>
                    </div>
                  ) : (
                    <label
                      htmlFor={inputId}
                      className="mt-3 flex cursor-pointer items-center justify-between rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 transition-colors hover:bg-slate-100"
                    >
                      <span className="flex items-center gap-3">
                        <UploadCloud className="h-5 w-5 text-slate-400" aria-hidden="true" />
                        <span className="text-sm font-medium text-slate-600">Click to upload document</span>
                      </span>
                      <span className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold shadow-sm hover:bg-slate-50">
                        Browse
                      </span>
                    </label>
                  )}
                  {matchingFile?.error ? <p className="mt-2 text-xs text-rose-700">{matchingFile.error}</p> : null}
                </div>
              );
            })}
          </div>

          <div className="mt-4 space-y-2">
            {files
              .filter((file) => !file.requirement)
              .map((file) => (
                <div key={file.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2 text-sm">
                  <span className="truncate pr-3 text-slate-700">{file.name}</span>
                  <span className="text-xs text-slate-500">
                    {file.status === "uploading"
                      ? `Uploading ${file.progress}%`
                      : file.status === "done"
                      ? "Ready"
                      : file.status === "error"
                      ? "Failed"
                      : "Queued"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {/* validation messages removed per request */}

      {previewPhotoUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="relative max-h-[90vh] w-full max-w-lg overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setPreviewPhotoUrl(null)}
              className="absolute right-4 top-4 rounded-full border border-slate-200 bg-white p-2 text-slate-700 shadow-sm"
              aria-label="Close photo preview"
            >
              ×
            </button>
            <img src={previewPhotoUrl} alt="2x2 photo preview" className="h-full w-full object-contain bg-slate-950" />
          </div>
        </div>
      ) : null}

      {message ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert" aria-live="polite">
          {message}
        </div>
      ) : null}

      {footerActionsTarget ? createPortal(
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || submitting}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={submitting}
              className="rounded-lg bg-[#0F3D5C] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-[#0a2f47] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          ) : (
            <button
              type="button"
              onClick={submitApplication}
              disabled={submitting}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? "Submitting..." : "Submit application"}
            </button>
          )}
        </div>,
        footerActionsTarget
      ) : null}
    </div>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  return (
    <label className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input readOnly value={value} className="mt-1 rounded-xl border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-700" />
    </label>
  );
}

function EditableField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
}) {
  return (
    <label className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
      />
    </label>
  );
}

async function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);

    xhr.open("POST", "/api/grantee/submissions/upload");

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText || "{}");
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve({ url: body.url });
        } else {
          reject(new Error(body?.error || `Upload failed (${xhr.status})`));
        }
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Upload failed"));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.onabort = () => reject(new Error("Upload aborted"));

    xhr.send(fd);
  });
}
