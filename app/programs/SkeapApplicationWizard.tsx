"use client";

import { useEffect, useMemo, useState } from "react";
import { Eye } from "lucide-react";

type KKProfile = {
  fullName: string;
  email: string;
  contactNumber: string;
  purok: string;
  addressLine: string;
  barangay: string;
  birthDate: string;
  age: number;
  civilStatus?: string;
};

type UploadedFile = {
  id: string;
  name: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "error";
  url?: string;
  error?: string;
  requirement?: string;
};

const STEPS = ["Profile", "Scholarship", "Educational Background", "Uploads"] as const;

export default function SkeapApplicationWizard({ onClose, requirements }: { onClose: () => void; requirements?: string[] }) {
  const [step, setStep] = useState(0);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profile, setProfile] = useState<KKProfile | null>(null);

  const [course, setCourse] = useState("");
  const [yearLevel, setYearLevel] = useState("");
  const [gwa, setGwa] = useState("");

  // Grades input - list of subjects and numeric grades. GWA is computed from these.
  const [grades, setGrades] = useState<{ id: string; subject: string; grade: string }[]>(() => [
    { id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, subject: "", grade: "" },
  ]);
  const computedGwa = useMemo(() => {
    const nums = grades.map((g) => parseFloat(g.grade)).filter((n) => !Number.isNaN(n));
    if (nums.length === 0) return "";
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
    return String(Math.round(avg * 100) / 100);
  }, [grades]);

  // Course timeline (semesters per year) for progress tracking
  const [timelineYears, setTimelineYears] = useState<number>(4);
  const [timelineSemestersPerYear, setTimelineSemestersPerYear] = useState<number[]>([2, 2, 2, 2]);
  const [timelineLabels, setTimelineLabels] = useState<string[]>(() => Array.from({ length: 4 }).map((_, i) => `Year ${i + 1}`));
  

  function addGradeRow() {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setGrades((p) => [...p, { id, subject: "", grade: "" }]);
  }

  function updateGrade(id: string, field: "subject" | "grade", value: string) {
    setGrades((p) => p.map((g) => (g.id === id ? { ...g, [field]: value } : g)));
  }

  function removeGrade(id: string) {
    setGrades((p) => {
      if (p.length <= 1) return p; // keep at least one row
      return p.filter((g) => g.id !== id);
    });
  }

  function applyPreset(val: string) {
    if (val === "4-2-2-2-2") {
      setTimelineYears(4);
      setTimelineSemestersPerYear([2, 2, 2, 2]);
      setTimelineLabels(Array.from({ length: 4 }).map((_, i) => `Year ${i + 1}`));
    } else if (val === "4-2-3-3-2") {
      // KCP IT example: 2,3,3,2
      setTimelineYears(4);
      setTimelineSemestersPerYear([2, 3, 3, 2]);
      setTimelineLabels(Array.from({ length: 4 }).map((_, i) => `Year ${i + 1}`));
    } else if (val === "5-2-2-2-2-2") {
      setTimelineYears(5);
      setTimelineSemestersPerYear([2, 2, 2, 2, 2]);
      setTimelineLabels(Array.from({ length: 5 }).map((_, i) => `Year ${i + 1}`));
    } else if (val === "custom") {
      setTimelineYears((y) => y || 4);
      setTimelineSemestersPerYear((s) => (s.length ? s : Array.from({ length: timelineYears }).map(() => 2)));
      setTimelineLabels((s) => (s.length ? s : Array.from({ length: timelineYears }).map((_, i) => `Year ${i + 1}`)));
    }
  }

  function updateSemesters(yearIndex: number, sems: number) {
    setTimelineSemestersPerYear((prev) => {
      const copy = [...prev];
      copy[yearIndex] = sems;
      return copy;
    });
  }

  function addYear() {
    setTimelineSemestersPerYear((prev) => [...prev, 2]);
    setTimelineYears((y) => {
      const next = y + 1;
      setTimelineLabels((labels) => [...labels, `Year ${next}`]);
      return next;
    });
  }

  function removeYear(yearIndex: number) {
    setTimelineSemestersPerYear((prev) => prev.filter((_, i) => i !== yearIndex));
    setTimelineYears((y) => {
      const next = Math.max(0, y - 1);
      setTimelineLabels((labels) => labels.filter((_, i) => i !== yearIndex));
      return next;
    });
  }

  function updateLabel(index: number, value: string) {
    setTimelineLabels((prev) => prev.map((l, i) => (i === index ? value : l)));
  }

  

  // Full SKEAP form fields (mirror DOCX)
  const [lastName, setLastName] = useState("");
  const [firstName, setFirstName] = useState("");
  const [middleInitial, setMiddleInitial] = useState("");
  const [schoolName, setSchoolName] = useState("");
  const [applicantName, setApplicantName] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [placeOfBirth, setPlaceOfBirth] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [age, setAge] = useState("");
  const [civilStatus, setCivilStatus] = useState("");
  const [fathersName, setFathersName] = useState("");
  const [fathersOccupation, setFathersOccupation] = useState("");
  const [fathersContact, setFathersContact] = useState("");
  const [mothersMaidenName, setMothersMaidenName] = useState("");
  const [mothersOccupation, setMothersOccupation] = useState("");
  const [mothersContact, setMothersContact] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [registeredVoter, setRegisteredVoter] = useState<boolean | null>(null);
  const [totalFamilyMonthlyIncome, setTotalFamilyMonthlyIncome] = useState("");

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
  const [submittedId, setSubmittedId] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch("/api/my/kk-profile", { cache: "no-store" })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(body?.error || "Unable to load KK profile");
        }
        return body.profile as KKProfile;
      })
      .then((data) => {
        if (!mounted) return;
        setProfile(data);
        setProfileError(null);
        // auto-fill matching SKEAP fields from KK profile
        try {
          if (data) {
            const fullName = data.fullName?.trim() || "";
            let parsedLast = "";
            let parsedFirst = "";
            let parsedMiddle = "";
            if (fullName.includes(",")) {
              const [last, rest] = fullName.split(",", 2).map((part) => part.trim());
              parsedLast = last;
              const tokens = rest.split(/\s+/).filter(Boolean);
              parsedFirst = tokens.shift() || "";
              parsedMiddle = tokens.join(" ");
            } else {
              const tokens = fullName.split(/\s+/).filter(Boolean);
              if (tokens.length === 1) {
                parsedFirst = tokens[0];
              } else if (tokens.length === 2) {
                parsedFirst = tokens[0];
                parsedLast = tokens[1];
              } else {
                parsedFirst = tokens[0];
                parsedMiddle = tokens.slice(1, -1).join(" ");
                parsedLast = tokens[tokens.length - 1];
              }
            }
            setLastName(parsedLast);
            setFirstName(parsedFirst);
            setMiddleInitial(parsedMiddle);
            setApplicantName(`${parsedLast}${parsedFirst ? `, ${parsedFirst}` : ""}${parsedMiddle ? ` ${parsedMiddle}` : ""}`);
            setPermanentAddress(`${data.purok || ""}${data.addressLine ? ", " + data.addressLine : ""}${data.barangay ? ", " + data.barangay : ""}`);
            setSchoolName("");
            setDateOfBirth(data.birthDate ? new Date(data.birthDate).toISOString().slice(0,10) : "");
            setAge(data.age ? String(data.age) : "");
            setCivilStatus(data.civilStatus || "");
            setPlaceOfBirth("");
            setFathersName("");
            setFathersOccupation("");
            setFathersContact("");
            setMothersMaidenName("");
            setMothersOccupation("");
            setMothersContact("");
            setRegisteredVoter(null);
            setGwa("");
            setContactNumber(data.contactNumber || "");
            setEmailAddress(data.email || "");
          }
        } catch (e) {
          // ignore
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setProfileError(err instanceof Error ? err.message : "Unable to load KK profile");
      })
      .finally(() => {
        if (mounted) setLoadingProfile(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const enrollmentFileUrl = useMemo(() => {
    const byRequirement = files.find((f) => f.status === "done" && f.requirement && f.requirement.toLowerCase().includes("enroll"));
    if (byRequirement) return byRequirement.url;
    const byName = files.find((f) => f.status === "done" && f.name.toLowerCase().includes("enroll"));
    if (byName) return byName.url;
    return files.find((f) => f.status === "done")?.url;
  }, [files]);

  const photoFileRecord = useMemo(
    () =>
      files.find(
        (f) =>
          f.status === "done" &&
          f.url &&
          (f.requirement?.toLowerCase().includes("2x2") || /2x2|photo|id photo/i.test(f.name))
      ),
    [files]
  );

  const photoFileUrl = photoFileRecord?.url;

  const reportCardFileUrl = useMemo(() => {
    const byRequirement = files.find((f) => f.status === "done" && f.requirement && /(grade|transcript|report)/i.test(f.requirement));
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
      if (!contactNumber.trim()) return "Contact number is required.";
      if (!emailAddress.trim()) return "Email address is required.";
      if (!photoFileUrl) return "Please upload a 2x2 photo (ID).";
      if (registeredVoter === null) return "Please indicate Registered Voter (Yes/No).";
      if (registeredVoter === true && Number(age) >= 18) {
        const hasVoter = files.find((f) => f.status === "done" && f.requirement === "voter_certificate");
        if (!hasVoter) return "Please upload a photocopy of the voter's certificate.";
      }
    }
    if (step === 1) {
      if (!course.trim()) return "Course is required.";
      if (!yearLevel.trim()) return "Year level is required.";
      if (grades.length === 0) return "Please add at least one subject grade.";
      const parsed = Number(computedGwa);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 100) return "Computed GWA must be between 0 and 100.";
      if (!fathersName.trim()) return "Father's name is required.";
      if (!fathersContact.trim()) return "Father's contact is required.";
      if (!mothersMaidenName.trim()) return "Mother's maiden name is required.";
      if (!mothersOccupation.trim()) return "Mother's occupation is required.";
      if (!mothersContact.trim()) return "Mother's contact is required.";
      if (!totalFamilyMonthlyIncome.trim()) return "Total family monthly income is required.";
    }
    if (step === 3) {
      // If requirements provided, require Enrollment and Grade/Report files specifically
      if (requirements && requirements.length > 0) {
        const needEnroll = requirements.find((r) => /enroll/i.test(r));
        const needGrade = requirements.find((r) => /(grade|transcript|report)/i.test(r));
        const hasEnroll = Boolean(
          files.find((f) => f.status === "done" && ((f.requirement && /enroll/i.test(f.requirement)) || (f.name && /enroll/i.test(f.name))))
        );
        const hasGrade = Boolean(
          files.find((f) => f.status === "done" && ((f.requirement && /(grade|transcript|report)/i.test(f.requirement)) || (f.name && /(grade|transcript|report)/i.test(f.name))))
        );
        if (needEnroll && !hasEnroll) return "Please upload the Certificate of Enrollment file.";
        if (needGrade && !hasGrade) return "Please upload the latest grade report file.";
      } else {
        const done = files.filter((f) => f.status === "done");
        if (done.length < 2) return "Upload at least 2 files (Enrollment and Report Card).";
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
      if (!contactNumber.trim()) missing.push("contactNumber");
      if (!emailAddress.trim()) missing.push("emailAddress");
      if (!photoFileUrl) missing.push("photoFile");
      if (registeredVoter === null) missing.push("registeredVoter");
      if (registeredVoter === true && Number(age) >= 18) {
        const hasVoter = files.find((f) => f.status === "done" && f.requirement === "voter_certificate");
        if (!hasVoter) missing.push("voter_certificate");
      }
    }
    if (currentStep === 1) {
      if (!course.trim()) missing.push("course");
      if (!yearLevel.trim()) missing.push("yearLevel");
      if (grades.length === 0) missing.push("grades");
      if (!fathersName.trim()) missing.push("fathersName");
      if (!fathersContact.trim()) missing.push("fathersContact");
      if (!mothersMaidenName.trim()) missing.push("mothersMaidenName");
      if (!mothersOccupation.trim()) missing.push("mothersOccupation");
      if (!mothersContact.trim()) missing.push("mothersContact");
      if (!totalFamilyMonthlyIncome.trim()) missing.push("totalFamilyMonthlyIncome");
    }
    if (missing.length) markFieldsInvalid(missing);
  }

  function goNext() {
    const err = validateStep();
    if (err) {
      collectInvalidFieldsForStep(step);
      setMessage(err);
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

  async function onChooseFiles(list: FileList | null, requirement?: string) {
    const filesArray = Array.from(list || []);
    if (filesArray.length === 0) return;

    // Only handle the first file for per-requirement inputs
    const file = filesArray[0];
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // If requirement already has an uploaded entry, remove it (replace)
    setFiles((prev) => prev.filter((f) => !(requirement && f.requirement === requirement)));
    setFiles((prev) => [...prev, { id, name: file.name, progress: 0, status: "queued", requirement }]);

    try {
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "uploading" } : f)));
      const result = await uploadWithProgress(file, (pct) => {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, progress: pct } : f)));
      });
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "done", progress: 100, url: result.url } : f)));
      // mark relevant field as valid after successful upload
      if (requirement) {
        const key = requirement === "voter_certificate" ? "voter_certificate" : /2x2|photo|id/i.test(requirement) ? "photoFile" : requirement;
        markFieldValid(key);
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : "Upload failed";
      setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, status: "error", error: text } : f)));
    }
  }

  async function submitApplication() {
    const err = validateStep();
    if (err) {
      setMessage(err);
      return;
    }

    setSubmitting(true);
    setMessage(null);

    try {
      const doneUrls = files.filter((f) => f.status === "done").map((f) => f.url).filter(Boolean) as string[];
      const res = await fetch("/api/skeap/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentCourse: course,
          yearLevel,
          gwa: computedGwa,
          grades: grades.map((g) => ({ subject: g.subject, grade: g.grade })),
          timeline: {
            years: timelineYears,
            semestersPerYear: timelineSemestersPerYear,
            labels: timelineLabels,
          },
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
          fathersName,
          fathersOccupation,
          fathersContact,
          mothersMaidenName,
          mothersOccupation,
          mothersContact,
          contactNumber,
          emailAddress,
          registeredVoter,
          voterCertificateFileUrl: doneUrls.find((u, idx) => files.findIndex(f => f.requirement === 'voter_certificate' && f.url === u) >= 0) || null,
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
          allUploadedFiles: files.filter(f => f.status === 'done').map(f => ({ requirement: f.requirement, name: f.name, url: f.url }))
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(body?.error || "Failed to submit SKEAP application.");
        return;
      }

      setSubmittedId(String(body.applicationId || ""));
      setMessage("Application submitted successfully.");
    } catch {
      setMessage("Network error while submitting application.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loadingProfile) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading KK profile...</div>;
  }

  if (profileError) {
    return (
      <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
        {profileError}. Complete KK profiling first before applying.
      </div>
    );
  }

  if (submittedId) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
        <p className="text-sm uppercase tracking-[0.2em] text-emerald-700">SKEAP</p>
        <h4 className="mt-2 text-xl font-semibold text-emerald-900">Application Submitted</h4>
        <p className="mt-2 text-sm text-emerald-800">Your application reference is {submittedId}.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <button onClick={onClose} className="rounded-full border border-emerald-300 px-4 py-2 text-sm font-semibold text-emerald-800">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5">
      <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-5 py-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Application Form</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">Complete your SKEAP application form</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          The fields below are the actual application form for SKEAP. Complete each section and upload the required documents to submit your application.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
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

      {message ? (
        <div className="rounded-3xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {message}
        </div>
      ) : null}

      {step === 0 ? (
        <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5">
          <h4 className="text-sm font-semibold">Personal Information</h4>
          <div className="grid gap-4 sm:grid-cols-[1.3fr_1.3fr_0.8fr]">
            <label className="flex flex-col min-w-0">
              <span className="text-sm font-semibold">Last Name</span>
              <input
                value={lastName}
                data-required="profile"
                onChange={(e) => {
                  const value = e.target.value;
                  setLastName(value);
                  setApplicantName(`${value}${firstName ? `, ${firstName}` : ""}${middleInitial ? ` ${middleInitial}` : ""}`);
                  markFieldValid("lastName");
                }}
                className={`mt-1 min-w-0 rounded-xl border px-3 py-2 ${invalidFields.has("lastName") ? "border-rose-600" : "border-slate-300"}`}
              />
            </label>
            <label className="flex flex-col min-w-0">
              <span className="text-sm font-semibold">First Name</span>
              <input
                value={firstName}
                data-required="profile"
                onChange={(e) => {
                  const value = e.target.value;
                  setFirstName(value);
                  setApplicantName(`${lastName}${value ? `, ${value}` : ""}${middleInitial ? ` ${middleInitial}` : ""}`);
                  markFieldValid("firstName");
                }}
                className={`mt-1 min-w-0 rounded-xl border px-3 py-2 ${invalidFields.has("firstName") ? "border-rose-600" : "border-slate-300"}`}
              />
            </label>
            <label className="flex flex-col min-w-0">
              <span className="text-sm font-semibold">M.I.</span>
              <input
                value={middleInitial}
                onChange={(e) => {
                  const value = e.target.value;
                  setMiddleInitial(value);
                  setApplicantName(`${lastName}${firstName ? `, ${firstName}` : ""}${value ? ` ${value}` : ""}`);
                }}
                className="mt-1 min-w-0 rounded-xl border px-3 py-2"
                placeholder="Optional"
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-[1.5fr_minmax(220px,0.85fr)] gap-4">
            <div className="grid gap-4 min-w-0">
              <label className="min-w-0 flex flex-col">
                  <span className="text-sm font-semibold">Permanent Address</span>
                  <input
                    data-required="profile"
                    value={permanentAddress}
                    onChange={(e) => {
                      setPermanentAddress(e.target.value);
                      markFieldValid("permanentAddress");
                    }}
                    className={`mt-1 min-w-0 rounded-xl border px-3 py-2 ${invalidFields.has("permanentAddress") ? "border-rose-600" : "border-slate-300"}`}
                  />
              </label>
              <label className="min-w-0 flex flex-col">
                  <span className="text-sm font-semibold">School / Institution</span>
                  <select
                    data-required="profile"
                    value={schoolName}
                    onChange={(e) => {
                      setSchoolName(e.target.value);
                      markFieldValid("schoolName");
                    }}
                    className={`mt-1 min-w-0 rounded-xl border px-3 py-2 text-slate-700 ${invalidFields.has("schoolName") ? "border-rose-600" : "border-slate-300 bg-white"}`}
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

            <div className="relative row-span-2 h-full min-w-0 flex flex-col justify-between rounded-[1.25rem] border border-slate-200 bg-slate-50 p-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">2x2 Photo (ID)</p>
                <p className="mt-1 text-xs text-slate-500">Upload a 2x2 ID photo for the application.</p>
              </div>

              <div className="mt-3">
                <label className={`relative block w-full rounded-xl border px-3 py-2 text-sm text-slate-700 ${invalidFields.has("photoFile") ? "border-rose-600 bg-white" : "border-slate-300 bg-white"}`}>
                  <span className="sr-only">Upload 2x2 photo</span>
                  <input
                    data-required="profile"
                    type="file"
                    accept="image/*"
                    onChange={(e) => onChooseFiles(e.target.files, "2x2 Photo")}
                    className="absolute inset-0 h-full w-full opacity-0 pointer-events-none"
                  />
                  <div className="relative z-10 flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate text-slate-500">{photoFileRecord?.name ?? "Choose file"}</span>
                    <div className="flex items-center gap-2">
                      {photoFileUrl ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPhotoUrl(photoFileUrl);
                          }}
                          className="relative z-20 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 transition hover:bg-slate-200"
                          aria-label="Preview uploaded 2x2 photo"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      ) : null}
                      {photoFileUrl ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFiles((prev) => prev.filter((file) => file.url !== photoFileUrl));
                          }}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-100"
                          aria-label="Remove 2x2 photo"
                        >
                          ×
                        </button>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-500">Browse</span>
                      )}
                    </div>
                  </div>
                </label>
              </div>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Date of Birth</span>
              <input
                data-required="profile"
                type="date"
                value={dateOfBirth}
                onChange={(e) => {
                  setDateOfBirth(e.target.value);
                  markFieldValid("dateOfBirth");
                }}
                className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("dateOfBirth") ? "border-rose-600" : "border-slate-300"}`}
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
                className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("placeOfBirth") ? "border-rose-600" : "border-slate-300"}`}
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Age</span>
              <input
                data-required="profile"
                type="number"
                min="0"
                value={age}
                onChange={(e) => {
                  setAge(e.target.value);
                  markFieldValid("age");
                }}
                className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("age") ? "border-rose-600" : "border-slate-300"}`}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Civil Status</span>
              <select
                data-required="profile"
                value={civilStatus}
                onChange={(e) => {
                  setCivilStatus(e.target.value);
                  markFieldValid("civilStatus");
                }}
                className={`mt-1 rounded-xl border px-3 py-2 text-slate-700 ${invalidFields.has("civilStatus") ? "border-rose-600" : "border-slate-300"}`}
              >
                <option value="">Select status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Other">Other</option>
              </select>
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Contact Number</span>
              <input
                data-required="profile"
                value={contactNumber}
                onChange={(e) => {
                  setContactNumber(e.target.value);
                  markFieldValid("contactNumber");
                }}
                className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("contactNumber") ? "border-rose-600" : "border-slate-300"}`}
              />
            </label>
            <label className="flex flex-col">
              <span className="text-sm font-semibold">Email Address</span>
              <input
                data-required="profile"
                value={emailAddress}
                onChange={(e) => {
                  setEmailAddress(e.target.value);
                  markFieldValid("emailAddress");
                }}
                className={`mt-1 rounded-xl border px-3 py-2 ${invalidFields.has("emailAddress") ? "border-rose-600" : "border-slate-300"}`}
              />
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4 items-start">
            <div>
              <span className="text-sm font-semibold">Registered Voter</span>
              <div className="mt-2 flex items-center gap-4">
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
              <p className="mt-2 text-xs text-slate-500">*(If yes, please present voter’s certificate and attach a photocopy of voter’s certificate for 18 years old and above only)</p>
            </div>
            <div>
              {/* voter certificate upload shown only when registered and age >= 18 */}
                  {registeredVoter === true && Number(age) >= 18 ? (
                <div>
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
                    {files.find((f) => f.requirement === 'voter_certificate' && f.url) ? (
                      <div className="mt-2 text-xs text-slate-600">Uploaded: <a href={files.find((f) => f.requirement === 'voter_certificate')!.url} target="_blank" rel="noreferrer" className="underline">View file</a></div>
                    ) : null}
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
            <EditableField label="Current course" value={course} onChange={setCourse} placeholder="e.g., BS Information Technology" />
            <label className="flex flex-col">
              <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Year level</span>
              <select
                value={yearLevel}
                onChange={(e) => setYearLevel(e.target.value)}
                className="mt-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
              >
                <option value="">Select year level</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
              </select>
            </label>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Grades</label>
              <p className="text-sm text-slate-500">Add each subject and its numeric grade. GWA is calculated automatically.</p>
              <div className="mt-2 space-y-2">
                {grades.map((g) => (
                  <div key={g.id} className="flex items-center gap-2">
                    <input
                      value={g.subject}
                      onChange={(e) => updateGrade(g.id, "subject", e.target.value)}
                      placeholder="Subject"
                      className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm"
                    />
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={g.grade}
                      onChange={(e) => updateGrade(g.id, "grade", e.target.value)}
                      placeholder="Grade"
                      className="w-28 rounded-xl border px-3 py-2 text-sm flex-shrink-0"
                    />
                    {grades.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeGrade(g.id)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white text-slate-700 flex-shrink-0 ml-1 relative z-10"
                        aria-label="Remove subject"
                      >
                        ×
                      </button>
                    ) : (
                      <div className="w-9" />
                    )}
                  </div>
                ))}

                <div className="flex items-center gap-2">
                  <button type="button" onClick={addGradeRow} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Add subject
                  </button>
                  <div className="ml-auto text-sm text-slate-600">
                    GWA: <span className="font-semibold">{computedGwa || "—"}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Course timeline</label>
              <p className="text-sm text-slate-500">Add each year and select number of semesters. Use Add year to append rows.</p>
              <div className="mt-2 space-y-2">
                {timelineSemestersPerYear.map((sems, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={timelineLabels[i] ?? `Year ${i + 1}`}
                      onChange={(e) => updateLabel(i, e.target.value)}
                      placeholder={`Year ${i + 1}`}
                      className="flex-1 min-w-0 rounded-xl border px-3 py-2 text-sm"
                    />

                    <select
                      value={String(sems)}
                      onChange={(e) => updateSemesters(i, Number(e.target.value) || 1)}
                      className="w-28 rounded-xl border px-3 py-2 text-sm"
                    >
                      <option value="1">1</option>
                      <option value="2">2</option>
                      <option value="3">3</option>
                    </select>

                    {timelineSemestersPerYear.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => removeYear(i)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-full border bg-white text-slate-700 flex-shrink-0 ml-1 relative z-10"
                        aria-label={`Remove year ${i + 1}`}
                      >
                        ×
                      </button>
                    ) : (
                      <div className="w-9" />
                    )}
                  </div>
                ))}

                <div className="mt-2">
                  <button type="button" onClick={addYear} className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                    Add year
                  </button>
                </div>
              </div>
            </div>
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
            {(requirements && requirements.length > 0 ? requirements : ["Certificate of Enrollment", "Latest grade report"]).map((req) => {
              const existing = files.find((f) => f.requirement === req);
              return (
                <div key={req} className="rounded-xl border border-slate-200 px-3 py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{req}</p>
                      <p className="text-xs text-slate-500">Upload one file for this requirement</p>
                    </div>
                    <div className="text-sm text-slate-500">{existing ? (existing.status === "done" ? "Ready" : existing.status === "uploading" ? `Uploading ${existing.progress}%` : existing.status === "error" ? "Failed" : existing.status) : "Not uploaded"}</div>
                  </div>

                  <div className="mt-3">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => onChooseFiles(e.target.files, req)}
                      className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                    />
                    {existing && existing.url ? (
                      <div className="mt-2 text-xs text-slate-600">Uploaded: <a href={existing.url} target="_blank" rel="noreferrer" className="underline">View file</a></div>
                    ) : null}
                  </div>
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

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={step === 0 || submitting}
          className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"
        >
          Back
        </button>

        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={goNext}
            disabled={submitting}
            className="rounded-full bg-[#0F3D5C] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={submitApplication}
            disabled={submitting}
            className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-70"
          >
            {submitting ? "Submitting..." : "Submit application"}
          </button>
        )}
      </div>
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
