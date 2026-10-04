"use client";

import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { AlertTriangle, CheckCircle2, FileText, LoaderCircle, UploadCloud } from "lucide-react";
import {
  CORE_UPLOAD_KEYS,
  SKEAP_UPLOAD_KEY,
  SKEAP_UPLOAD_LABELS,
  normalizeUploadRequirement,
  type SkeapUploadKey,
} from "@/lib/skeap-upload";
import SmartPortraitDropzone from "@/components/SmartPortraitDropzone";
import type { KKProfile } from "@/lib/kk-profile-client";
import { validateDocumentOCR, type DocumentOCRResult } from "@/lib/skeap-document-ocr";

type UploadedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  url?: string;
  error?: string;
  requirement?: string;
  previewUrl?: string;
  verification?: "scanning" | "verified" | "review" | "overridden" | "skipped";
  verificationMessage?: string;
  file?: File;
};

type SkeapUploadValue = {
  name?: string;
  url: string;
};

const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024;
const ACCEPTED_DOCUMENT_TYPES = "image/*,application/pdf,.doc,.docx";
const MANUAL_REVIEW_MESSAGE = "We couldn't verify this document automatically. If your uploaded file is clear and correct, you can safely proceed anyway.";

function isServerValidatedSkeapFile(file: File) {
  return /\.docx$/i.test(file.name) ||
    file.type.startsWith("image/") && /\.(jpe?g|jfif|png|webp)$/i.test(file.name);
}

async function validateBirthCertificateDocument(file: File): Promise<DocumentOCRResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE);

  const response = await fetch("/api/validate-document", {
    method: "POST",
    body: formData,
  });
  const result = await response.json() as {
    status?: string;
    message?: string;
    text?: string;
  };
  if (!response.ok) {
    throw new Error(result.message || "The document could not be checked.");
  }

  if (result.status === "verified") {
    return {
      status: "verified",
      extractedText: result.text || "",
      confidence: 100,
    };
  }

  return {
    status: "review",
    extractedText: result.text || "",
    confidence: 0,
    reason: result.message || "This document needs manual verification.",
  };
}

function isPreviewableImage(file: Pick<UploadedFile, "name"> & { type?: string }) {
  return Boolean(file.type?.startsWith("image/")) || /\.(jpe?g|jfif|png|webp|gif|avif)$/i.test(file.name);
}

function isPdfFile(file: Pick<UploadedFile, "name">) {
  return /\.pdf$/i.test(file.name);
}

function canPreviewInline(file: Pick<UploadedFile, "name"> & { type?: string }) {
  return isPreviewableImage(file) || isPdfFile(file);
}

function isViewableInBrowser(file: Pick<UploadedFile, "name">) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  return ["pdf", "png", "jpg", "jpeg", "webp"].includes(extension || "");
}

function getFileBadge(file: Pick<UploadedFile, "name">) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const badge = extension === "pdf"
    ? { label: "PDF", className: "bg-red-50 text-red-700" }
    : extension === "docx"
      ? { label: "DOCX", className: "bg-blue-50 text-blue-700" }
      : extension === "doc"
        ? { label: "DOC", className: "bg-blue-50 text-blue-700" }
        : { label: "IMG", className: "bg-emerald-50 text-emerald-700" };

  return (
    <span className={`rounded px-2 py-1 text-[10px] font-bold ${badge.className}`}>
      {badge.label}
    </span>
  );
}

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
  const exactMatch = [...files].reverse().find((file) => file.requirement === key);
  if (exactMatch) return exactMatch;

  return [...files].reverse().find((file) =>
    normalizeUploadRequirement(file.requirement || file.name || "") === key
  );
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
    const middleName = nameParts.join(" ");
    return { lastName, firstName, middleName };
  }

  const nameParts = normalizedName.split(/\s+/).filter(Boolean);
  if (nameParts.length === 1) {
    return { lastName: "", firstName: nameParts[0], middleName: "" };
  }
  if (nameParts.length === 2) {
    return { lastName: nameParts[1], firstName: nameParts[0], middleName: "" };
  }
  return {
    lastName: nameParts[nameParts.length - 1] || "",
    firstName: nameParts[0] || "",
    middleName: nameParts.slice(1, -1).join(" "),
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

const STEPS = ["Profile", "School", "Educational Background", "Uploads", "Signature"] as const;
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
  middleName: ["Middle name is required."],
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
  fathersOccupation: ["Father's occupation is required."],
  fathersContact: ["Father's contact is required."],
  mothersMaidenName: ["Mother's maiden name is required."],
  mothersOccupation: ["Mother's occupation is required."],
  mothersContact: ["Mother's contact is required."],
  totalFamilyMonthlyIncome: ["Total family monthly income is required."],
  applicantSignature: ["Please provide a signature."],
};

