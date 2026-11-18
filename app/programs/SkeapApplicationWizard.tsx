"use client";

import { createPortal } from "react-dom";
import { useEffect, useId, useMemo, useRef, useState, type RefObject } from "react";
import { CheckCircle2, ChevronDown, ChevronsUpDown, Eye, FileText, Info, LoaderCircle, TriangleAlert, UploadCloud, X } from "lucide-react";
import {
  SKEAP_UPLOAD_KEY,
  SKEAP_TERM_UPLOAD_KEYS,
  SKEAP_UPLOAD_LABELS,
  SKEAP_UPLOAD_TOO_LARGE_MESSAGE,
  type SkeapRequiredDocument,
  getSupportedSkeapDocumentType,
  normalizeUploadRequirement,
  type SkeapOcrNameStatus,
  type SkeapVerificationStatus,
  type SkeapUploadKey,
} from "@/lib/skeap-upload";
import {
  ensureSkeapUploadWithinLimit,
  getSkeapUploadErrorMessage,
  isSkeapRasterImage,
} from "@/lib/skeap-upload-client";
import { compressImageForUpload } from "@/lib/image-compression";
import type { KKProfile } from "@/lib/kk-profile-client";
import { validateDocumentOCR, verifyOcrDocumentName } from "@/lib/skeap-document-ocr";
import { formatSkeapPermanentAddress } from "@/lib/grantee-address";
import { placeOfBirthSchema } from "@/lib/place-of-birth-schema";
import FormFieldLabel from "@/app/components/FormFieldLabel";
import {
  DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS,
  getSkeapEducationLevelCode,
  isEligibleSkeapApplicantYearLevel,
  SKEAP_EDUCATION_LEVEL_OPTIONS,
  SKEAP_YEAR_LEVELS,
  type SkeapEducationLevel,
  type SkeapEducationLevelCode,
} from "@/lib/skeap-education";

type CoursePresetGroup = {
  label: string;
  options: readonly string[];
};

export const SKEAP_COURSE_PRESETS: Record<
  SkeapEducationLevelCode,
  readonly CoursePresetGroup[]
> = {
  COLLEGE: [
    {
      label: "Computing & Information Technology",
      options: [
        "BS Information Technology",
        "BS Computer Science",
        "BS Information Systems",
        "BS Data Science",
      ],
    },
    {
      label: "Teacher Education",
      options: [
        "Bachelor of Elementary Education (BEEd)",
        "Bachelor of Secondary Education (BSEd)",
        "Bachelor of Physical Education (BPEd)",
        "Bachelor of Early Childhood Education (BECEd)",
      ],
    },
    {
      label: "Business, Accountancy & Management",
      options: [
        "BS Accountancy",
        "BS Business Administration (BSBA)",
        "BS Management Accounting",
        "BS Entrepreneurship",
        "BS Office Administration",
      ],
    },
    {
      label: "Health & Allied Sciences",
      options: [
        "BS Nursing",
        "BS Medical Laboratory Science",
        "BS Pharmacy",
        "BS Physical Therapy",
        "BS Radiologic Technology",
        "BS Midwifery",
      ],
    },
    {
      label: "Engineering & Architecture",
      options: [
        "BS Civil Engineering",
        "BS Electrical Engineering",
        "BS Electronics Engineering",
        "BS Mechanical Engineering",
        "BS Industrial Engineering",
        "BS Mining Engineering",
        "BS Architecture",
      ],
    },
    {
      label: "Agriculture, Forestry & Sciences",
      options: [
        "BS Agriculture",
        "BS Forestry",
        "BS Agribusiness",
        "BS Environmental Science",
        "BS Development Communication",
        "BS Food Technology",
        "BS Nutrition and Dietetics",
      ],
    },
    {
      label: "Criminology & Public Safety",
      options: ["BS Criminology", "BS Forensic Science"],
    },
    {
      label: "Hospitality & Tourism",
      options: ["BS Hospitality Management (BSHM)", "BS Tourism Management (BSTM)"],
    },
    {
      label: "Arts, Humanities & Social Sciences",
      options: [
        "BS Psychology",
        "BA Psychology",
        "BA Political Science",
        "BA Communication",
        "BS Social Work",
        "BA English Language Studies",
      ],
    },
  ],
  SENIOR_HIGH: [
    {
      label: "Tracks",
      options: [
        "Academic Track – STEM",
        "Academic Track – ABM",
        "Academic Track – HUMSS",
        "Academic Track – GAS",
        "TVL Track – ICT",
        "TVL Track – Home Economics",
        "TVL Track – Industrial Arts",
        "TVL Track – Agri-Fishery Arts",
        "Arts and Design Track",
        "Sports Track",
      ],
    },
  ],
  TECH_VOC: [
    {
      label: "TESDA / TVET Programs",
      options: [
        "Cookery NC II",
        "Bread and Pastry Production NC II",
        "Computer Systems Servicing NC II",
        "Electrical Installation and Maintenance NC II",
        "Shielded Metal Arc Welding (SMAW) NC II",
        "Housekeeping NC II",
        "Automotive Servicing NC II",
        "Caregiving NC II",
      ],
    },
  ],
  JUNIOR_HIGH: [],
};

type UploadedFile = {
  id: string;
  name: string;
  type: string;
  size: number;
  progress: number;
  status: "validating" | "queued" | "uploading" | "done" | "error";
  url?: string;
  error?: string;
  manualReview?: boolean;
  manualReviewAvailable?: boolean;
  ocrNameMessage?: string;
  requirement?: string;
  previewUrl?: string;
  previewFailed?: boolean;
  verificationStatus?: SkeapVerificationStatus;
  ocrNameStatus?: SkeapOcrNameStatus;
  ocrText?: string;
  ocrConfidence?: number;
  file?: File;
};

type SkeapUploadValue = {
  name?: string;
  url: string;
  fileType?: string;
  manualReview?: boolean;
  verificationStatus?: SkeapVerificationStatus;
  ocrNameStatus?: SkeapOcrNameStatus;
  adminRemark?: string;
};

type KkIdentityDocuments = {
  photo: string;
  birthCertificate: string;
  validIdFront: string;
  validIdBack: string;
  residency: string;
};

function isKkIdentityDocuments(value: unknown): value is KkIdentityDocuments {
  if (!value || typeof value !== "object") return false;
  const documents = value as Record<string, unknown>;
  return [
    documents.photo,
    documents.birthCertificate,
    documents.validIdFront,
    documents.validIdBack,
    documents.residency,
  ].every((url) => typeof url === "string" && url.startsWith("/api/private-documents/"));
}

const ACCEPTED_DOCUMENT_TYPES = "image/jpeg,image/jfif,.jfif,image/png,image/webp,application/pdf";
const STRICT_OCR_UPLOAD_KEYS = new Set<SkeapUploadKey>([
  SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE,
  SKEAP_UPLOAD_KEY.FAMILY_INCOME,
  SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY,
  SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
  SKEAP_UPLOAD_KEY.GRADE_REPORT,
]);

function isPreviewableImage(file: Pick<UploadedFile, "name"> & { type?: string }) {
  return Boolean(file.type?.startsWith("image/")) || /\.(jpe?g|jfif|png|webp|gif|avif)$/i.test(file.name);
}

function isPdfFile(file: Pick<UploadedFile, "name">) {
  return /\.pdf$/i.test(file.name);
}