export default function SkeapApplicationWizard({ onSubmitted, requirements, footerActionsTarget, scrollContainerRef, userProfile, allowManualProfileDetails = false }: { onSubmitted: (reference: string) => void; requirements?: string[]; footerActionsTarget?: HTMLElement | null; scrollContainerRef: RefObject<HTMLDivElement | null>; userProfile: KKProfile; allowManualProfileDetails?: boolean }) {
  const [step, setStep] = useState(0);
  const parsedProfileName = parseProfileName(userProfile.fullName || "");
  const profileBirthDate = userProfile.birthDate ? String(userProfile.birthDate).slice(0, 10) : "";
  const profileAge = profileBirthDate ? computeAgeFromDateValue(profileBirthDate) : undefined;
  const profileVoterStatus = userProfile.registration?.registeredNationalVoter || userProfile.registeredNationalVoter;

  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [gwa, setGwa] = useState("");

  

  // Full SKEAP form fields (mirror DOCX)
  const [lastName, setLastName] = useState(parsedProfileName.lastName);
  const [firstName, setFirstName] = useState(parsedProfileName.firstName);
  const [middleName, setMiddleName] = useState(userProfile.middleName?.trim() || parsedProfileName.middleName);
  const [schoolName, setSchoolName] = useState("");
  const applicantName = `${lastName.trim()}${firstName.trim() ? `, ${firstName.trim()}` : ""}${middleName.trim() ? ` ${middleName.trim()}` : ""}`;
  const [permanentAddress, setPermanentAddress] = useState(
    formatPermanentAddress([userProfile.purok, userProfile.barangay, userProfile.addressLine])
  );
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState(profileBirthDate);
  const [age, setAge] = useState(profileAge !== undefined ? String(profileAge) : String(userProfile.age ?? ""));
  const [civilStatus, setCivilStatus] = useState(
    userProfile.registration?.civilStatus || userProfile.civilStatus || ""
  );
  const [gender, setGender] = useState(userProfile.registration?.sex || userProfile.sex || "");
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
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
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
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showGlobalError, setShowGlobalError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const previewObjectUrlsRef = useRef(new Set<string>());
  const previewFile = files.find((file) => file.id === previewFileId) ?? null;

  useEffect(() => () => {
    previewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [step, scrollContainerRef]);

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

  function validateStep(): { invalidFields: string[]; errors: Record<string, string> } {
    const invalid: string[] = [];
    const errors: Record<string, string> = {};
    const addError = (field: string, text: string) => {
      invalid.push(field);
      errors[field] = text;
    };

    if (step === 0) {
      if (!lastName.trim()) addError("lastName", "Last name is required.");
      if (!firstName.trim()) addError("firstName", "First name is required.");
      if (!middleName.trim()) addError("middleName", "Middle name is required.");
      if (!permanentAddress.trim()) addError("permanentAddress", "Permanent address is required.");
      if (!schoolName.trim()) addError("schoolName", "School / Institution is required.");
      if (!dateOfBirth.trim()) addError("dateOfBirth", "Date of birth is required.");
      if (!placeOfBirth.trim()) addError("placeOfBirth", "Place of birth is required.");
      const parsedAge = Number(age);
      if (!age.trim()) {
        addError("age", "Age is required.");
      } else if (Number.isNaN(parsedAge) || parsedAge <= 0 || parsedAge > 120) {
        addError("age", "Please enter a valid age between 1 and 120.");
      }
      if (!civilStatus.trim()) addError("civilStatus", "Civil status is required.");
      if (!gender.trim()) addError("gender", "Gender is required.");
      if (!contactNumber.trim()) addError("contactNumber", "Contact number is required.");
      if (!emailAddress.trim()) addError("emailAddress", "Email address is required.");
      if (!photoFileUrl) addError("photoFile", "Please upload a 2x2 photo (ID).");
      if (registeredVoter === null) addError("registeredVoter", "Please indicate Registered Voter (Yes/No).");
      if (registeredVoter === true && Number(age) >= 18) {
        if (!isUploadCompleteForKey(files, SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE)) {
          addError(SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE, "Please upload a photocopy of the voter's certificate.");
        }
      }
    }
    if (step === 1) {
      if (!course.trim()) addError("course", "Course is required.");
      if (!yearLevel.trim()) addError("yearLevel", "Year level is required.");
      if (!fathersName.trim()) addError("fathersName", "Father's name is required.");
      if (!fathersOccupation.trim()) addError("fathersOccupation", "Father's occupation is required.");
      if (!fathersContact.trim()) addError("fathersContact", "Father's contact is required.");
      if (!mothersMaidenName.trim()) addError("mothersMaidenName", "Mother's maiden name is required.");
      if (!mothersOccupation.trim()) addError("mothersOccupation", "Mother's occupation is required.");
      if (!mothersContact.trim()) addError("mothersContact", "Mother's contact is required.");
      if (!totalFamilyMonthlyIncome.trim()) addError("totalFamilyMonthlyIncome", "Total family monthly income is required.");
    }
    if (step === 3) {
      const requiredKeys = getRequiredUploadKeys(requirements);
      const missingKeys = requiredKeys.filter((key) => !isUploadCompleteForKey(files, key));
      for (const key of missingKeys) {
        const label = SKEAP_UPLOAD_LABELS[key] || "Required document";
        addError(key, `Please upload the required file: ${label}.`);
      }
    }
    if (step === 4 && !signatureUrl) addError("applicantSignature", "Please provide a signature.");
    return { invalidFields: invalid, errors };
  }

  function markFieldValid(name: string) {
    setInvalidFields((prev) => {
      if (!prev.has(name)) return prev;
      const copy = new Set(prev);
      copy.delete(name);
      return copy;
    });
    setValidationErrors((prev) => {
      if (!(name in prev)) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
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

  function goNext() {
    const validation = validateStep();
    if (validation.invalidFields.length > 0) {
      setInvalidFields(new Set(validation.invalidFields));
      setValidationErrors(validation.errors);
      setShowGlobalError(true);
      setMessage(null);
      focusFirstInvalidInStep(step);
      return;
    }
    // clear any prior message before moving forward
    setMessage(null);
    setInvalidFields(new Set());
    setValidationErrors({});
    setShowGlobalError(false);
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  }

  function focusFirstInvalidInStep(currentStep: number) {
    try {
      if (currentStep === 4) {
        if (!signatureUrl) {
          const signature = document.getElementById("applicant-signature");
          signature?.scrollIntoView({ behavior: "smooth", block: "center" });
          signature?.querySelector("canvas")?.focus();
        }
        return;
      }

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

      const selector = currentStep === 0
        ? "[data-required=profile]"
        : currentStep === 1
          ? "[data-required=scholarship]"
          : currentStep === 2
            ? "[data-required=education]"
            : "[data-required=profile]";
      const els = Array.from(document.querySelectorAll<HTMLInputElement | HTMLSelectElement>(selector));
      const firstEmpty = els.find((el) => !(el as HTMLInputElement).value || !(el as HTMLInputElement).value.toString().trim());
      if (firstEmpty) {
        requestAnimationFrame(() => {
          firstEmpty.scrollIntoView({ behavior: "smooth", block: "center" });
          if (!(firstEmpty instanceof HTMLSelectElement)) {
            firstEmpty.focus({ preventScroll: true });
          }
        });
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
    setValidationErrors({});
    setInvalidFields(new Set());
    setShowGlobalError(false);
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
      const hasOCRRules = normalizedKey !== SKEAP_UPLOAD_KEY.PHOTO && normalizedKey !== SKEAP_UPLOAD_KEY.OTHER;
      const previewUrl = URL.createObjectURL(file);
      previewObjectUrlsRef.current.add(previewUrl);
      files
        .filter((existingFile) => existingFile.requirement === normalizedKey && existingFile.previewUrl)
        .forEach((existingFile) => {
          URL.revokeObjectURL(existingFile.previewUrl!);
          previewObjectUrlsRef.current.delete(existingFile.previewUrl!);
        });

      const newUpload: UploadedFile = {
        id,
        name: file.name,
        type: file.type,
        size: file.size,
        previewUrl,
        progress: 0,
        status: "queued",
        requirement: normalizedKey,
        verification: hasOCRRules ? "scanning" : "skipped",
        file,
      };

      if (file.size > MAX_UPLOAD_SIZE_BYTES) {
        const errorText = "File size exceeds the 15MB limit. Please upload a smaller file.";
        setFiles((prev) => [
          ...prev.filter((f) => f.requirement !== normalizedKey),
          { ...newUpload, status: "error", verification: "skipped", error: errorText },
        ]);
        return errorText;
      }

      if (file.size === 0) {
        const errorText = "This file is empty. Please choose another file.";
        setFiles((prev) => [
          ...prev.filter((f) => f.requirement !== normalizedKey),
          { ...newUpload, status: "error", verification: "skipped", error: errorText },
        ]);
        return errorText;
      }

      setFiles((prev) => [
        ...prev.filter((f) => f.requirement !== normalizedKey),
        newUpload,
      ]);
      if (normalizedKey) markFieldValid(normalizedKey);

      if (hasOCRRules) {
        try {
          const validation = normalizedKey === SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE && isServerValidatedSkeapFile(file)
            ? await validateBirthCertificateDocument(file)
            : await validateDocumentOCR(file, normalizedKey);
          if (validation.status === "review") {
            setFiles((prev) => prev.map((f) => f.id === id
              ? {
                  ...f,
                  verification: "review",
                  verificationMessage: validation.reason,
                }
              : f));
          } else {
            setFiles((prev) => prev.map((f) => f.id === id
              ? { ...f, verification: validation.status }
              : f));
          }
        } catch (error) {
          console.error("SKEAP document OCR failed; applicant review is required.", {
            requirement: normalizedKey,
            fileName: file.name,
            error,
          });
          setFiles((prev) => prev.map((f) => f.id === id
            ? {
                ...f,
                verification: "review",
                verificationMessage: "We couldn't check this file automatically.",
              }
            : f));
        }
      }

      const uploaded = await uploadPendingFile(id, file, normalizedKey);
      return uploaded ? null : "We couldn't upload this file. Please try again.";
    } catch (err) {
      const text = err instanceof Error ? err.message : "Upload failed";
      console.error("SKEAP upload failed", { requirement, error: text, rawError: err });
      if (id) {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error", error: text } : f)));
      }
      return text;
    }
  }

  async function uploadPendingFile(id: string, file?: File, requirement?: SkeapUploadKey): Promise<boolean> {
    const pendingFile = file ?? files.find((item) => item.id === id)?.file;
    if (!pendingFile) {
      const errorText = "Please choose this file again before uploading.";
      setFiles((prev) => prev.map((item) => item.id === id ? { ...item, status: "error", error: errorText } : item));
      console.error("SKEAP upload could not start because the selected local file is unavailable.", { id });
      return false;
    }

    setFiles((prev) => prev.map((item) => item.id === id
      ? { ...item, status: "uploading", error: undefined }
      : item));
    try {
      const result = await uploadWithProgress(pendingFile, (pct) => {
        setFiles((prev) => prev.map((item) => item.id === id ? { ...item, progress: pct } : item));
      });
      setFiles((prev) => prev.map((item) => item.id === id
        ? { ...item, status: "done", progress: 100, url: result.url, file: undefined }
        : item));

      if (requirement) markFieldValid(requirement);
      return true;
    } catch (error) {
      const errorText = error instanceof Error && error.message.trim()
        ? error.message
        : "An unexpected error occurred while uploading this file.";
      console.error("SKEAP document upload failed after validation.", {
        id,
        requirement,
        fileName: pendingFile.name,
        errorName: error instanceof Error ? error.name : typeof error,
        error: errorText,
      });
      setFiles((prev) => prev.map((item) => item.id === id
        ? { ...item, status: "error", error: errorText }
        : item));
      return false;
    }
  }

  async function submitApplication() {
    const validation = validateStep();
    if (validation.invalidFields.length > 0) {
      setInvalidFields(new Set(validation.invalidFields));
      setValidationErrors(validation.errors);
      setShowGlobalError(true);
      setMessage(null);
      focusFirstInvalidInStep(step);
      return;
    }

    setInvalidFields(new Set());
    setValidationErrors({});
    setShowGlobalError(false);
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
          signatureUrl,
          // Send the structured name fields so the API can require and format the full legal name.
          applicantName,
          lastName,
          firstName,
          middleName,
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

      <div className="scrollbar-hide mb-4 flex flex-row flex-nowrap gap-2 overflow-x-auto">
        {STEPS.map((label, idx) => (
          <div
            key={label}
            className={`shrink-0 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] ${
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

      {message && Object.keys(validationErrors).length === 0 ? (
        <p className="text-sm font-medium text-red-600" role="alert">{message}</p>
      ) : null}

      {step === 0 ? (
        <div className="flex flex-col gap-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h4 className="mb-1 text-sm font-semibold">Personal Information</h4>
            {showGlobalError && Object.keys(validationErrors).length > 0 ? (
              <p className="text-sm font-medium text-red-500 mt-1 mb-5 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1" role="alert">
                <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
                </svg>
                <span>Please complete the highlighted required fields below to proceed.</span>
              </p>
            ) : null}
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
              <EditableField
                label="Last Name"
                value={lastName}
                onChange={(value) => { setLastName(value); markFieldValid("lastName"); }}
                placeholder="Enter last name"
                dataRequired="profile"
                required
                readOnly={!allowManualProfileDetails}
                invalid={invalidFields.has("lastName")}
              />
              <EditableField
                label="First Name"
                value={firstName}
                onChange={(value) => { setFirstName(value); markFieldValid("firstName"); }}
                placeholder="Enter first name"
                dataRequired="profile"
                required
                readOnly={!allowManualProfileDetails}
                invalid={invalidFields.has("firstName")}
              />
              <EditableField
                label="Middle Name"
                value={middleName}
                onChange={(value) => { setMiddleName(value); markFieldValid("middleName"); }}
                placeholder="Enter middle name"
                dataRequired="profile"
                required
                invalid={invalidFields.has("middleName")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {allowManualProfileDetails ? (
              <EditableField label="Permanent Address" value={permanentAddress} onChange={(value) => { setPermanentAddress(value); markFieldValid("permanentAddress"); }} placeholder="Enter permanent address in Barangay Pico" dataRequired="profile" required invalid={invalidFields.has("permanentAddress")} />
            ) : (
            <label className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">Permanent Address <span className="text-black" aria-hidden="true">*</span></span>
              <input
                readOnly
                data-required="profile"
                required
                aria-required="true"
                value={permanentAddress}
                aria-invalid={invalidFields.has("permanentAddress")}
                className={`mt-1 w-full min-w-0 cursor-not-allowed rounded-lg border px-3 py-2 focus:outline-none ${invalidFields.has("permanentAddress") ? "border-rose-300 bg-rose-50/30 text-slate-900 ring-2 ring-rose-100" : "border-slate-200 bg-slate-50 text-slate-500"}`}
              />
            </label>
            )}
            <label className="flex min-w-0 flex-col">
              <span className="text-sm font-semibold">School / Institution <span className="text-black" aria-hidden="true">*</span></span>
              <select
                data-required="profile"
                required
                aria-required="true"
                aria-invalid={invalidFields.has("schoolName")}
                value={schoolName}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setSchoolName(value);
                  if (value.trim()) markFieldValid("schoolName");
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 shadow-sm transition-colors focus:ring-2 ${invalidFields.has("schoolName") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100"}`}
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
              <span className="text-sm font-semibold">Date of Birth <span className="text-black" aria-hidden="true">*</span></span>
              <input
                data-required="profile"
                required
                aria-required="true"
                type="date"
                min="1995-01-01"
                max={`${new Date().getFullYear() - 1}-12-31`}
                value={dateOfBirth}
                readOnly={!allowManualProfileDetails}
                aria-invalid={invalidFields.has("dateOfBirth")}
                onChange={(event) => {
                  setDateOfBirth(event.target.value);
                  const computedAge = computeAgeFromDateValue(event.target.value);
                  if (computedAge !== undefined) setAge(String(computedAge));
                  markFieldValid("dateOfBirth");
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 focus:outline-none ${invalidFields.has("dateOfBirth") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : allowManualProfileDetails ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"}`}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Place of Birth <span className="text-black" aria-hidden="true">*</span></span>
              <input
                data-required="profile"
                required
                aria-required="true"
                value={placeOfBirth}
                aria-invalid={invalidFields.has("placeOfBirth")}
                onChange={(e) => {
                  setPlaceOfBirth(e.target.value);
                  markFieldValid("placeOfBirth");
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 shadow-sm transition-colors focus:ring-2 ${invalidFields.has("placeOfBirth") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100"}`}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Age <span className="text-black" aria-hidden="true">*</span></span>
              <input
                data-required="profile"
                type="number"
                min="1"
                required
                aria-required="true"
                value={age}
                readOnly={!allowManualProfileDetails}
                aria-invalid={invalidFields.has("age")}
                onChange={(event) => {
                  setAge(event.target.value);
                  markFieldValid("age");
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 focus:outline-none ${invalidFields.has("age") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : allowManualProfileDetails ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"}`}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Civil Status <span className="text-black" aria-hidden="true">*</span></span>
              <select
                disabled={!allowManualProfileDetails}
                data-required="profile"
                required
                aria-required="true"
                value={civilStatus}
                aria-invalid={invalidFields.has("civilStatus")}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setCivilStatus(value);
                  if (value.trim()) markFieldValid("civilStatus");
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 ${invalidFields.has("civilStatus") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : allowManualProfileDetails ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"}`}
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
              <span className="text-sm font-semibold">Gender <span className="text-black" aria-hidden="true">*</span></span>
              <select
                disabled={!allowManualProfileDetails}
                data-required="profile"
                required
                aria-required="true"
                value={gender}
                aria-invalid={invalidFields.has("gender")}
                onChange={(event) => {
                  const selectedGender = event.currentTarget.value;
                  setGender(selectedGender);
                  if (selectedGender.trim()) markFieldValid("gender");
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 ${invalidFields.has("gender") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : allowManualProfileDetails ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"}`}
              >
                <option value="">Select gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Contact Number <span className="text-black" aria-hidden="true">*</span></span>
              <input
                data-required="profile"
                required
                aria-required="true"
                value={contactNumber}
                onChange={(e) => {
                  setContactNumber(e.target.value);
                  markFieldValid("contactNumber");
                }}
                aria-invalid={invalidFields.has("contactNumber")}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 shadow-sm transition-colors focus:ring-2 ${invalidFields.has("contactNumber") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100"}`}
              />
            </label>
            <label className="flex flex-col md:col-span-2">
              <span className="text-sm font-semibold">Email Address <span className="text-black" aria-hidden="true">*</span></span>
              <input
                readOnly
                data-required="profile"
                required
                aria-required="true"
                value={emailAddress}
                aria-invalid={invalidFields.has("emailAddress")}
                className={`mt-1 w-full cursor-not-allowed rounded-lg border px-3 py-2 focus:outline-none ${invalidFields.has("emailAddress") ? "border-rose-300 bg-rose-50/30 text-slate-900 ring-2 ring-rose-100" : "border-slate-200 bg-slate-50 text-slate-500"}`}
              />
            </label>
            <div className="mt-2 md:col-span-2">
              <p className="mb-2 block text-sm font-semibold text-slate-900">2x2 Photo (ID) <span className="text-black" aria-hidden="true">*</span></p>
              <p className="mb-4 text-sm text-slate-500">Upload a clear portrait photo. We will crop it to 2x2 for you.</p>
              <SmartPortraitDropzone
                invalid={invalidFields.has("photoFile")}
                uploadedUrl={photoFileUrl}
                uploadedName={photoFileRecord?.name}
                onFileSelected={async (file) => {
                  markFieldValid("photoFile");
                  const uploadError = await onChooseFiles([file], "2x2 Photo");
                  if (uploadError) throw new Error(uploadError);
                }}
                onPreview={(previewUrl) => setPreviewPhotoUrl(previewUrl)}
              />
            </div>
            <fieldset className="mt-2 flex flex-col gap-2 md:col-span-2">
              <legend className="text-sm font-semibold text-slate-900">Registered Voter <span className="text-black" aria-hidden="true">*</span></legend>
              <div className="flex items-center gap-4">
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={registeredVoter === true}
                    aria-invalid={invalidFields.has("registeredVoter")}
                    onChange={() => {
                      setRegisteredVoter(true);
                      markFieldValid("registeredVoter");
                    }}
                    className={`h-4 w-4 ${invalidFields.has("registeredVoter") ? "outline outline-1 outline-rose-600" : ""}`}
                  />
                  <span className="text-sm">Yes</span>
                </label>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={registeredVoter === false}
                    aria-invalid={invalidFields.has("registeredVoter")}
                    onChange={() => {
                      setRegisteredVoter(false);
                      markFieldValid("registeredVoter");
                    }}
                    className={`h-4 w-4 ${invalidFields.has("registeredVoter") ? "outline outline-1 outline-rose-600" : ""}`}
                  />
                  <span className="text-sm">No</span>
                </label>
              </div>
              <p className="text-xs text-slate-500">*(If yes, please present voter’s certificate and attach a photocopy of voter’s certificate for 18 years old and above only)</p>
              {registeredVoter === true && Number(age) >= 18 ? (
                (() => {
                  const voterFile = files.find((file) => file.requirement === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE);
                  const inputId = "voter-certificate-upload";
                  const voterFileUrl = voterFile?.status === "done" ? voterFile.url : undefined;
                  const statusLabel = voterFile?.verification === "scanning"
                    ? "Checking..."
                    : voterFile?.status === "uploading"
                    ? "Uploading..."
                    : voterFile?.verification === "review"
                    ? "Needs review"
                    : voterFile?.verification === "verified"
                    ? "Verified"
                    : voterFile?.verification === "overridden"
                    ? "For manual review"
                    : voterFile?.status === "error"
                    ? "Upload failed"
                    : voterFile?.status === "done"
                    ? "Ready"
                    : "Required";
                  const statusClass = voterFile?.verification === "scanning" || voterFile?.status === "uploading"
                    ? "border-sky-200 bg-sky-50 text-sky-700"
                    : voterFile?.verification === "verified" || (voterFile?.status === "done" && voterFile.verification !== "overridden")
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : voterFile?.verification === "review" || voterFile?.verification === "overridden" || voterFile?.status === "error"
                    ? "border-amber-200 bg-amber-50 text-amber-800"
                    : "border-slate-200 bg-slate-100 text-slate-600";

                  return (
                    <div
                      className="mt-2 space-y-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        void onChooseFiles(event.dataTransfer.files, SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE);
                      }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <label htmlFor={inputId} className="text-sm font-semibold text-slate-900">
                            Voter&apos;s certificate (photocopy) <span className="text-red-500" aria-hidden="true">*</span>
                          </label>
                          <p className="mt-0.5 text-xs text-slate-500">Supports PDF, DOC, DOCX, and images (Max 15MB).</p>
                        </div>
                        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${statusClass}`}>
                          {statusLabel}
                        </span>
                      </div>
                      <input
                        id={inputId}
                        data-required="profile"
                        data-requirement={SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE}
                        type="file"
                        accept={ACCEPTED_DOCUMENT_TYPES}
                        onChange={(event) => {
                          void onChooseFiles(event.currentTarget.files, SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE);
                          event.currentTarget.value = "";
                        }}
                        className="sr-only"
                        aria-label="Upload or replace voter's certificate"
                      />
                      {voterFile?.verification === "scanning" || voterFile?.status === "uploading" ? (
                        <div className="flex h-[68px] animate-pulse items-center justify-between rounded-xl border border-blue-100 bg-blue-50/40 px-4" role="status">
                          <div className="flex items-center gap-3">
                            <LoaderCircle className="h-5 w-5 shrink-0 animate-spin text-blue-600" aria-hidden="true" />
                            <span className="text-xs font-medium text-blue-900">
                              {voterFile.verification === "scanning" ? "Checking your document..." : "Uploading your document..."}
                            </span>
                          </div>
                          <span className="text-[11px] font-medium text-blue-600">Please wait</span>
                        </div>
                      ) : voterFile ? (
                        <div className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <div className="flex min-w-0 items-center gap-3">
                            {isPreviewableImage(voterFile) && voterFile.previewUrl ? (
                              <img src={voterFile.previewUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover" />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-500">
                                {isPdfFile(voterFile) ? "PDF" : <FileText className="h-5 w-5" aria-hidden="true" />}
                              </div>
                            )}
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900" title={voterFile.name}>{voterFile.name}</p>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-slate-500">{(voterFile.size / (1024 * 1024)).toFixed(2)} MB</span>
                                {getFileBadge(voterFile)}
                                {canPreviewInline(voterFile) && voterFile.previewUrl ? (
                                  <button
                                    type="button"
                                    onClick={() => setPreviewFileId(voterFile.id)}
                                    className="cursor-pointer text-xs font-medium text-blue-600 hover:underline"
                                  >
                                    View file
                                  </button>
                                ) : voterFileUrl ? (
                                  <a
                                    href={voterFileUrl}
                                    target={isViewableInBrowser(voterFile) ? "_blank" : "_self"}
                                    rel={isViewableInBrowser(voterFile) ? "noopener noreferrer" : undefined}
                                    download={!isViewableInBrowser(voterFile) ? voterFile.name : undefined}
                                    className="cursor-pointer text-xs font-medium text-blue-600 hover:underline"
                                    aria-label={`${isViewableInBrowser(voterFile) ? "View" : "Download"} ${voterFile.name}${isViewableInBrowser(voterFile) ? " in a new tab" : ""}`}
                                  >
                                    View file
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </div>
                          <label htmlFor={inputId} className="shrink-0 cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                            Change
                          </label>
                        </div>
                      ) : (
                        <label htmlFor={inputId} className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed p-4 transition-colors hover:border-slate-300 hover:bg-slate-100 ${invalidFields.has(SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE) ? "border-rose-300 bg-rose-50/30" : "border-slate-200 bg-slate-50/50"}`}>
                          <span className="flex items-center gap-3">
                            <UploadCloud className="h-5 w-5 text-slate-400" aria-hidden="true" />
                            <span className="text-sm text-slate-600">Click or drop to upload document</span>
                          </span>
                          <span className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 shadow-sm">Browse</span>
                        </label>
                      )}
                      {voterFile?.verification === "review" ? (
                        <div className="flex flex-col items-start justify-between gap-4 rounded-xl border border-amber-200/90 bg-amber-50/80 p-4 shadow-sm transition-all sm:flex-row sm:items-center">
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                            </div>
                            <div>
                              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Manual Verification Recommended</h4>
                              <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                                {MANUAL_REVIEW_MESSAGE}
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFiles((prev) => prev.map((file) => file.id === voterFile.id
                                ? { ...file, verification: "overridden" }
                                : file));
                              if (voterFile.status !== "done" || !voterFile.url) {
                                void uploadPendingFile(voterFile.id, voterFile.file, SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE);
                              }
                            }}
                            disabled={voterFile.status === "uploading"}
                            className="w-full shrink-0 cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                          >
                            Proceed Anyway
                          </button>
                        </div>
                      ) : null}
                      {voterFile?.error ? <p className="text-xs text-rose-700" role="alert">{voterFile.error}</p> : null}
                    </div>
                  );
                })()
              ) : null}
            </fieldset>
          </div>

        </div>
      ) : null}

      {step === 1 ? (
        <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6">
          {showGlobalError && Object.keys(validationErrors).length > 0 ? (
            <ValidationHint show />
          ) : null}
          <div>
            <h4 className="text-sm font-semibold">SCHOOL INFORMATION</h4>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <EditableField
              label="Current / Intended Course"
              value={course}
              onChange={(value) => { setCourse(value); markFieldValid("course"); }}
              placeholder="e.g., BS Information Technology"
              dataRequired="scholarship"
              required
              invalid={invalidFields.has("course")}
            />
            <label className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Year level <span className="text-black" aria-hidden="true">*</span></span>
              <select
                data-required="scholarship"
                required
                aria-required="true"
                value={yearLevel}
                onChange={(event) => {
                  const value = event.currentTarget.value;
                  setYearLevel(value);
                  if (value.trim()) markFieldValid("yearLevel");
                }}
                aria-invalid={invalidFields.has("yearLevel")}
                className={`mt-1 rounded-xl border px-3 py-2 text-sm text-slate-900 ${invalidFields.has("yearLevel") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
              >
                <option value="">Select year level</option>
                {YEAR_LEVELS.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            <div>
              <h4 className="text-sm font-semibold">FAMILY BACKGROUND</h4>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Father's Name <span className="text-black" aria-hidden="true">*</span></span>
                <input
                  data-required="scholarship"
                  required
                  value={fathersName}
                  onChange={(e) => {
                    setFathersName(e.target.value);
                    markFieldValid("fathersName");
                  }}
                  aria-invalid={invalidFields.has("fathersName")}
                  className={`mt-1 rounded-xl border px-3 py-2 text-slate-900 ${invalidFields.has("fathersName") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Father's occupation <span className="text-black" aria-hidden="true">*</span></span>
                <input
                  data-required="scholarship"
                  required
                  value={fathersOccupation}
                  onChange={(e) => {
                    setFathersOccupation(e.target.value);
                    markFieldValid("fathersOccupation");
                  }}
                  aria-invalid={invalidFields.has("fathersOccupation")}
                  className={`mt-1 rounded-xl border px-3 py-2 text-slate-900 ${invalidFields.has("fathersOccupation") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                />
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Father's contact <span className="text-black" aria-hidden="true">*</span></span>
                <input
                  data-required="scholarship"
                  required
                  value={fathersContact}
                  disabled={fathersContact === "N/A"}
                  onChange={(e) => {
                    setFathersContact(e.target.value);
                    markFieldValid("fathersContact");
                  }}
                  aria-invalid={invalidFields.has("fathersContact")}
                  className={`mt-1 rounded-xl border px-3 py-2 text-slate-900 ${invalidFields.has("fathersContact") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={fathersContact === "N/A"}
                    onChange={(e) => {
                      setFathersContact(e.target.checked ? "N/A" : "");
                      markFieldValid("fathersContact");
                    }}
                    className="rounded border-slate-300"
                  />
                  Not applicable (single-parent household)
                </label>
              </label>
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mother's maiden name <span className="text-black" aria-hidden="true">*</span></span>
                <input
                  data-required="scholarship"
                  required
                  value={mothersMaidenName}
                  onChange={(e) => {
                    setMothersMaidenName(e.target.value);
                    markFieldValid("mothersMaidenName");
                  }}
                  aria-invalid={invalidFields.has("mothersMaidenName")}
                  className={`mt-1 rounded-xl border px-3 py-2 text-slate-900 ${invalidFields.has("mothersMaidenName") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                />
              </label>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mother's occupation <span className="text-black" aria-hidden="true">*</span></span>
                <input
                  data-required="scholarship"
                  required
                  value={mothersOccupation}
                  onChange={(e) => {
                    setMothersOccupation(e.target.value);
                    markFieldValid("mothersOccupation");
                  }}
                  aria-invalid={invalidFields.has("mothersOccupation")}
                  className={`mt-1 rounded-xl border px-3 py-2 text-slate-900 ${invalidFields.has("mothersOccupation") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                />
              </label>
              <label className="flex flex-col">
                <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mother's contact <span className="text-black" aria-hidden="true">*</span></span>
                <input
                  data-required="scholarship"
                  required
                  value={mothersContact}
                  disabled={mothersContact === "N/A"}
                  onChange={(e) => {
                    setMothersContact(e.target.value);
                    markFieldValid("mothersContact");
                  }}
                  aria-invalid={invalidFields.has("mothersContact")}
                  className={`mt-1 rounded-xl border px-3 py-2 text-slate-900 ${invalidFields.has("mothersContact") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                  <input
                    type="checkbox"
                    checked={mothersContact === "N/A"}
                    onChange={(e) => {
                      setMothersContact(e.target.checked ? "N/A" : "");
                      markFieldValid("mothersContact");
                    }}
                    className="rounded border-slate-300"
                  />
                  Not applicable (single-parent household)
                </label>
              </label>
            </div>
            <div className="mt-3">
              <label className="flex flex-col">
                <span className="text-sm font-semibold">Total Family Monthly Income <span className="text-black" aria-hidden="true">*</span></span>
                <input
                  data-required="scholarship"
                  required
                  value={totalFamilyMonthlyIncome}
                  onChange={(e) => {
                    setTotalFamilyMonthlyIncome(e.target.value);
                    markFieldValid("totalFamilyMonthlyIncome");
                  }}
                  aria-invalid={invalidFields.has("totalFamilyMonthlyIncome")}
                  className={`mt-1 rounded-xl border px-3 py-2 text-slate-900 ${invalidFields.has("totalFamilyMonthlyIncome") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                />
              </label>
            </div>
          </div>
        </div>
      ) : null}

        {step === 2 ? (
          <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6">
            <div>
              <h4 className="text-sm font-semibold">EDUCATIONAL BACKGROUND</h4>
              <p className="mt-1 text-xs text-slate-500">Leave blank if not applicable.</p>
            </div>
            <div className="grid gap-3">
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Elementary</span>
                  <input
                    value={elementarySchool}
                    onChange={(e) => { setElementarySchool(e.target.value); markFieldValid("elementarySchool"); }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Year Graduated</span>
                  <input
                    value={elementaryYearGraduated}
                    onChange={(e) => { setElementaryYearGraduated(e.target.value); markFieldValid("elementaryYearGraduated"); }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">High School</span>
                  <input
                    value={highSchool}
                    onChange={(e) => { setHighSchool(e.target.value); markFieldValid("highSchool"); }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Year Graduated</span>
                  <input
                    value={highSchoolYearGraduated}
                    onChange={(e) => { setHighSchoolYearGraduated(e.target.value); markFieldValid("highSchoolYearGraduated"); }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">College</span>
                  <input
                    value={college}
                    onChange={(e) => { setCollege(e.target.value); markFieldValid("college"); }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Year Graduated</span>
                  <input
                    value={collegeYearGraduated}
                    onChange={(e) => { setCollegeYearGraduated(e.target.value); markFieldValid("collegeYearGraduated"); }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Vocational</span>
                  <input
                    value={vocational}
                    onChange={(e) => { setVocational(e.target.value); markFieldValid("vocational"); }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="flex flex-col">
                  <span className="text-sm font-semibold">Year Graduated</span>
                  <input
                    value={vocationalYearGraduated}
                    onChange={(e) => { setVocationalYearGraduated(e.target.value); markFieldValid("vocationalYearGraduated"); }}
                    className="mt-1 rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
        <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6">
          <p className="text-sm font-semibold text-slate-900">Upload your required application documents</p>

          <div className="grid gap-3">
            {getRequiredUploadKeys(requirements).map((key) => {
              const label = getUploadLabel(key);
              const inputId = `file-input-${key}`;
              const matchingFile = findUploadFileForKey(files, key);
              const isReady = matchingFile?.status === "done" && Boolean(matchingFile.url);
              const matchingFileUrl = matchingFile?.status === "done" ? matchingFile.url : undefined;
              const statusLabel = matchingFile?.status === "error"
                ? "Try again"
                : matchingFile?.status === "uploading"
                ? "Uploading"
                : matchingFile?.verification === "scanning"
                ? "Checking"
                : matchingFile?.verification === "review"
                ? "Needs review"
                : matchingFile?.status === "done"
                ? matchingFile.verification === "verified"
                  ? "Verified"
                  : matchingFile.verification === "overridden"
                  ? "For manual review"
                  : "Ready"
                : matchingFile?.status === "queued"
                ? "Queued"
                : "Pending";
              const statusBadgeClass = matchingFile?.status === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : matchingFile?.status === "uploading" || matchingFile?.verification === "scanning"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : matchingFile?.verification === "verified"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : matchingFile?.verification === "review" || matchingFile?.verification === "overridden"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : matchingFile?.status === "done"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-slate-200 bg-slate-100 text-slate-500";
              return (
                <div
                  key={key}
                  id={`upload-${key}`}
                  tabIndex={-1}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    void onChooseFiles(event.dataTransfer.files, key);
                  }}
                  className={`flex flex-col rounded-2xl border p-5 ${invalidFields.has(key) ? "border-rose-300 bg-rose-50/30 text-slate-900" : "border-slate-200 bg-white"}`}
                >
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="min-w-0 truncate text-sm font-semibold text-slate-800">{label}</p>
                      <p className="mt-0.5 text-xs text-slate-500">Supports PDF, DOC, DOCX, and images (Max 15MB).</p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${statusBadgeClass}`}>
                      {statusLabel}
                    </span>
                  </div>

                  <input
                    id={inputId}
                    name={key}
                    type="file"
                    accept={ACCEPTED_DOCUMENT_TYPES}
                    data-requirement={key}
                    onChange={(e) => {
                      void onChooseFiles(e.target.files, key);
                      e.currentTarget.value = "";
                    }}
                    className="sr-only"
                    aria-label={`${isReady ? "Replace" : "Upload"} ${label}`}
                  />

                  {matchingFile ? (
                    <div className="mt-3 flex min-w-0 items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3 pl-4">
                      <div className="flex min-w-0 items-center gap-3">
                        {isPreviewableImage(matchingFile) && matchingFile.previewUrl ? (
                          <img
                            src={matchingFile.previewUrl}
                            alt=""
                            className="h-10 w-10 shrink-0 rounded-lg border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-[10px] font-bold text-slate-500">
                            {isPdfFile(matchingFile) ? "PDF" : <FileText className="h-5 w-5" aria-hidden="true" />}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900" title={matchingFile.name}>{matchingFile.name}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-slate-500">
                              {(matchingFile.size / (1024 * 1024)).toFixed(2)} MB
                              {matchingFile.status === "done" ? " · Ready" : null}
                            </span>
                            {getFileBadge(matchingFile)}
                            {canPreviewInline(matchingFile) && matchingFile.previewUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewFileId(matchingFile.id)}
                                className="text-xs font-medium text-cyan-700 hover:underline"
                              >
                                View file
                              </button>
                            ) : matchingFileUrl ? (
                              <a
                                href={matchingFileUrl}
                                target={isViewableInBrowser(matchingFile) ? "_blank" : "_self"}
                                rel={isViewableInBrowser(matchingFile) ? "noopener noreferrer" : undefined}
                                download={!isViewableInBrowser(matchingFile) ? matchingFile.name : undefined}
                                className="text-xs font-medium text-cyan-700 hover:underline"
                                aria-label={`${isViewableInBrowser(matchingFile) ? "View" : "Download"} ${matchingFile.name}${isViewableInBrowser(matchingFile) ? " in a new tab" : ""}`}
                              >
                                View file
                              </a>
                            ) : null}
                          </div>
                        </div>
                      </div>
                      <div className="ml-4 flex shrink-0 items-center gap-2">
                        <label
                          htmlFor={inputId}
                          className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900"
                        >
                          Change
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
                        <span className="text-sm font-medium text-slate-600">Click or drop to upload document</span>
                      </span>
                      <span className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold shadow-sm hover:bg-slate-50">
                        Browse
                      </span>
                    </label>
                  )}
                  {matchingFile?.verification === "scanning" || matchingFile?.status === "uploading" ? (
                    <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-sky-700" role="status">
                      <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                      <span className="shrink-0">
                        {matchingFile.verification === "scanning"
                          ? "Checking document..."
                          : matchingFile.progress >= 100
                            ? "Finishing upload..."
                            : "Uploading your file..."}
                      </span>
                      {matchingFile.status === "uploading" ? (
                        <>
                          <div
                            className="h-1.5 min-w-10 max-w-36 flex-1 overflow-hidden rounded-full bg-sky-100"
                            role="progressbar"
                            aria-label={`Uploading ${label}`}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-valuenow={matchingFile.progress}
                          >
                            <div
                              className="h-full rounded-full bg-sky-600 transition-[width] duration-200"
                              style={{ width: `${matchingFile.progress}%` }}
                            />
                          </div>
                          <span className="shrink-0 font-medium">{matchingFile.progress}%</span>
                        </>
                      ) : null}
                    </div>
                  ) : null}
                  {matchingFile?.error ? <p className="mt-2 text-xs text-rose-700" role="alert">{matchingFile.error}</p> : null}
                  {matchingFile?.verification === "verified" && isReady ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      This file looks clear and matches the selected document type.
                    </p>
                  ) : null}
                  {matchingFile?.verification === "review" ? (
                    <div className="mt-3 flex flex-col items-start justify-between gap-4 rounded-xl border border-amber-200/90 bg-amber-50/80 p-4 shadow-sm transition-all sm:flex-row sm:items-center">
                      <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                        </div>
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900">Manual Verification Recommended</h4>
                          <p className="mt-0.5 text-xs leading-relaxed text-amber-800">
                            {MANUAL_REVIEW_MESSAGE}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFiles((prev) => prev.map((file) => file.id === matchingFile.id
                            ? { ...file, verification: "overridden" }
                            : file));
                          if (matchingFile.status !== "done" || !matchingFile.url) {
                            void uploadPendingFile(matchingFile.id, matchingFile.file, key);
                          }
                        }}
                        disabled={matchingFile.status === "uploading"}
                        className="w-full shrink-0 cursor-pointer rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-amber-700 disabled:cursor-wait disabled:opacity-60 sm:w-auto"
                      >
                        Proceed Anyway
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>

          <div className="space-y-2">
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
                      ? "Try again"
                      : "Queued"}
                  </span>
                </div>
              ))}
          </div>
        </div>
      ) : null}

      {step === 4 ? (
        <div className="grid gap-6 rounded-2xl border border-slate-200 bg-white p-6">
          <div>
            <h4 className="text-sm font-semibold text-slate-900">Applicant E-Signature</h4>
            <p className="mt-1 text-sm text-slate-600">
              Sign below using your finger, stylus, or mouse. Your signature will appear on the application form.
            </p>
          </div>
          <SignaturePad
            value={signatureUrl}
            onChange={(signature) => {
              setSignatureUrl(signature);
              if (signature) markFieldValid("applicantSignature");
            }}
            invalid={invalidFields.has("applicantSignature")}
          />
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

      {previewFile ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setPreviewFileId(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="document-preview-title"
            className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            <header className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
              <h2 id="document-preview-title" className="min-w-0 truncate text-sm font-semibold text-slate-900">
                {previewFile.name}
              </h2>
              <button
                type="button"
                onClick={() => setPreviewFileId(null)}
                className="shrink-0 rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
                aria-label="Close file preview"
              >
                ×
              </button>
            </header>
            <div className="flex min-h-[240px] flex-1 items-center justify-center overflow-auto bg-slate-100 p-3">
              {previewFile.previewUrl && isPreviewableImage(previewFile) ? (
                <img
                  src={previewFile.previewUrl}
                  alt={`Preview of ${previewFile.name}`}
                  className="max-h-[75vh] max-w-full rounded-lg object-contain"
                />
              ) : previewFile.previewUrl && isPdfFile(previewFile) ? (
                <iframe
                  src={previewFile.previewUrl}
                  title={`Preview of ${previewFile.name}`}
                  className="h-[75vh] w-full rounded-lg bg-white"
                />
              ) : (
                <p className="text-sm text-slate-500">A preview is not available for this file.</p>
              )}
            </div>
          </section>
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

function ValidationHint({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <p className="text-sm font-medium text-red-500 mt-1 mb-4 flex items-center gap-1.5 animate-in fade-in slide-in-from-top-1" role="alert">
      <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
      </svg>
      <span>Please complete the highlighted required fields below to proceed.</span>
    </p>
  );
}

function SignaturePad({
  value,
  onChange,
  invalid,
}: {
  value: string | null;
  onChange: (signature: string | null) => void;
  invalid: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasInkRef = useRef(false);

  function getPoint(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const point = getPoint(event);
    if (!canvas || !point) return;
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext("2d");
    if (!context) return;
    drawingRef.current = true;
    hasInkRef.current = true;
    context.beginPath();
    context.moveTo(point.x, point.y);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = 5;
    context.strokeStyle = "#0f172a";
    context.lineTo(point.x + 0.1, point.y + 0.1);
    context.stroke();
  }

  function continueDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const point = getPoint(event);
    const context = canvasRef.current?.getContext("2d");
    if (!point || !context) return;
    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function finishDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (canvasRef.current?.hasPointerCapture(event.pointerId)) {
      canvasRef.current.releasePointerCapture(event.pointerId);
    }
    const canvas = canvasRef.current;
    if (canvas && hasInkRef.current) onChange(canvas.toDataURL("image/png"));
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (canvas && context) context.clearRect(0, 0, canvas.width, canvas.height);
    drawingRef.current = false;
    hasInkRef.current = false;
    onChange(null);
  }

  return (
    <div id="applicant-signature" className="grid gap-2">
      <canvas
        ref={canvasRef}
        width={1200}
        height={320}
        tabIndex={0}
        aria-label="Draw your applicant signature"
        aria-invalid={invalid}
        className={`aspect-[15/4] w-full touch-none rounded-xl border ${invalid ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white"}`}
        onPointerDown={startDrawing}
        onPointerMove={continueDrawing}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-slate-500" aria-live="polite">
          {value ? "Signature captured." : "Signature is required to submit."}
        </p>
        <button
          type="button"
          onClick={clearSignature}
          disabled={!value}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear Signature
        </button>
      </div>
    </div>
  );
}

function EditableField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  dataRequired,
  readOnly = false,
  required = false,
  invalid = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  type?: string;
  dataRequired?: string;
  readOnly?: boolean;
  required?: boolean;
  invalid?: boolean;
}) {
  return (
    <label className="flex flex-col">
      <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}{required ? <span className="ml-1 text-black" aria-hidden="true">*</span> : null}
      </span>
      <input
        type={type}
        data-required={dataRequired}
        readOnly={readOnly}
        required={required}
        aria-required={required}
        aria-invalid={invalid}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`mt-1 min-w-0 rounded-xl border px-3 py-2 text-sm ${invalid ? "border-rose-300 bg-rose-50/30 text-slate-900 ring-2 ring-rose-100" : `border-slate-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${readOnly ? "cursor-not-allowed bg-slate-50 text-slate-500" : "bg-white text-slate-800"}`}`}
      />
    </label>
  );
}

async function uploadWithProgress(file: File, onProgress: (pct: number) => void): Promise<{ url: string }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const fd = new FormData();
    fd.append("file", file);

    xhr.open("POST", "/api/skeap/applications/upload");

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable) {
        const pct = Math.round((ev.loaded / ev.total) * 100);
        onProgress(pct);
      }
    };

    xhr.onload = () => {
      const responseText = xhr.responseText.trim();
      let body: { url?: unknown; error?: unknown } | null = null;
      if (responseText) {
        try {
          body = JSON.parse(responseText) as { url?: unknown; error?: unknown };
        } catch {
          if (xhr.status >= 200 && xhr.status < 300) {
            reject(new Error("Upload response was not valid JSON."));
            return;
          }
        }
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        if (typeof body?.url !== "string" || !body.url.trim()) {
          reject(new Error("Upload completed, but the server did not return a file URL."));
          return;
        }
        resolve({ url: body.url });
      } else {
        const serverError = typeof body?.error === "string" ? body.error.trim() : "";
        const details = serverError || responseText || xhr.statusText || "No error details were returned.";
        reject(new Error(`Upload failed (${xhr.status}): ${details}`));
      }
    };

    xhr.onerror = () => reject(new Error("Network error during upload. Check your connection and try again."));
    xhr.onabort = () => reject(new Error("Upload was cancelled before it finished."));
    xhr.ontimeout = () => reject(new Error("Upload timed out before the server responded."));
    xhr.timeout = 120_000;

    xhr.send(fd);
  });
}