function getFileBadge(file: Pick<UploadedFile, "name">) {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const badge = extension === "pdf"
    ? { label: "PDF", className: "bg-red-50 text-red-700" }
    : extension === "webp"
      ? { label: "WEBP", className: "bg-emerald-50 text-emerald-700" }
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

  const todayParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(new Date());
  const today = Object.fromEntries(todayParts.map(({ type, value: partValue }) => [type, partValue]));
  const currentYear = Number(today.year);
  const currentMonth = Number(today.month) - 1;
  const currentDay = Number(today.day);

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

function findUploadFileForKey(files: UploadedFile[], key: SkeapUploadKey) {
  const exactMatch = [...files].reverse().find((file) => file.requirement === key);
  if (exactMatch) return exactMatch;

  return [...files].reverse().find((file) =>
    normalizeUploadRequirement(file.requirement || file.name || "") === key
  );
}

function formatPermanentAddress(parts: Array<string | undefined | null>) {
  const address = formatSkeapPermanentAddress({
    sitio: parts[0],
    barangay: parts[1],
    addressLine: parts[2],
  });
  return address === "Not specified" ? "" : address;
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

const STEPS = ["Profile", "School", "Educational Background", "Uploads"] as const;
type PresetOptionGroup = {
  label: string;
  options: readonly string[];
};

type SchoolPresetLevel = "ELEMENTARY" | "HIGH_SCHOOL" | "COLLEGE" | "VOCATIONAL";

export const SKEAP_SCHOOL_PRESETS: Record<SchoolPresetLevel, readonly PresetOptionGroup[]> = {
  ELEMENTARY: [
    {
      label: "La Trinidad, Benguet",
      options: [
        "Pico Elementary School",
        "La Trinidad Central School",
        "Benguet State University (BSU) Elementary Laboratory School",
        "Puguis Elementary School",
        "Buyagan Elementary School",
        "Balili Elementary School",
        "Wangal Elementary School",
        "King's College of the Philippines (KCP) Elementary",
        "Cordillera Career Development College (CCDC) Elementary",
      ],
    },
    {
      label: "Baguio City",
      options: [
        "Baguio Central School",
        "Saint Louis University (SLU) Laboratory Elementary School",
        "University of the Cordilleras (UC) Grade School",
        "University of Baguio (UB) Laboratory Elementary School",
        "Lucban Elementary School",
      ],
    },
  ],
  HIGH_SCHOOL: [
    {
      label: "La Trinidad, Benguet",
      options: [
        "Benguet National High School (BeNHS) – Main",
        "Benguet State University (BSU) Secondary Laboratory School",
        "La Trinidad National High School",
        "King's College of the Philippines (KCP) High School",
        "Cordillera Career Development College (CCDC) High School",
        "Star Colleges High School",
      ],
    },
    {
      label: "Baguio City",
      options: [
        "Baguio City National High School (BCNHS)",
        "Saint Louis University (SLU) Laboratory High School",
        "University of the Cordilleras (UC) Senior High School",
        "University of Baguio (UB) High School",
        "Pines City National High School",
        "University of the Philippines Baguio High School",
      ],
    },
  ],
  COLLEGE: [
    {
      label: "La Trinidad, Benguet",
      options: [
        "Benguet State University (BSU)",
        "King's College of the Philippines (KCP)",
        "Cordillera Career Development College (CCDC)",
        "Star Colleges",
      ],
    },
    {
      label: "Baguio City",
      options: [
        "Saint Louis University (SLU)",
        "University of the Cordilleras (UC)",
        "University of Baguio (UB)",
        "University of the Philippines Baguio (UPB)",
        "Baguio Central University (BCU)",
        "Pines City Colleges (PCC)",
      ],
    },
  ],
  VOCATIONAL: [
    {
      label: "La Trinidad, Benguet",
      options: [
        "TESDA Benguet Provincial Training Center (La Trinidad)",
        "King's College of the Philippines (KCP) – TVET",
        "Cordillera Career Development College (CCDC) – TVET",
      ],
    },
    {
      label: "Baguio City",
      options: [
        "TESDA Regional Training Center – CAR (Baguio)",
        "Baguio City School of Arts and Trades (BCSAT)",
        "Data Center College of the Philippines – Baguio",
      ],
    },
  ],
};

function getSchoolPresetGroups(educationLevel: SkeapEducationLevel | "") {
  if (educationLevel === "Junior High School" || educationLevel === "Senior High School") {
    return SKEAP_SCHOOL_PRESETS.HIGH_SCHOOL;
  }
  if (educationLevel === "College") return SKEAP_SCHOOL_PRESETS.COLLEGE;
  if (educationLevel === "Technical and Vocational (Tech-Voc)") {
    return SKEAP_SCHOOL_PRESETS.VOCATIONAL;
  }
  return ["La Trinidad, Benguet", "Baguio City"]
    .map((label) => ({
      label,
      options: Object.values(SKEAP_SCHOOL_PRESETS)
        .flatMap((groups) => groups)
        .filter((group) => group.label === label)
        .flatMap((group) => group.options),
    }))
    .filter((group) => group.options.length > 0);
}

export const LOCAL_OCCUPATION_GROUPS: readonly PresetOptionGroup[] = [
  {
    label: "Agriculture & Trade",
    options: ["Farmer", "Vendor", "Store Tender", "Packer / Porter"],
  },
  {
    label: "Transport & Delivery",
    options: ["Driver", "Delivery Rider", "Mechanic"],
  },
  {
    label: "Labor & Trades",
    options: [
      "Laborer",
      "Construction Worker",
      "Carpenter",
      "Mason",
      "Welder",
      "Painter",
      "Electrician",
      "Plumber",
    ],
  },
  {
    label: "Service, Retail & Care",
    options: [
      "Sales Clerk",
      "Cashier",
      "Security Guard",
      "Cook / Kitchen Helper",
      "Househelper",
      "Caregiver",
      "Laundry Worker",
      "Seamstress / Tailor",
      "Janitor / Utility Worker",
      "Barangay Worker",
    ],
  },
  {
    label: "Household / Status",
    options: ["Homemaker", "Self-Employed", "Unemployed", "Retired", "Deceased"],
  },
];

const FIELD_VALIDATION_MESSAGES: Record<string, readonly string[]> = {
  lastName: ["Last name and first name are required."],
  firstName: ["Last name and first name are required."],
  middleName: ["Middle name is required."],
  permanentAddress: ["Permanent address is required."],
  schoolName: ["School / Institution is required.", "Please enter or select your school."],
  educationLevel: ["Education level is required."],
  dateOfBirth: ["Date of birth is required."],
  placeOfBirth: [
    "Enter your full city/municipality (do not abbreviate)",
    "Do not use abbreviations (e.g., write 'La Trinidad, Benguet')",
  ],
  age: ["Age is required.", "Applicants must be between 15 and 30 years old."],
  civilStatus: ["Civil status is required."],
  gender: ["Gender is required."],
  contactNumber: ["Contact number is required."],
  emailAddress: ["Email address is required."],
  photo: ["Please upload a 2x2 photo (ID)."],
  photoFile: ["Please upload a valid 2x2 photo.", "Please upload a 2x2 photo (ID)."],
  registeredVoter: [
    "Please indicate Registered Voter (Yes/No).",
    "Ineligible under Section 3(6): Applicants who have reached voting age (18+) must be duly registered voters of Barangay Pico to qualify for SKEAP.",
  ],
  parentGuardianRegisteredVoter: [
    "A parent or legal guardian must be a duly registered voter of Barangay Pico.",
  ],
  parentGuardianVoterFullName: [
    "Enter the registered parent or legal guardian's full name (at least 3 characters).",
  ],
  course: ["Course is required."],
  yearLevel: ["Year level is required."],
  fathersName: ["Father's name is required."],
  fathersOccupation: ["Father's occupation is required."],
  fathersContact: ["Father's contact is required."],
  mothersMaidenName: ["Mother's maiden name is required."],
  mothersOccupation: ["Mother's occupation is required."],
  mothersContact: ["Mother's contact is required."],
  totalFamilyMonthlyIncome: ["Total family monthly income is required."],
};

type GroupedPresetComboboxProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClear?: () => void;
  groups: readonly PresetOptionGroup[];
  onValid?: () => void;
  invalid?: boolean;
  error?: string;
  required?: boolean;
  dataRequired?: string;
  placeholder?: string;
  disabled?: boolean;
  emptyMessage: string;
};

function GroupedPresetCombobox({
  label,
  value,
  onChange,
  onClear,
  groups,
  onValid,
  invalid,
  error,
  required = false,
  dataRequired,
  placeholder,
  disabled = false,
  emptyMessage,
}: GroupedPresetComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const listboxId = useId();
  const errorId = useId();
  const filteredGroups = useMemo(() => {
    let nextIndex = 0;
    const query = value.trim().toLowerCase();
    return groups
      .map((group) => ({
        ...group,
        options: group.options
          .filter((option) => option.toLowerCase().includes(query))
          .map((option) => ({ value: option, index: nextIndex++ })),
      }))
      .filter((group) => group.options.length > 0);
  }, [groups, value]);
  const filteredOptions = filteredGroups.flatMap((group) => group.options);
  const query = value.trim();
  const hasExactMatch = query.length > 0 && groups.some((group) =>
    group.options.some((option) => option.toLowerCase() === query.toLowerCase())
  );
  const showCustomEntry = query.length > 0 && !hasExactMatch;
  const customOptionIndex = filteredOptions.length;
  const selectableOptionCount = filteredOptions.length + Number(showCustomEntry);
  const activeOption = filteredOptions[activeIndex];
  const activeOptionId = activeOption
    ? `${listboxId}-option-${activeOption.index}`
    : showCustomEntry && activeIndex === customOptionIndex
      ? `${listboxId}-custom-option`
      : undefined;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setActiveIndex(-1);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectOption(option: string) {
    onChange(option);
    onValid?.();
    setIsOpen(false);
    setActiveIndex(-1);
  }

  function updateValue(nextValue: string) {
    onChange(nextValue);
    if (!nextValue.trim()) onClear?.();
    else if (nextValue.trim().length >= 2) onValid?.();
    setIsOpen(true);
    setActiveIndex(-1);
  }

  function acceptCustomEntry() {
    setIsOpen(false);
    setActiveIndex(-1);
    if (value.trim().length >= 2) onValid?.();
  }

  return (
    <div ref={wrapperRef} className="relative flex min-w-0 flex-col">
      <FormFieldLabel htmlFor={inputId} required={required} className="text-sm font-semibold">
        {label}
      </FormFieldLabel>
      <div className="relative mt-1">
        <input
          id={inputId}
          ref={inputRef}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!disabled && isOpen}
          aria-controls={!disabled && isOpen ? listboxId : undefined}
          aria-activedescendant={disabled ? undefined : activeOptionId}
          data-required={dataRequired}
          required={required}
          minLength={required ? 2 : undefined}
          disabled={disabled}
          aria-required={required}
          aria-invalid={invalid}
          aria-describedby={invalid ? errorId : undefined}
          value={value}
          onChange={(event) => {
            updateValue(event.currentTarget.value);
          }}
          onFocus={() => {
            if (!disabled) setIsOpen(true);
          }}
          onBlur={(event) => {
            if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
              setIsOpen(false);
              setActiveIndex(-1);
            }
          }}
          onKeyDown={(event) => {
            if (disabled) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) =>
                selectableOptionCount ? Math.min(current + 1, selectableOptionCount - 1) : -1
              );
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) =>
                selectableOptionCount ? Math.max(current - 1, 0) : -1
              );
            } else if (event.key === "Enter" && isOpen) {
              event.preventDefault();
              const option = activeOption;
              if (option) {
                selectOption(option.value);
              } else if (showCustomEntry && activeIndex === customOptionIndex) {
                acceptCustomEntry();
              } else {
                acceptCustomEntry();
              }
            } else if (event.key === "Escape") {
              event.preventDefault();
              setIsOpen(false);
              setActiveIndex(-1);
            }
          }}
          placeholder={placeholder ?? `Select or type ${label.toLowerCase()}`}
          autoComplete="off"
          className={`w-full min-w-0 rounded-lg border px-3 py-2 pr-16 shadow-sm transition-colors focus:outline-none focus:ring-2 ${disabled ? "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400" : invalid ? "border-rose-300 bg-rose-50/30 text-slate-900 ring-2 ring-rose-100" : "border-slate-300 bg-white text-slate-900 focus:border-blue-500 focus:ring-blue-100"}`}
        />
        <button
          type="button"
          aria-label={!disabled && isOpen ? `Close ${label.toLowerCase()} suggestions` : `Show ${label.toLowerCase()} suggestions`}
          aria-expanded={!disabled && isOpen}
          disabled={disabled}
          onClick={() => {
            setIsOpen((open) => !open);
            setActiveIndex(-1);
          }}
          onMouseDown={(event) => event.preventDefault()}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-slate-700 disabled:cursor-not-allowed disabled:text-slate-300"
        >
          <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
        </button>
        {value && !disabled ? (
          <button
            type="button"
            aria-label={`Clear ${label.toLowerCase()}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              updateValue("");
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-9 flex items-center px-2 text-slate-400 transition-colors hover:text-slate-700"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : null}
        {isOpen && !disabled ? (
          <div
            className="absolute left-0 top-full z-30 mt-1.5 max-h-56 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg"
          >
            {filteredOptions.length === 0 ? (
              <p className="px-2.5 py-2 text-xs text-slate-500" role="status">
                {emptyMessage}
              </p>
            ) : null}
            <div id={listboxId} role="listbox" aria-label={`${label} suggestions`}>
              {filteredGroups.map((group) => (
                <div key={group.label} role="group" aria-label={group.label}>
                  <p
                    className="sticky top-0 z-10 bg-white px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                    aria-hidden="true"
                  >
                    {group.label}
                  </p>
                  {group.options.map((option) => (
                    <div
                      id={`${listboxId}-option-${option.index}`}
                      key={option.value}
                      role="option"
                      aria-selected={option.value === value}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setActiveIndex(option.index)}
                      onClick={() => selectOption(option.value)}
                      className={`cursor-pointer px-4 py-2 text-sm text-slate-700 transition-colors ${option.index === activeIndex ? "bg-slate-100" : "hover:bg-slate-100"}`}
                    >
                      {option.value}
                    </div>
                  ))}
                </div>
              ))}
              {showCustomEntry ? (
                <div
                  id={`${listboxId}-custom-option`}
                  role="option"
                  aria-selected={activeIndex === customOptionIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(customOptionIndex)}
                  onClick={acceptCustomEntry}
                  className={`cursor-pointer rounded-lg px-2.5 py-2 text-sm text-slate-600 transition-colors ${activeIndex === customOptionIndex ? "bg-slate-100" : "hover:bg-slate-50"}`}
                >
                  Use &quot;{query}&quot;
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
      {invalid ? (
        <span id={errorId} className="mt-1 text-xs text-rose-600">
          {error || "Please enter or select your school."}
        </span>
      ) : null}
    </div>
  );
}

type SchoolComboboxProps = Omit<GroupedPresetComboboxProps, "emptyMessage">;

function SchoolCombobox(props: SchoolComboboxProps) {
  return <GroupedPresetCombobox {...props} emptyMessage="No matching schools." />;
}

type OccupationComboboxProps = Omit<GroupedPresetComboboxProps, "emptyMessage" | "groups">;

function OccupationCombobox(props: OccupationComboboxProps) {
  return (
    <GroupedPresetCombobox
      key={props.disabled ? "disabled" : "enabled"}
      {...props}
      groups={LOCAL_OCCUPATION_GROUPS}
      emptyMessage="No matching occupations."
    />
  );
}

function createUploadId() {
  return crypto.randomUUID();
}

export default function SkeapApplicationWizard({
  onSubmitted,
  educationLevel,
  onEducationLevelChange,
  initialActiveEducationLevels,
  yearLevel,
  onYearLevelChange,
  requiredDocuments,
  footerActionsTarget,
  scrollContainerRef,
  userProfile,
  onEligibilityChange,
  allowManualProfileDetails = false,
  hasPriorRevocation = false,
  initialUploadedFiles,
}: {
  onSubmitted: (reference: string) => void;
  educationLevel: SkeapEducationLevel | "";
  onEducationLevelChange: (educationLevel: SkeapEducationLevel | "") => void;
  initialActiveEducationLevels: readonly SkeapEducationLevelCode[];
  yearLevel: string;
  onYearLevelChange: (yearLevel: string) => void;
  requiredDocuments: SkeapRequiredDocument[];
  footerActionsTarget?: HTMLElement | null;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  userProfile: KKProfile | null;
  onEligibilityChange?: (age: number, registeredVoter: boolean | null) => void;
  allowManualProfileDetails?: boolean;
  hasPriorRevocation?: boolean;
  initialUploadedFiles?: Partial<Record<SkeapUploadKey, SkeapUploadValue>>;
}) {
  const [step, setStep] = useState(0);
  const parsedProfileName = parseProfileName(userProfile?.fullName ?? "");
  const profileMiddleName = userProfile?.middleName?.trim() || parsedProfileName.middleName;
  const profilePlaceOfBirth = userProfile?.placeOfBirth;
  const profileBirthDate = userProfile?.birthDate ? String(userProfile.birthDate).slice(0, 10) : "";
  const profileAge = profileBirthDate ? computeAgeFromDateValue(profileBirthDate) : undefined;

  const [course, setCourse] = useState("");
  const [isManualCourse, setIsManualCourse] = useState(false);
  const manualCourseInputRef = useRef<HTMLInputElement>(null);
  const courseFieldId = useId();
  const [gwa, setGwa] = useState("");

  

  // Full SKEAP form fields (mirror DOCX)
  const [lastName, setLastName] = useState(parsedProfileName.lastName);
  const [firstName, setFirstName] = useState(parsedProfileName.firstName);
  const [middleName, setMiddleName] = useState(profileMiddleName);
  const [noMiddleName, setNoMiddleName] = useState(!profileMiddleName.trim());
  const [schoolName, setSchoolName] = useState("");
  const applicantName = `${lastName.trim()}${firstName.trim() ? `, ${firstName.trim()}` : ""}${middleName.trim() ? ` ${middleName.trim()}` : ""}`;
  const applicantDisplayName = [firstName, middleName, lastName].map((part) => part.trim()).filter(Boolean).join(" ");
  const [permanentAddress, setPermanentAddress] = useState(
    formatPermanentAddress([
      userProfile?.purok,
      userProfile?.barangay,
      userProfile?.addressLine,
    ])
  );
  const [placeOfBirth, setPlaceOfBirth] = useState(userProfile?.placeOfBirth ?? "");
  const hasHydratedPlaceOfBirthRef = useRef(Boolean(userProfile?.placeOfBirth));
  const [dateOfBirth, setDateOfBirth] = useState(profileBirthDate);
  const [age, setAge] = useState(
    profileAge !== undefined ? String(profileAge) : String(userProfile?.age ?? "")
  );
  const [civilStatus, setCivilStatus] = useState(
    userProfile?.registration?.civilStatus || userProfile?.civilStatus || ""
  );
  const [gender, setGender] = useState(userProfile?.registration?.sex || userProfile?.sex || "");
  const [fathersName, setFathersName] = useState("");
  const [fathersOccupation, setFathersOccupation] = useState("");
  const [fathersContact, setFathersContact] = useState("");
  const [mothersMaidenName, setMothersMaidenName] = useState("");
  const [mothersOccupation, setMothersOccupation] = useState("");
  const [mothersContact, setMothersContact] = useState("");
  const [contactNumber, setContactNumber] = useState(userProfile?.contactNumber ?? "");
  const emailAddress = userProfile?.email ?? "";
  const [registeredVoter, setRegisteredVoter] = useState<boolean | null>(null);
  const [parentGuardianRegisteredVoter, setParentGuardianRegisteredVoter] = useState(false);
  const [parentGuardianVoterFullName, setParentGuardianVoterFullName] = useState("");
  const [parentGuardianContact, setParentGuardianContact] = useState("");
  const [totalFamilyMonthlyIncome, setTotalFamilyMonthlyIncome] = useState("");
  const [numberOfDependents, setNumberOfDependents] = useState("");
  const yearLevels = educationLevel
    ? SKEAP_YEAR_LEVELS[educationLevel].filter((year) => isEligibleSkeapApplicantYearLevel(educationLevel, year))
    : [];
  const activeEducationLevels = initialActiveEducationLevels.length
    ? initialActiveEducationLevels
    : DEFAULT_ACTIVE_SKEAP_EDUCATION_LEVELS;
  const educationLevelOptions = useMemo<SkeapEducationLevel[]>(
    () => SKEAP_EDUCATION_LEVEL_OPTIONS
      .filter((option) => activeEducationLevels.includes(option.value))
      .map((option) => option.label),
    [activeEducationLevels],
  );
  const isJuniorHighSchool = educationLevel === "Junior High School";
  const isSeniorHighSchool = educationLevel === "Senior High School";
  const isTechVoc = educationLevel === "Technical and Vocational (Tech-Voc)";
  const coursePresetGroups = useMemo(() => {
    const code = getSkeapEducationLevelCode(educationLevel);
    return code ? SKEAP_COURSE_PRESETS[code] : [];
  }, [educationLevel]);
  const coursePresetValues = useMemo(
    () => coursePresetGroups.flatMap((group) => group.options),
    [coursePresetGroups],
  );
  const courseSelectValue = isJuniorHighSchool
    ? "General Secondary Curriculum"
    : isManualCourse || (course.trim() && !coursePresetValues.includes(course))
      ? "__OTHER__"
      : course;
  const isIncomingFreshman = yearLevel === "Incoming Freshman" || yearLevel === "New Trainee / Incoming";
  const applicantAge = computeAgeFromDateValue(dateOfBirth) ?? Number(age);
  const isVotingAge = applicantAge >= 18;
  const isMinorApplicant = applicantAge >= 15 && applicantAge < 18;

  function getVoterCertificateNameVerification(
    file?: Pick<UploadedFile, "ocrText" | "ocrConfidence">,
  ) {
    if (!file || file.ocrText === undefined) return undefined;
    return verifyOcrDocumentName(
      file.ocrText,
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      {
        applicant: { firstName, middleName, lastName },
        fatherName: fathersName,
        motherName: mothersMaidenName,
        isRegisteredVoter: registeredVoter,
        age: applicantAge,
        parentVoterName: parentGuardianVoterFullName,
        confidence: file.ocrConfidence,
      },
    );
  }

  useEffect(() => {
    if (courseSelectValue === "__OTHER__") manualCourseInputRef.current?.focus();
  }, [courseSelectValue]);

  useEffect(() => {
    if (profileAge !== undefined) onEligibilityChange?.(profileAge, null);
  }, [onEligibilityChange, profileAge]);

  // Educational background
  const [elementarySchool, setElementarySchool] = useState("");
  const [elementaryYearGraduated, setElementaryYearGraduated] = useState("");
  const [highSchool, setHighSchool] = useState("");
  const [highSchoolYearGraduated, setHighSchoolYearGraduated] = useState("");
  const [college, setCollege] = useState("");
  const [collegeYearGraduated, setCollegeYearGraduated] = useState("");
  const [vocational, setVocational] = useState("");
  const [vocationalYearGraduated, setVocationalYearGraduated] = useState("");

  const [files, setFiles] = useState<UploadedFile[]>(() =>
    SKEAP_TERM_UPLOAD_KEYS.flatMap((key) => {
      const upload = initialUploadedFiles?.[key];
      if (!upload?.url.trim()) return [];

      return [{
        id: `initial-${key}`,
        name: upload.name || SKEAP_UPLOAD_LABELS[key],
        type: upload.fileType || (upload.name?.toLowerCase().endsWith(".pdf") ? "application/pdf" : ""),
        size: 0,
        progress: 100,
        status: "done" as const,
        url: upload.url,
        previewUrl: upload.url,
        requirement: key,
        manualReview: upload.manualReview,
        verificationStatus: upload.verificationStatus,
        ocrNameStatus: upload.ocrNameStatus,
      }];
    })
  );
  const [identityDocuments, setIdentityDocuments] = useState<KkIdentityDocuments | null>(null);
  const [identityDocumentsError, setIdentityDocumentsError] = useState<string | null>(null);
  const [loadingIdentityDocuments, setLoadingIdentityDocuments] = useState(true);
  const [updatingPhoto, setUpdatingPhoto] = useState(false);
  const [invalidFields, setInvalidFields] = useState<Set<string>>(new Set());
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [showGlobalError, setShowGlobalError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const previewObjectUrlsRef = useRef(new Set<string>());

  useEffect(() => {
    if (hasHydratedPlaceOfBirthRef.current || !profilePlaceOfBirth) return;
    setPlaceOfBirth((current) => current.trim() ? current : profilePlaceOfBirth);
    hasHydratedPlaceOfBirthRef.current = true;
  }, [profilePlaceOfBirth]);

  async function updateProfilePhoto(file: File) {
    setUpdatingPhoto(true);
    try {
      const formData = new FormData();
      const uploadFile = await compressImageForUpload(file);
      ensureSkeapUploadWithinLimit(uploadFile);
      formData.append("photo", uploadFile);
      const response = await fetch("/api/my/kk-identity-documents/photo", {
        method: "POST",
        body: formData,
      });
      if (!response.ok) {
        throw new Error(await getSkeapUploadErrorMessage(response, "Unable to update your photo."));
      }
      const result = await response.json();
      if (typeof result.photo !== "string" || !result.photo.startsWith("/api/private-documents/")) {
        throw new Error("The updated photo reference was invalid.");
      }

      setIdentityDocuments((current) => current ? { ...current, photo: result.photo } : current);
      window.dispatchEvent(new Event("skonnect-profile-updated"));
    } finally {
      setUpdatingPhoto(false);
    }
  }

  useEffect(() => () => {
    previewObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewObjectUrlsRef.current.clear();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/my/kk-identity-documents", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) {
          throw new Error(result.error || "Unable to load your verified KK identity documents.");
        }
        if (!isKkIdentityDocuments(result.documents)) {
          throw new Error("The approved KK Profile returned incomplete identity document references.");
        }
        setIdentityDocuments(result.documents);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error("Could not load approved KK identity documents for SKEAP:", error);
        setIdentityDocumentsError(
          error instanceof Error ? error.message : "Unable to load verified KK identity documents."
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadingIdentityDocuments(false);
      });

    return () => controller.abort();
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

  const photoFileUrl = identityDocuments?.photo ?? "";

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
      if (!noMiddleName && !middleName.trim()) addError("middleName", "Middle name is required.");
      if (!permanentAddress.trim()) addError("permanentAddress", "Permanent address is required.");
      if (!schoolName.trim()) addError("schoolName", "School / Institution is required.");
      else if (schoolName.trim().length < 2) addError("schoolName", "Please enter or select your school.");
      if (!dateOfBirth.trim()) addError("dateOfBirth", "Date of birth is required.");
      const placeOfBirthResult = placeOfBirthSchema.safeParse(placeOfBirth);
      if (!placeOfBirthResult.success) {
        addError("placeOfBirth", placeOfBirthResult.error.issues[0]?.message ?? "Enter a valid place of birth.");
      }
      if (!age.trim()) {
        addError("age", "Age is required.");
      } else if (!Number.isFinite(applicantAge) || applicantAge < 15 || applicantAge > 30) {
        addError("age", "Applicants must be between 15 and 30 years old.");
      }
      if (!civilStatus.trim()) addError("civilStatus", "Civil status is required.");
      if (!gender.trim()) addError("gender", "Gender is required.");
      if (!contactNumber.trim()) addError("contactNumber", "Contact number is required.");
      if (!emailAddress.trim()) addError("emailAddress", "Email address is required.");
      if (!photoFileUrl) {
        addError(
          "photoFile",
          loadingIdentityDocuments
            ? "Loading your verified KK Profile photo."
            : identityDocumentsError || "Your verified KK Profile photo is unavailable."
        );
      }
      if (registeredVoter === null) addError("registeredVoter", "Please indicate Registered Voter (Yes/No).");
      if (isVotingAge && registeredVoter === false) {
        addError(
          "registeredVoter",
          "Ineligible under Section 3(6): Applicants who have reached voting age (18+) must be duly registered voters of Barangay Pico to qualify for SKEAP.",
        );
      }
      if (isMinorApplicant && registeredVoter === false) {
        if (!parentGuardianRegisteredVoter) {
          addError(
            "parentGuardianRegisteredVoter",
            "A parent or legal guardian must be a duly registered voter of Barangay Pico.",
          );
        }
        if (parentGuardianVoterFullName.trim().length < 3) {
          addError(
            "parentGuardianVoterFullName",
            "Enter the registered parent or legal guardian's full name (at least 3 characters).",
          );
        }
      }
    }
    if (step === 1) {
      if (!educationLevel) addError("educationLevel", "Education level is required.");
      else if (!educationLevelOptions.includes(educationLevel)) {
        addError(
          "educationLevel",
          "This education category is not open for the current SKEAP cycle. Please select an available category.",
        );
      }
      if (!isJuniorHighSchool && !course.trim()) {
        addError("course", isSeniorHighSchool ? "Academic / TVL strand is required." : "Course is required.");
      }
      if (!yearLevel.trim()) addError("yearLevel", "Year level is required.");
      else if (!educationLevel || !isEligibleSkeapApplicantYearLevel(educationLevel, yearLevel)) {
        addError("yearLevel", "Select a valid year level for the chosen education level.");
      }
      if (!fathersName.trim()) addError("fathersName", "Father's name is required.");
      if (!fathersOccupation.trim()) addError("fathersOccupation", "Father's occupation is required.");
      if (!fathersContact.trim()) addError("fathersContact", "Father's contact is required.");
      if (!mothersMaidenName.trim()) addError("mothersMaidenName", "Mother's maiden name is required.");
      if (!mothersOccupation.trim()) addError("mothersOccupation", "Mother's occupation is required.");
      if (!mothersContact.trim()) addError("mothersContact", "Mother's contact is required.");
      if (!totalFamilyMonthlyIncome.trim()) addError("totalFamilyMonthlyIncome", "Total family monthly income is required.");
      const dependentsCount = Number(numberOfDependents);
      if (
        !numberOfDependents.trim() ||
        !Number.isInteger(dependentsCount) ||
        dependentsCount < 0
      ) {
        addError("numberOfDependents", "Enter a whole number of dependents, including zero if none.");
      }
    }
    if (step === 3) {
      const requiredKeys = requiredDocuments.map((document) => document.key);
      const missingKeys = requiredKeys.filter((key) => !isUploadCompleteForKey(files, key));
      for (const key of missingKeys) {
        const label = requiredDocuments.find((document) => document.key === key)?.label || "Required document";
        addError(key, `Please upload the required file: ${label}.`);
      }
    }
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
    if (currentStep === 3) {
      const missingKey = requiredDocuments
        .map((document) => document.key)
        .find((key) => !isUploadCompleteForKey(files, key));
      if (missingKey) {
        const uploadCard = document.getElementById(`upload-${missingKey}`);
        if (uploadCard) {
          uploadCard.scrollIntoView({ behavior: "smooth", block: "center" });
          uploadCard.focus({ preventScroll: true });
          return;
        }
      }
    }

    requestAnimationFrame(() => {
      const firstInvalid = scrollContainerRef.current
        ?.querySelector<HTMLElement>('[aria-invalid="true"], [data-focus-invalid="true"]');
      if (!firstInvalid) return;

      const target = firstInvalid.matches("input, select, textarea, button, canvas, [tabindex]")
        ? firstInvalid
        : firstInvalid.querySelector<HTMLElement>("input, select, textarea, button, canvas, [tabindex]") ??
          firstInvalid;
      target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      target.focus({ preventScroll: true });
    });
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
      id = createUploadId();
      const normalizedRequirement = requirement ? normalizeUploadRequirement(requirement) : normalizeUploadRequirement(file.name || "");
      const normalizedKey = normalizedRequirement || normalizeUploadRequirement(file.name || "");
      const isVoterCertificate = normalizedKey === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE;
      if (!getSupportedSkeapDocumentType(file)) {
        const errorText = "That file type isn't supported. Please choose a PDF, JPG/JFIF, PNG, or WebP.";
        setFiles((prev) => [
          ...prev.filter((existingFile) => existingFile.requirement !== normalizedKey),
          {
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            progress: 0,
            status: "error",
            error: errorText,
            requirement: normalizedKey,
          },
        ]);
        return errorText;
      }

      if (file.size === 0) {
        const errorText = "This file is empty. Please choose another file.";
        setFiles((prev) => [
          ...prev.filter((existingFile) => existingFile.requirement !== normalizedKey),
          {
            id,
            name: file.name,
            type: file.type,
            size: file.size,
            progress: 0,
            status: "error",
            error: errorText,
            requirement: normalizedKey,
          },
        ]);
        return errorText;
      }

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
        status: STRICT_OCR_UPLOAD_KEYS.has(normalizedKey as SkeapUploadKey) ||
          isVoterCertificate ||
          isSkeapRasterImage(file)
          ? "validating"
          : "queued",
        requirement: normalizedKey,
        ...(isVoterCertificate ? { verificationStatus: "PENDING_ADMIN_REVIEW" as const } : {}),
        file,
      };

      setFiles((prev) => [
        ...prev.filter((f) => f.requirement !== normalizedKey),
        newUpload,
      ]);

      const uploadFile = await compressImageForUpload(file);
      if (!getSupportedSkeapDocumentType(uploadFile)) {
        const errorText = "The compressed image format is not supported. Please choose another image.";
        setFiles((prev) => prev.map((uploadedFile) => uploadedFile.id === id
          ? { ...uploadedFile, status: "error", error: errorText }
          : uploadedFile));
        return errorText;
      }

      const preparedUpload = {
        ...newUpload,
        type: uploadFile.type,
        size: uploadFile.size,
        file: uploadFile,
      };
      setFiles((prev) => prev.map((uploadedFile) => uploadedFile.id === id
        ? preparedUpload
        : uploadedFile));

      ensureSkeapUploadWithinLimit(uploadFile);

      if (STRICT_OCR_UPLOAD_KEYS.has(normalizedKey as SkeapUploadKey) || isVoterCertificate) {
        try {
          const validation = await validateDocumentOCR(uploadFile, normalizedKey).catch((error: unknown) => {
            if (!isVoterCertificate) throw error;
            console.error("COMELEC Voter's Certificate OCR name check failed; the upload will be sent for administrator review.", {
              fileName: file.name,
              error,
            });
            return {
              status: "review" as const,
              extractedText: "",
              confidence: 0,
              reason: "The document reader could not read the holder name.",
            };
          });
          const isNameVerificationDocument =
            normalizedKey === SKEAP_UPLOAD_KEY.FAMILY_INCOME ||
            normalizedKey === SKEAP_UPLOAD_KEY.ENROLLMENT_CERT ||
            isVoterCertificate;
          const nameVerification = isNameVerificationDocument
            ? verifyOcrDocumentName(validation.extractedText, normalizedKey, {
                applicant: { firstName, middleName, lastName },
                fatherName: fathersName,
                motherName: mothersMaidenName,
                ...(isVoterCertificate
                  ? {
                      isRegisteredVoter: registeredVoter,
                      age: applicantAge,
                      parentVoterName: parentGuardianVoterFullName,
                    }
                  : {}),
                confidence: validation.confidence,
              })
            : undefined;
          let ocrNameStatus = validation.status === "verified"
            ? nameVerification?.status
            : isVoterCertificate
              ? nameVerification?.status ?? "LOW_READABILITY"
            : nameVerification?.status === "LOW_READABILITY"
              ? nameVerification.status
              : undefined;
          let ocrNameMessage: string | undefined;
          if (isVoterCertificate) {
            if (validation.status !== "verified") {
              ocrNameStatus = "FOR_VERIFICATION";
              ocrNameMessage = nameVerification?.status === "FOR_VERIFICATION"
                ? nameVerification.message
                : "The voter certificate could not be verified automatically. Uploaded for SK Admin verification.";
            } else if (
              nameVerification?.status !== "MATCHED_APPLICANT" &&
              nameVerification?.status !== "MATCHED_PARENT"
            ) {
              ocrNameStatus = "FOR_VERIFICATION";
              ocrNameMessage = nameVerification?.message ||
                (isMinorApplicant
                  ? "Uploaded for SK Admin verification of parent/guardian relationship."
                  : "Uploaded for SK Admin verification of applicant name.");
            } else {
              ocrNameMessage = nameVerification.message;
            }
          }

          if (validation.status !== "verified" && !isVoterCertificate) {
            const errorText = `Document not verified. ${validation.status === "review"
              ? validation.reason
              : "Please upload a readable document for this requirement."}`;
            setFiles((prev) => prev.map((uploadedFile) => uploadedFile.id === id
              ? {
                  ...uploadedFile,
                  status: "error",
                  error: errorText,
                  manualReviewAvailable: true,
                  ...(ocrNameStatus ? { ocrNameStatus } : {}),
                }
              : uploadedFile));
            return errorText;
          }
          setFiles((prev) => prev.map((uploadedFile) => uploadedFile.id === id
            ? {
                ...uploadedFile,
                status: "queued",
                error: undefined,
                ...(ocrNameStatus ? { ocrNameStatus } : {}),
                ...(ocrNameMessage ? { ocrNameMessage } : {}),
                ...(isVoterCertificate
                  ? {
                      ocrText: validation.extractedText,
                      ocrConfidence: validation.confidence,
                    }
                  : {}),
              }
            : uploadedFile));
        } catch (error) {
          const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
          const errorText = `Document not verified. The document reader could not finish checking this file (${details}). Please try again or submit it for administrator review.`;
          console.error("SKEAP document OCR validation failed.", {
            fileName: file.name,
            requirement: normalizedKey,
            error,
          });
          setFiles((prev) => prev.map((uploadedFile) => uploadedFile.id === id
            ? { ...uploadedFile, status: "error", error: errorText, manualReviewAvailable: true }
            : uploadedFile));
          return errorText;
        }
      }

      return uploadPendingFile(id, uploadFile, normalizedKey);
    } catch (err) {
      const text = err instanceof Error ? err.message : "Upload failed";
      console.error("SKEAP upload failed", { requirement, error: text, rawError: err });
      if (id) {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error", error: text } : f)));
      }
      return text;
    }
  }

  async function uploadPendingFile(id: string, file?: File, requirement?: SkeapUploadKey): Promise<string | null> {
    const pendingFile = file ?? files.find((item) => item.id === id)?.file;
    if (!pendingFile) {
      const errorText = "Please choose this file again before uploading.";
      setFiles((prev) => prev.map((item) => item.id === id ? { ...item, status: "error", error: errorText } : item));
      console.error("SKEAP upload could not start because the selected local file is unavailable.", { id });
      return errorText;
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
      return null;
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
      return errorText;
    }
  }

  async function continueUploadForManualReview(upload: UploadedFile) {
    if (!upload.file || !upload.requirement) return;
    const requirement = upload.requirement as SkeapUploadKey;
    setFiles((prev) => prev.map((item) => item.id === upload.id
      ? { ...item, status: "queued", error: undefined, manualReview: true, manualReviewAvailable: false }
      : item));
    await uploadPendingFile(upload.id, upload.file, requirement);
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
    setActionError(null);

    try {
      const doneUrls = files.filter((f) => f.status === "done").map((f) => f.url).filter(Boolean) as string[];
      const requiredUploadKeys = requiredDocuments.map((document) => document.key);
      const documentUploads = requiredUploadKeys.reduce<Partial<Record<SkeapUploadKey, SkeapUploadValue>>>((acc, key) => {
        const file = findUploadFileForKey(files, key);
        if (file?.status === "done" && file.url?.trim()) {
          acc[key] = {
            name: file.name,
            url: file.url.trim(),
            ...(file.manualReview ? { manualReview: true } : {}),
            ...(file.ocrNameStatus ? { ocrNameStatus: file.ocrNameStatus } : {}),
            ...(file.ocrNameStatus === "FOR_VERIFICATION" && file.ocrNameMessage
              ? { ocrNameMessage: file.ocrNameMessage }
              : {}),
            ...(key === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE && file.verificationStatus
              ? { verificationStatus: file.verificationStatus }
              : {}),
          };
        }
        return acc;
      }, {});
      if (identityDocuments?.photo) {
        documentUploads[SKEAP_UPLOAD_KEY.PHOTO] = {
          name: "2x2 ID Picture",
          url: identityDocuments.photo,
        };
      }
      const voterCertificate = findUploadFileForKey(files, SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE);
      if (voterCertificate?.status === "done" && voterCertificate.url?.trim()) {
        const voterOcrNameStatus =
          getVoterCertificateNameVerification(voterCertificate)?.status ||
          voterCertificate.ocrNameStatus;
        documentUploads[SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE] = {
          name: voterCertificate.name,
          url: voterCertificate.url.trim(),
          verificationStatus: "PENDING_ADMIN_REVIEW",
          ...(voterOcrNameStatus ? { ocrNameStatus: voterOcrNameStatus } : {}),
          ...(voterOcrNameStatus === "FOR_VERIFICATION" && voterCertificate.ocrNameMessage
            ? { ocrNameMessage: voterCertificate.ocrNameMessage }
            : {}),
        };
      }

      const missingUploadKeys = requiredUploadKeys.filter((key) => !documentUploads[key]?.url?.trim());
      if (missingUploadKeys.length > 0) {
        setMessage(
          `Please upload required document${missingUploadKeys.length > 1 ? "s" : ""}: ${missingUploadKeys
            .map((key) => requiredDocuments.find((document) => document.key === key)?.label || key)
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
      const photoFileUrl = identityDocuments?.photo ?? "";
      const voterCertificateFileUrl =
        files.find((f) => f.status === "done" && f.requirement === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE)?.url || null;

      if (!enrollmentFileUrl || !reportCardFileUrl) {
        setMessage(
          isIncomingFreshman
            ? isTechVoc
              ? "Please upload your Tech-Voc admission or registration document and latest grade report before submitting."
              : "Please upload your Notice of Admission / SHS Report Card and latest grade report before submitting."
            : "Please upload the required enrollment and grade report files before submitting."
        );
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/skeap/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schoolName: schoolName.trim(),
          educationLevel,
          currentCourse: course.trim() || (isJuniorHighSchool ? "N/A" : ""),
          yearLevel,
          gwa: gwa,
          enrollmentFileUrl: enrollmentFileUrl || doneUrls[0],
          reportCardFileUrl: reportCardFileUrl || doneUrls[1],
          photoFileUrl,
          // Send the structured name fields so the API can require and format the full legal name.
          applicantName,
          lastName,
          firstName,
          middleName,
          noMiddleName,
          permanentAddress,
          dateOfBirth,
          placeOfBirth,
          age: String(applicantAge),
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
          parentGuardianRegisteredVoter: isMinorApplicant && registeredVoter === false
            ? parentGuardianRegisteredVoter
            : false,
          parentGuardianVoterFullName: isMinorApplicant && registeredVoter === false
            ? parentGuardianVoterFullName.trim()
            : "",
          parentGuardianName: isMinorApplicant
            ? parentGuardianVoterFullName.trim()
            : "",
          parentGuardianContact: isMinorApplicant
            ? parentGuardianContact.trim()
            : "",
          voterCertificateFileUrl: doneUrls.find((u, idx) => files.findIndex((f) => f.requirement === "voter_certificate" && f.url === u) >= 0) || null,
          totalFamilyMonthlyIncome,
          numberOfDependents,
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
        setActionError(body?.error || "Failed to submit SKEAP application.");
        return;
      }

      const reference = String(body.inquiryId || body.applicationId || "");
      window.dispatchEvent(new Event("skeap-application-submitted"));
      onSubmitted(reference);
    } catch {
      setActionError("Network error while submitting application.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-5">
      {actionError ? <p role="alert" className="text-sm font-medium text-rose-600">{actionError}</p> : null}
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
        <p className="mt-2 text-xs text-slate-500">
          Fields marked with <span className="font-semibold text-rose-600">*</span> are required.
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
                dataRequired={!noMiddleName ? "profile" : undefined}
                required={!noMiddleName}
                readOnly={!allowManualProfileDetails || noMiddleName}
                invalid={invalidFields.has("middleName")}
              />
              <label className="mt-2 inline-flex items-center gap-2 text-xs text-slate-600">
                <input
                  type="checkbox"
                  checked={noMiddleName}
                  disabled={!allowManualProfileDetails && !profileMiddleName.trim()}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setNoMiddleName(checked);
                    setMiddleName(checked ? "" : profileMiddleName);
                    markFieldValid("middleName");
                  }}
                  className="rounded border-slate-300"
                />
                I do not have a middle name
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4">
            {allowManualProfileDetails ? (
              <EditableField label="Permanent Address" value={permanentAddress} onChange={(value) => { setPermanentAddress(value); markFieldValid("permanentAddress"); }} placeholder="Enter permanent address in Barangay Pico" dataRequired="profile" required invalid={invalidFields.has("permanentAddress")} />
            ) : (
            <label className="flex min-w-0 flex-col">
              <FormFieldLabel required className="text-sm font-semibold">Permanent Address</FormFieldLabel>
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
            <SchoolCombobox
              label="School / Institution"
              value={schoolName}
              onChange={setSchoolName}
              groups={getSchoolPresetGroups(educationLevel)}
              onValid={() => markFieldValid("schoolName")}
              required
              dataRequired="profile"
              invalid={invalidFields.has("schoolName")}
              error={validationErrors.schoolName}
            />
          </div>

          <div className="grid grid-cols-1 items-start gap-x-6 gap-y-4 md:grid-cols-2">
            <label className="flex flex-col">
              <FormFieldLabel required className="text-sm font-semibold">Date of Birth</FormFieldLabel>
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
                  if (computedAge !== undefined) {
                    setAge(String(computedAge));
                    onEligibilityChange?.(computedAge, registeredVoter);
                  }
                  markFieldValid("dateOfBirth");
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 focus:outline-none ${invalidFields.has("dateOfBirth") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : allowManualProfileDetails ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"}`}
              />
            </label>
            <label className="flex flex-col">
              <FormFieldLabel required className="text-sm font-semibold">Place of Birth</FormFieldLabel>
              <input
                data-required="profile"
                required
                aria-required="true"
                value={placeOfBirth}
                placeholder="e.g., La Trinidad, Benguet"
                aria-invalid={invalidFields.has("placeOfBirth")}
                aria-describedby={invalidFields.has("placeOfBirth") ? "skeap-place-of-birth-error" : undefined}
                onChange={(e) => {
                  setPlaceOfBirth(e.target.value);
                  markFieldValid("placeOfBirth");
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 shadow-sm transition-colors focus:ring-2 ${invalidFields.has("placeOfBirth") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100"}`}
              />
              {invalidFields.has("placeOfBirth") ? (
                <span id="skeap-place-of-birth-error" role="alert" className="mt-1 text-xs text-rose-600">
                  {validationErrors.placeOfBirth}
                </span>
              ) : null}
            </label>
            <label className="flex flex-col">
              <FormFieldLabel required className="text-sm font-semibold">Age</FormFieldLabel>
              <input
                data-required="profile"
                type="number"
                min="15"
                max="30"
                required
                aria-required="true"
                value={age}
                readOnly={!allowManualProfileDetails}
                aria-invalid={invalidFields.has("age")}
                onChange={(event) => {
                  const nextAge = event.target.value;
                  setAge(nextAge);
                  onEligibilityChange?.(
                    computeAgeFromDateValue(dateOfBirth) ?? Number(nextAge),
                    registeredVoter,
                  );
                  markFieldValid("age");
                }}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 focus:outline-none ${invalidFields.has("age") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : allowManualProfileDetails ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"}`}
              />
            </label>
            <div className="flex min-w-0 flex-col">
              <FormFieldLabel htmlFor="skeap-civil-status" required className="text-sm font-semibold">
                Civil Status
              </FormFieldLabel>
              <div className="relative mt-1 w-full">
                <select
                  id="skeap-civil-status"
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
                  className={`w-full appearance-none rounded-lg border px-3 py-2 pr-10 text-slate-900 ${invalidFields.has("civilStatus") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : allowManualProfileDetails ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"}`}
                >
                  <option value="">Select status</option>
                  <option value="Single">Single</option>
                  <option value="Married">Married</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                  <option value="Other">Other</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="flex min-w-0 flex-col">
              <FormFieldLabel htmlFor="skeap-gender" required className="text-sm font-semibold">
                Gender
              </FormFieldLabel>
              <div className="relative mt-1 w-full">
                <select
                  id="skeap-gender"
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
                  className={`w-full appearance-none rounded-lg border px-3 py-2 pr-10 text-slate-900 ${invalidFields.has("gender") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : allowManualProfileDetails ? "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100" : "cursor-not-allowed border-slate-200 bg-slate-50 text-slate-500"}`}
                >
                  <option value="">Select gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m19 9-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>
            <label className="flex flex-col">
              <FormFieldLabel required className="text-sm font-semibold">Contact Number</FormFieldLabel>
              <input
                data-required="profile"
                required
                aria-required="true"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={contactNumber}
                onChange={(e) => {
                  setContactNumber(e.target.value.replace(/\D/g, ""));
                  markFieldValid("contactNumber");
                }}
                aria-invalid={invalidFields.has("contactNumber")}
                className={`mt-1 w-full rounded-lg border px-3 py-2 text-slate-900 shadow-sm transition-colors focus:ring-2 ${invalidFields.has("contactNumber") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-blue-100"}`}
              />
            </label>
            <label className="flex flex-col md:col-span-2">
              <FormFieldLabel required className="text-sm font-semibold">Email Address</FormFieldLabel>
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
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
                <p className="text-sm font-semibold text-slate-900">2x2 ID Picture</p>
                <p className="mt-1 text-xs text-emerald-800">Attached securely from your verified records.</p>
                {identityDocuments?.photo ? (
                  <a
                    href={identityDocuments.photo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex text-xs font-semibold text-emerald-800 underline"
                  >
                    View verified photo
                  </a>
                ) : loadingIdentityDocuments ? (
                  <p
                    className="mt-2 text-xs text-slate-500"
                    aria-invalid={invalidFields.has("photoFile")}
                    tabIndex={invalidFields.has("photoFile") ? -1 : undefined}
                  >
                    Loading verified photo…
                  </p>
                ) : (
                  <p
                    className="mt-2 text-xs text-rose-700"
                    aria-invalid={invalidFields.has("photoFile")}
                    tabIndex={invalidFields.has("photoFile") ? -1 : undefined}
                  >
                    {identityDocumentsError || "Verified photo is unavailable."}
                  </p>
                )}
              </div>
            </div>
            <fieldset className="mt-2 flex flex-col gap-2 md:col-span-2">
              <legend>
                <FormFieldLabel required className="text-sm font-semibold text-slate-900">Registered Voter</FormFieldLabel>
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${registeredVoter === true ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300"} ${invalidFields.has("registeredVoter") ? "border-rose-300" : ""}`}>
                  <input
                    type="radio"
                    name="registeredVoter"
                    value="yes"
                    required
                    checked={registeredVoter === true}
                    data-focus-invalid={invalidFields.has("registeredVoter") ? "true" : undefined}
                    aria-describedby={
                      validationErrors.registeredVoter
                        ? "registered-voter-error"
                        : registeredVoter === true
                          ? "voter-certificate-guidance"
                          : isVotingAge && registeredVoter === false
                            ? "section-3-6-voter-blocker"
                            : isMinorApplicant && registeredVoter === false
                              ? "parent-voter-guidance"
                              : undefined
                    }
                    onChange={() => {
                      setRegisteredVoter(true);
                      onEligibilityChange?.(applicantAge, true);
                      markFieldValid("registeredVoter");
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className="text-sm font-medium text-slate-800">Yes, I am a registered voter of Barangay Pico</span>
                </label>
                <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${registeredVoter === false ? "border-blue-500 bg-blue-50 ring-2 ring-blue-100" : "border-slate-200 bg-white hover:border-slate-300"} ${invalidFields.has("registeredVoter") ? "border-rose-300" : ""}`}>
                  <input
                    type="radio"
                    name="registeredVoter"
                    value="no"
                    required
                    checked={registeredVoter === false}
                    data-focus-invalid={invalidFields.has("registeredVoter") ? "true" : undefined}
                    aria-describedby={
                      validationErrors.registeredVoter
                        ? "registered-voter-error"
                        : registeredVoter === true
                          ? "voter-certificate-guidance"
                          : isVotingAge && registeredVoter === false
                            ? "section-3-6-voter-blocker"
                            : isMinorApplicant && registeredVoter === false
                              ? "parent-voter-guidance"
                              : undefined
                    }
                    onChange={() => {
                      setRegisteredVoter(false);
                      onEligibilityChange?.(applicantAge, false);
                      markFieldValid("registeredVoter");
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0"
                  />
                  <span className="text-sm font-medium text-slate-800">No, I am not a registered voter</span>
                </label>
              </div>
              {isVotingAge && registeredVoter === false ? (
                <p id="section-3-6-voter-blocker" className="mt-3 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-3 text-xs text-rose-800" role="alert">
                  <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  Ineligible under Section 3(6): Applicants who have reached voting age (18+) must be duly registered voters of Barangay Pico to qualify for SKEAP.
                </p>
              ) : null}
              {registeredVoter === true ? (
                <div
                  id="voter-certificate-guidance"
                  role="note"
                  className="mt-3 flex items-start gap-2.5 rounded-xl border border-sky-200/80 bg-sky-50/70 px-3.5 py-2.5 text-xs text-slate-700"
                >
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-sky-700" aria-hidden="true" />
                  <p>
                    <span className="font-semibold">Voter Verification Required:</span>{" "}
                    Please upload your Barangay Pico COMELEC Voter&apos;s Certificate in the Uploads step and bring the original/CTC during in-person verification.
                  </p>
                </div>
              ) : null}
              {validationErrors.registeredVoter && !(isVotingAge && registeredVoter === false) ? (
                <p id="registered-voter-error" className="text-xs text-rose-600" role="alert">
                  {validationErrors.registeredVoter}
                </p>
              ) : null}
              {isMinorApplicant && registeredVoter === false ? (
                <div className="mt-3 space-y-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4">
                  <p id="parent-voter-guidance" className="text-sm leading-relaxed text-slate-700">
                    Under Section 3(6), applicants under 18 who are not yet registered voters may qualify through a parent or legal guardian who is a duly registered voter of Barangay Pico.
                  </p>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      data-required="profile"
                      type="checkbox"
                      required
                      checked={parentGuardianRegisteredVoter}
                      aria-invalid={invalidFields.has("parentGuardianRegisteredVoter")}
                      onChange={(event) => {
                        setParentGuardianRegisteredVoter(event.target.checked);
                        markFieldValid("parentGuardianRegisteredVoter");
                      }}
                      className="mt-0.5 h-4 w-4 shrink-0"
                    />
                    <FormFieldLabel required className="text-sm font-normal text-slate-700">
                      I confirm that my parent or legal guardian is a duly registered voter of Barangay Pico.
                    </FormFieldLabel>
                  </label>
                  {validationErrors.parentGuardianRegisteredVoter ? (
                    <p className="text-xs text-rose-600" role="alert">{validationErrors.parentGuardianRegisteredVoter}</p>
                  ) : null}
                </div>
              ) : null}
              {isMinorApplicant ? (
                <div className="mt-3 grid gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <FormFieldLabel
                      required={registeredVoter === false}
                      className="text-sm font-medium text-slate-800"
                    >
                      Parent / Legal Guardian Name
                    </FormFieldLabel>
                    <input
                      data-required={registeredVoter === false ? "profile" : undefined}
                      name="parentGuardianVoterFullName"
                      type="text"
                      required={registeredVoter === false}
                      minLength={registeredVoter === false ? 3 : undefined}
                      value={parentGuardianVoterFullName}
                      aria-invalid={invalidFields.has("parentGuardianVoterFullName")}
                      aria-describedby={
                        validationErrors.parentGuardianVoterFullName
                          ? "parent-guardian-voter-name-error"
                          : undefined
                      }
                      onChange={(event) => {
                        setParentGuardianVoterFullName(event.target.value);
                        markFieldValid("parentGuardianVoterFullName");
                      }}
                      className={`rounded-lg border px-3 py-2 text-slate-900 ${invalidFields.has("parentGuardianVoterFullName") ? "border-rose-300 bg-rose-50/30" : "border-slate-300 bg-white"}`}
                    />
                    {validationErrors.parentGuardianVoterFullName ? (
                      <span id="parent-guardian-voter-name-error" className="text-xs text-rose-600" role="alert">{validationErrors.parentGuardianVoterFullName}</span>
                    ) : null}
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <FormFieldLabel className="text-sm font-medium text-slate-800">
                      Parent / Legal Guardian Contact Number
                    </FormFieldLabel>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={parentGuardianContact}
                      onChange={(event) => setParentGuardianContact(event.target.value.replace(/\D/g, ""))}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                    />
                  </label>
                </div>
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
            <label className="flex flex-col">
              <FormFieldLabel required className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Education Level
              </FormFieldLabel>
              <div className="relative mt-1">
                <select
                  data-required="scholarship"
                  required
                  aria-required="true"
                  value={educationLevel}
                  onChange={(event) => {
                    const value = event.currentTarget.value as SkeapEducationLevel | "";
                    onEducationLevelChange(value);
                    onYearLevelChange("");
                    setCourse(value === "Junior High School" ? "General Secondary Curriculum" : "");
                    setIsManualCourse(false);
                    markFieldValid("educationLevel");
                    markFieldValid("yearLevel");
                    markFieldValid("course");
                  }}
                  aria-invalid={invalidFields.has("educationLevel")}
                  className={`w-full appearance-none rounded-xl border py-2 pl-3 pr-10 text-sm text-slate-900 ${invalidFields.has("educationLevel") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                >
                  <option value="">Select education level</option>
                  {educationLevelOptions.map((level) => (
                    <option key={level} value={level}>{level}</option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
              </div>
              <span className="mt-1 text-xs leading-relaxed text-slate-500">
                Showing education categories opened by the Barangay Pico SK Council for the current SKEAP cycle.
              </span>
              {isTechVoc ? (
                <span className="mt-1 text-xs leading-relaxed text-slate-500">
                  Must be equivalent to at least one (1) semester or five (5) months.
                </span>
              ) : null}
            </label>
            {!isJuniorHighSchool ? (
              <div className="flex flex-col">
                <div className="flex min-h-5 items-center justify-between gap-3">
                  <FormFieldLabel
                    htmlFor={courseFieldId}
                    required
                    className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500"
                  >
                    {isSeniorHighSchool ? "Academic / TVL Strand" : "Current / Intended Course"}
                  </FormFieldLabel>
                  {courseSelectValue === "__OTHER__" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setCourse("");
                        setIsManualCourse(false);
                        markFieldValid("course");
                      }}
                      className="shrink-0 text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                    >
                      Choose a preset
                    </button>
                  ) : null}
                </div>
                {courseSelectValue === "__OTHER__" ? (
                  <input
                    id={courseFieldId}
                    ref={manualCourseInputRef}
                    autoFocus
                    data-required="scholarship"
                    required
                    aria-required="true"
                    aria-invalid={invalidFields.has("course")}
                    value={course}
                    onChange={(event) => {
                      setCourse(event.target.value);
                      setIsManualCourse(true);
                      markFieldValid("course");
                    }}
                    placeholder="Enter full official course or strand name"
                    className={`mt-1 w-full min-w-0 rounded-xl border px-3 py-2 text-sm text-slate-900 ${invalidFields.has("course") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                  />
                ) : (
                  <div className="relative mt-1">
                    <select
                      id={courseFieldId}
                      data-required="scholarship"
                      required
                      aria-required="true"
                      aria-invalid={invalidFields.has("course")}
                      value={courseSelectValue}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        if (value === "__OTHER__") {
                          setCourse("");
                          setIsManualCourse(true);
                        } else {
                          setCourse(value);
                          setIsManualCourse(false);
                        }
                        markFieldValid("course");
                      }}
                      className={`w-full appearance-none rounded-xl border py-2 pl-3 pr-10 text-sm text-slate-900 ${invalidFields.has("course") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                    >
                      <option value="">Select a course or track</option>
                      {coursePresetGroups.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.options.map((option) => (
                            <option key={option} value={option}>{option}</option>
                          ))}
                        </optgroup>
                      ))}
                      <option value="__OTHER__">Other — Enter course/strand manually</option>
                    </select>
                    <ChevronDown
                      className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                      aria-hidden="true"
                    />
                  </div>
                )}
              </div>
            ) : (
              <label className="flex flex-col">
                <FormFieldLabel required className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Current / Intended Course
                </FormFieldLabel>
                <input
                  data-required="scholarship"
                  readOnly
                  value={course || "General Secondary Curriculum"}
                  className="mt-1 w-full min-w-0 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                />
                <span className="mt-1 text-xs text-slate-500">
                  Standard Junior High School curriculum.
                </span>
              </label>
            )}
            <label className="flex flex-col">
              <FormFieldLabel required className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Year level</FormFieldLabel>
              <div className="relative mt-1">
                <select
                  data-required="scholarship"
                  required
                  aria-required="true"
                  value={yearLevel}
                  disabled={!educationLevel}
                  onChange={(event) => {
                    const value = event.currentTarget.value;
                    onYearLevelChange(value);
                    if (value.trim()) markFieldValid("yearLevel");
                  }}
                  aria-invalid={invalidFields.has("yearLevel")}
                  className={`w-full appearance-none rounded-xl border py-2 pl-3 pr-10 text-sm text-slate-900 ${invalidFields.has("yearLevel") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                >
                  <option value="">{educationLevel ? "Select year level" : "Select education level first"}</option>
                  {yearLevels.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500"
                  aria-hidden="true"
                />
              </div>
            </label>
          </div>

          <div className="mt-4 grid gap-3">
            <div>
              <h4 className="text-sm font-semibold">FAMILY BACKGROUND</h4>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <FormFieldLabel required className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Father&apos;s Name</FormFieldLabel>
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
              <OccupationCombobox
                label="Father's occupation"
                value={fathersOccupation}
                onChange={(value) => {
                  setFathersOccupation(value);
                  markFieldValid("fathersOccupation");
                }}
                onValid={() => markFieldValid("fathersOccupation")}
                invalid={invalidFields.has("fathersOccupation")}
                error={validationErrors.fathersOccupation}
                required
                dataRequired="scholarship"
                disabled={fathersContact === "N/A"}
              />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="flex flex-col">
                <FormFieldLabel required className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Father&apos;s contact</FormFieldLabel>
                <input
                  data-required="scholarship"
                  required
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={fathersContact}
                  disabled={fathersContact === "N/A"}
                  onChange={(e) => {
                    setFathersContact(e.target.value.replace(/\D/g, ""));
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
                      const notApplicable = e.target.checked;
                      setFathersContact(notApplicable ? "N/A" : "");
                      setFathersOccupation((current) => {
                        if (notApplicable) return current.trim() ? current : "N/A";
                        return current === "N/A" ? "" : current;
                      });
                      markFieldValid("fathersContact");
                      if (e.target.checked) markFieldValid("fathersOccupation");
                    }}
                    className="rounded border-slate-300"
                  />
                  Not applicable (single-parent household)
                </label>
              </label>
              <label className="flex flex-col">
                <FormFieldLabel required className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mother&apos;s maiden name</FormFieldLabel>
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
              <OccupationCombobox
                label="Mother's occupation"
                value={mothersOccupation}
                onChange={(value) => {
                  setMothersOccupation(value);
                  markFieldValid("mothersOccupation");
                }}
                onValid={() => markFieldValid("mothersOccupation")}
                invalid={invalidFields.has("mothersOccupation")}
                error={validationErrors.mothersOccupation}
                required
                dataRequired="scholarship"
                disabled={mothersContact === "N/A"}
              />
              <label className="flex flex-col">
                <FormFieldLabel required className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Mother&apos;s contact</FormFieldLabel>
                <input
                  data-required="scholarship"
                  required
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={mothersContact}
                  disabled={mothersContact === "N/A"}
                  onChange={(e) => {
                    setMothersContact(e.target.value.replace(/\D/g, ""));
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
                      const notApplicable = e.target.checked;
                      setMothersContact(notApplicable ? "N/A" : "");
                      setMothersOccupation((current) => {
                        if (notApplicable) return current.trim() ? current : "N/A";
                        return current === "N/A" ? "" : current;
                      });
                      markFieldValid("mothersContact");
                      if (e.target.checked) markFieldValid("mothersOccupation");
                    }}
                    className="rounded border-slate-300"
                  />
                  Not applicable (single-parent household)
                </label>
              </label>
            </div>
            <div className="mt-3">
              <label className="flex flex-col">
                <FormFieldLabel required className="text-sm font-semibold">Total Family Monthly Income</FormFieldLabel>
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
            <div className="mt-3">
              <label className="flex flex-col">
                <FormFieldLabel required className="text-sm font-semibold">Number of Household Dependents</FormFieldLabel>
                <input
                  type="number"
                  min={0}
                  step={1}
                  required
                  value={numberOfDependents}
                  onChange={(event) => {
                    setNumberOfDependents(event.target.value);
                    markFieldValid("numberOfDependents");
                  }}
                  aria-invalid={invalidFields.has("numberOfDependents")}
                  className={`mt-1 rounded-xl border px-3 py-2 text-slate-900 ${invalidFields.has("numberOfDependents") ? "border-rose-300 bg-rose-50/30 ring-2 ring-rose-100" : "border-slate-300 bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100"}`}
                />
                {validationErrors.numberOfDependents ? (
                  <span className="mt-1 text-xs text-rose-600" role="alert">{validationErrors.numberOfDependents}</span>
                ) : null}
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
                <SchoolCombobox
                  label="Elementary"
                  placeholder="Select or type elementary school"
                  value={elementarySchool}
                  onChange={setElementarySchool}
                  onClear={() => setElementaryYearGraduated("")}
                  groups={SKEAP_SCHOOL_PRESETS.ELEMENTARY}
                  onValid={() => markFieldValid("elementarySchool")}
                />
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
                <SchoolCombobox
                  label="High School"
                  placeholder="Select or type high school"
                  value={highSchool}
                  onChange={setHighSchool}
                  onClear={() => setHighSchoolYearGraduated("")}
                  groups={SKEAP_SCHOOL_PRESETS.HIGH_SCHOOL}
                  onValid={() => markFieldValid("highSchool")}
                />
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
                <SchoolCombobox
                  label="College"
                  placeholder="Select or type college"
                  value={college}
                  onChange={setCollege}
                  onClear={() => setCollegeYearGraduated("")}
                  groups={SKEAP_SCHOOL_PRESETS.COLLEGE}
                  onValid={() => markFieldValid("college")}
                />
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
                <SchoolCombobox
                  label="Vocational"
                  placeholder="Select or type vocational school"
                  value={vocational}
                  onChange={setVocational}
                  onClear={() => setVocationalYearGraduated("")}
                  groups={SKEAP_SCHOOL_PRESETS.VOCATIONAL}
                  onValid={() => markFieldValid("vocational")}
                />
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
          {hasPriorRevocation ? (
            <div
              role="note"
              className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm leading-6 text-amber-900"
            >
              <span className="font-semibold">Reapplication Cycle:</span> Static identity records from your KK Profile remain linked, but you must upload newly issued documents (Certificate of Low-Income, current Certificate of Enrollment, latest Grades/Form 138, and Barangay Pico Voter&apos;s Certificate) for fresh screening and physical CTC verification.
            </div>
          ) : null}
          <section aria-labelledby="verified-identity-documents-title" className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-5">
            <h3 id="verified-identity-documents-title" className="text-base font-bold text-slate-900">
              Section A — Already on File via KK Profile (No Upload Needed)
            </h3>
            <p className="mt-1 text-xs text-slate-600">
              These Section 5 records are verified digitally or generated from your application. No re-upload is needed.
            </p>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2">
              {[
                { label: "Official SKEAP Application Form", detail: "Auto-generated" },
                { label: '2"×2" Latest I.D. Picture', detail: "Attached from KK Profile" },
                { label: "Birth Certificate", detail: "Verified in KK Profile" },
                { label: "Certificate of Residency", detail: "Verified in KK Profile" },
              ].map(({ label, detail }) => (
                <li key={label} className="flex items-start gap-2 rounded-lg border border-emerald-100 bg-white/80 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <FormFieldLabel required className="block text-xs font-semibold text-slate-800">{label}</FormFieldLabel>
                    <span className="mt-0.5 block text-[11px] text-slate-500">{detail}</span>
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                    On File (KK Profile)
                  </span>
                </li>
              ))}
            </ul>
            {loadingIdentityDocuments ? (
              <p role="status" className="mt-4 text-sm text-slate-600">Loading your verified identity documents…</p>
            ) : identityDocumentsError ? (
              <p role="alert" className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                {identityDocumentsError}
              </p>
            ) : identityDocuments ? (
              <div className="mt-4 grid gap-3 border-t border-emerald-200 pt-4 sm:grid-cols-2">
                <UpdatablePhotoDocumentCard
                  label="2x2 ID Picture"
                  href={identityDocuments.photo}
                  onUpdate={updateProfilePhoto}
                  isUploading={updatingPhoto}
                />
                <VerifiedIdentityDocumentCard label="Birth Certificate" links={[{ label: "View document", href: identityDocuments.birthCertificate }]} />
                <VerifiedIdentityDocumentCard
                  label="Valid ID (Front & Back)"
                  links={[
                    { label: "Front", href: identityDocuments.validIdFront },
                    { label: "Back", href: identityDocuments.validIdBack },
                  ]}
                />
                <VerifiedIdentityDocumentCard label="Certificate of Residency" links={[{ label: "View document", href: identityDocuments.residency }]} />
              </div>
            ) : null}
          </section>

          <section aria-labelledby="skeap-required-uploads-title">
          <h3 id="skeap-required-uploads-title" className="mb-3 text-base font-bold text-slate-900">
            Section B — Required Digital Uploads for SKEAP
          </h3>

          <div className="grid gap-3">
            {requiredDocuments.map((requiredDocument) => {
              const { key, label, helperText } = requiredDocument;
              const inputId = `file-input-${key}`;
              const matchingFile = findUploadFileForKey(files, key);
              const isNameVerificationDocument =
                key === SKEAP_UPLOAD_KEY.FAMILY_INCOME ||
                key === SKEAP_UPLOAD_KEY.ENROLLMENT_CERT ||
                key === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE;
              const isReady = matchingFile?.status === "done" && Boolean(matchingFile.url);
              const ocrNameStatus = isReady && isNameVerificationDocument
                ? key === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
                  ? getVoterCertificateNameVerification(matchingFile)?.status ?? matchingFile?.ocrNameStatus
                  : matchingFile?.ocrNameStatus
                : undefined;
              const matchingFileUrl = matchingFile?.status === "done" ? matchingFile.url : undefined;
              const statusLabel = matchingFile?.status === "error"
                ? matchingFile.manualReviewAvailable ? "UNVERIFIED" : "Try again"
                : matchingFile?.status === "validating"
                ? "Checking document"
                : matchingFile?.status === "uploading"
                ? "Uploading"
                : matchingFile?.status === "done"
                ? "Uploaded"
                : matchingFile?.status === "queued"
                ? "Queued"
                : "Pending";
              const statusBadgeClass = matchingFile?.status === "error"
                ? matchingFile.manualReviewAvailable
                  ? "border border-slate-200 bg-slate-100 text-slate-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
                : matchingFile?.status === "validating"
                ? "border-amber-200 bg-amber-50 text-amber-700"
                : matchingFile?.status === "uploading"
                ? "border-sky-200 bg-sky-50 text-sky-700"
                : matchingFile?.status === "done"
                ? "border-slate-200 bg-slate-100 text-slate-600"
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
                  className={`flex flex-col gap-2 overflow-hidden rounded-2xl border p-4 ${invalidFields.has(key) ? "border-rose-300 bg-rose-50/30 text-slate-900" : "border-slate-200 bg-white"}`}
                >
                  <div>
                        <div className="flex items-center justify-between">
                          <h4 className="min-w-0 truncate text-sm font-semibold text-slate-900">
                            <FormFieldLabel required>{label}</FormFieldLabel>
                          </h4>
                      {!isReady ? (
                        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${statusLabel === "UNVERIFIED" ? "border border-slate-200 bg-slate-100 text-slate-700" : `border ${statusBadgeClass}`}`}>
                          {statusLabel}
                        </span>
                      ) : null}
                    </div>
                    {helperText ? (
                      <p className="mt-1 text-xs leading-relaxed text-slate-600">{helperText}</p>
                    ) : null}
                    <p className="mt-0.5 text-xs text-slate-500">
                      Supports PDF, JPG/JFIF, PNG, and WebP (Max 4MB). Images over 1.5MB are compressed automatically before upload.
                    </p>
                  </div>

                  <input
                    id={inputId}
                    name={key}
                    type="file"
                    aria-required="true"
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
                    <div className="my-1 flex min-w-0 items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        {isPreviewableImage(matchingFile) && matchingFile.previewUrl && !matchingFile.previewFailed ? (
                          <img
                            src={matchingFile.previewUrl}
                            alt=""
                            onError={() => setFiles((prev) => prev.map((file) =>
                              file.id === matchingFile.id ? { ...file, previewFailed: true } : file
                            ))}
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
                            {matchingFileUrl || matchingFile.previewUrl ? (
                              <a
                                href={matchingFileUrl || matchingFile.previewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-7 w-7 items-center justify-center rounded-md text-cyan-700 transition-colors hover:bg-cyan-50"
                                aria-label={`View ${matchingFile.name} in a new tab`}
                                title={`Preview ${matchingFile.name}`}
                              >
                                <Eye className="h-4 w-4" aria-hidden="true" />
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
                      <span className="rounded-lg border border-slate-300 bg-white px-4 py-1.5 text-xs font-semibold shadow-sm transition-all duration-150 hover:bg-slate-50 active:scale-95 active:bg-slate-100 active:shadow-inner">
                        Browse
                      </span>
                    </label>
                  )}
                  {matchingFile?.status === "uploading" ? (
                    <div className="mt-2 flex min-w-0 items-center gap-2 text-xs text-sky-700" role="status">
                      <LoaderCircle className="h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                      <span className="shrink-0">
                        {matchingFile.progress >= 100
                          ? "Finishing upload..."
                          : "Uploading your file..."}
                      </span>
                      <div className="h-1.5 min-w-8 max-w-24 flex-1 animate-pulse rounded-full bg-sky-200" aria-hidden="true" />
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
                  {matchingFile?.status === "validating" ? (
                    <div className="mt-2 flex items-center gap-2 text-xs text-amber-700" role="status">
                      <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                      <span>Checking that this is the correct document...</span>
                      <div className="h-1.5 min-w-8 max-w-24 flex-1 animate-pulse rounded-full bg-amber-200" aria-hidden="true" />
                    </div>
                  ) : null}
                  {matchingFile?.error ? (
                    <div>
                      {matchingFile.manualReviewAvailable ? (
                        <div className="mt-2 -mx-4 -mb-4 flex items-center justify-between gap-4 border-t border-amber-200/80 bg-amber-50/70 px-4 py-3 rounded-b-[inherit]" role="alert">
                          <div className="flex min-w-0 items-center gap-2">
                            <TriangleAlert className="h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
                            <p className="text-xs leading-snug text-amber-900">
                              {matchingFile.error.replace(/^Document not verified\.\s*/, "")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => void continueUploadForManualReview(matchingFile)}
                            className="shrink-0 whitespace-nowrap rounded border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-900 shadow-sm transition-colors hover:bg-amber-100"
                          >
                            Continue for manual review
                          </button>
                        </div>
                      ) : (
                        <div className="mt-2" role="alert">
                          <p className="text-sm text-rose-700">{matchingFile.error}</p>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {ocrNameStatus === "MATCHED_APPLICANT" ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-medium text-emerald-800" role="status">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {key === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
                        ? "Verified: Applicant name matched the voter certificate"
                        : "Verified: Applicant name and document details matched"}
                    </p>
                  ) : null}
                  {ocrNameStatus === "MATCHED_PARENT" && (
                    key === SKEAP_UPLOAD_KEY.FAMILY_INCOME ||
                    key === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
                  ) ? (
                    <p className={`mt-3 inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium ${key === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE ? "border border-emerald-200 bg-emerald-50 text-emerald-800" : "border border-amber-200 bg-amber-50/80 text-amber-900"}`} role="status">
                      {key === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE ? (
                        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      ) : null}
                      {key === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
                        ? "Verified: Parent/Guardian voter certificate matched"
                        : "Parent name matched — admins will cross-check against your Family Background"}
                    </p>
                  ) : null}
                  {ocrNameStatus === "FOR_VERIFICATION" ||
                  (key === SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE && ocrNameStatus === "NAME_MISMATCH") ? (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-900" role="status">
                      <span className="font-semibold">For Verification.</span>{" "}
                      {matchingFile?.ocrNameMessage ||
                        (isMinorApplicant
                          ? "Uploaded for SK Admin verification of parent/guardian relationship."
                          : "Uploaded for SK Admin verification of applicant name.")}
                    </p>
                  ) : null}
                  {ocrNameStatus === "LOW_READABILITY" ? (
                    <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-900" role="status">
                      Low text clarity — ensure the scan is readable or admins will verify manually
                    </p>
                  ) : null}
                  {ocrNameStatus === "NAME_MISMATCH" && key !== SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE ? (
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-3 py-2.5" role="alert">
                      <p className="min-w-0 flex-1 text-xs leading-relaxed text-rose-800">
                        Name Mismatch: This document does not appear to match {applicantDisplayName || "the applicant"}. Please verify you uploaded the right file.
                      </p>
                      <label
                        htmlFor={inputId}
                        className="shrink-0 cursor-pointer rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100"
                      >
                        Replace File
                      </label>
                    </div>
                  ) : null}
                  {isReady ? (
                    !isNameVerificationDocument ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700" role="status">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      {matchingFile.manualReview
                        ? "Uploaded for administrator review"
                        : "Document verified and uploaded successfully"}
                    </p>
                    ) : !ocrNameStatus ? (
                      <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-medium text-amber-900" role="status">
                        Uploaded; administrators will verify the document name.
                      </p>
                    ) : null
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
          </section>

          <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-900">
            Documents marked &apos;On File&apos; are already verified digitally from your KK Profile. Please bring physical originals/Certified True Copies (CTCs) of all Section 5 documents to Barangay Pico Hall once pre-qualified.
          </p>

        </div>
      ) : null}

      {/* validation messages removed per request */}

      {footerActionsTarget ? createPortal(
        <div className="flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0 || submitting}
            className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:border-slate-400 hover:bg-slate-50 hover:text-slate-900 hover:shadow-md active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
          >
            Back
          </button>
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              onClick={goNext}
              disabled={submitting || (step === 0 && isVotingAge && registeredVoter === false)}
              className="rounded-lg bg-[#0F3D5C] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-[#0a2f47] hover:shadow-md active:translate-y-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 motion-reduce:transition-none"
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

function VerifiedIdentityDocumentCard({
  label,
  links,
}: {
  label: string;
  links: Array<{ label: string; href: string }>;
}) {
  return (
    <article className="rounded-xl border border-emerald-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <div className="min-w-0">
          <h4 className="text-sm font-semibold text-slate-900">
            <FormFieldLabel required>{label}</FormFieldLabel>
          </h4>
          <p className="mt-1 text-xs text-emerald-700">Attached securely from your KK Profile</p>
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {links.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-semibold text-[#0F3D5C] underline"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </article>
  );
}

function UpdatablePhotoDocumentCard({
  label,
  href,
  onUpdate,
  isUploading,
}: {
  label: string;
  href: string;
  onUpdate: (file: File) => Promise<void>;
  isUploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(file: File | null) {
    setError(null);
    if (!file) return;
    const fileType = file.type.toLowerCase();
    const isSupportedPhoto =
      ["image/jpeg", "image/png", "image/jfif", "image/webp"].includes(fileType) ||
      /\.(jpe?g|jfif|png|webp)$/i.test(file.name);
    if (!isSupportedPhoto) {
      setError("Choose a JPG, JFIF, PNG, or WebP image.");
      return;
    }
    if (file.size === 0) {
      setError("The selected photo is empty.");
      return;
    }
    try {
      await onUpdate(file);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to update your photo.");
    }
  }

  return (
    <article className="rounded-xl border border-emerald-200 bg-white p-3">
      <div className="flex items-start gap-2">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-semibold text-slate-900">
            <FormFieldLabel required>{label}</FormFieldLabel>
          </h4>
          <p className="mt-1 text-xs text-emerald-700">Attached securely from your KK Profile</p>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex text-xs font-semibold text-[#0F3D5C] underline"
          >
            View current photo
          </a>
          <p className="mt-2 text-xs text-slate-600">
            Ensure this is your latest photo. Click to update if needed.
          </p>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/jfif,.jpg,.jpeg,.jfif,.png,image/png,image/webp,.webp"
            className="hidden"
            aria-label="Upload a new 2x2 ID picture"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0] ?? null;
              event.currentTarget.value = "";
              void handleFileChange(file);
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="mt-3 inline-flex items-center rounded-lg border border-[#0F3D5C] px-3 py-1.5 text-xs font-semibold text-[#0F3D5C] transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60"
          >
            {isUploading ? "Updating photo…" : "Update Photo"}
          </button>
          {error ? <p role="alert" className="mt-2 text-xs text-rose-700">{error}</p> : null}
        </div>
      </div>
    </article>
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
      <FormFieldLabel required={required} className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </FormFieldLabel>
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
  ensureSkeapUploadWithinLimit(file);
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
      const payloadTooLarge =
        xhr.status === 413 || /FUNCTION_PAYLOAD_TOO_LARGE/i.test(responseText);
      if (payloadTooLarge) {
        reject(new Error(SKEAP_UPLOAD_TOO_LARGE_MESSAGE));
        return;
      }

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
        if (xhr.status >= 500 || /FUNCTION_[A-Z_]+|(?:sin|iad|cle)\d+::/i.test(responseText)) {
          reject(new Error("The upload service could not complete the request. Please try again."));
          return;
        }
        const serverError = typeof body?.error === "string" ? body.error.trim() : "";
        const details = serverError || xhr.statusText || "No error details were returned.";
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
