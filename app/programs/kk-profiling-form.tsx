"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/browser";
import { OFFICIAL_SITIOS } from "@/lib/kk";

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


export default function KKProfilingForm() {
  const router = useRouter();
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState("Your KK Profiling registration has been completed successfully.");
  const [successRedirectTo, setSuccessRedirectTo] = useState("/programs/skeap-scholarship?openApply=1");
  const [successCredentials, setSuccessCredentials] = useState<{ username: string; temporaryPassword: string } | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [accountExistsFallback, setAccountExistsFallback] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);

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
    const cleaned = value.replace(/[^a-zA-Z]/g, "").slice(0, 1).toUpperCase();
    return cleaned;
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
    if (!form.sitio.trim()) return "Sitio is required";
    if (!form.barangay.trim()) return "Barangay is required";
    if (!form.municipality.trim()) return "Municipality is required";
    if (!form.province.trim()) return "Province is required";
    if (!form.sex) return "Sex is required";
    if (!form.age) return "Age is required";
    if (!form.birthDate) return "Birth date is required";
    if (!form.email.trim()) return "Email is required";
    if (!form.contactNumber.trim()) return "Contact number is required";
    if (!form.consent) return "You must agree to the informed consent";
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

      const payload = {
        ...form,
        fullName,
        address,
      };

      const res = await fetch("/api/programs/kk-profiling/register", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setForm(initialForm);
        setMessage(null);
        setSuccessMessage(
          body?.message ||
            "Your KK Profiling registration was completed successfully. Your SKonnect account was created automatically."
        );
        setSuccessRedirectTo(body?.redirectTo || "/programs/skeap-scholarship?openApply=1");
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
      <form onSubmit={handleSubmit} className="grid gap-4">
        <h3 className="text-xl font-bold text-slate-900">Katipunan ng Kabataan (KK) Profiling — Registration</h3>

      <div className="relative rounded-lg border bg-slate-50 p-4 text-sm text-slate-700">
        <div className="min-w-0 pr-24">
          <strong>Informed Consent</strong>
          <p className="mt-2">The Profiling aims to gather KK member information for the National Youth Commission. Data will be stored and used for database management by the NYC. Participation is voluntary. No monetary compensation will be provided.</p>
        </div>
        <div className="absolute bottom-2 right-2">
          <button type="button" onClick={() => setShowConsentModal(true)} className="text-sm underline text-slate-700 transition duration-200 hover:text-slate-900 hover:bg-slate-100 hover:no-underline rounded-md px-2 py-1">View full consent</button>
        </div>
      </div>


      <h4 className="text-lg font-semibold">PART I: Profile</h4>
      <p className="text-sm text-slate-600">Please ensure the accuracy of your responses by providing truthful and complete information in all required fields.</p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col">
          <span className="text-sm font-semibold">Last Name *</span>
          <input value={form.lastName} onChange={(e) => setField("lastName", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">First Name *</span>
          <input value={form.firstName} onChange={(e) => setField("firstName", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Middle Initial</span>
          <input
            value={form.middleInitial}
            onChange={(e) => setField("middleInitial", normalizedMiddleInitial(e.target.value))}
            maxLength={1}
            className="mt-1 rounded-lg border px-3 py-2 uppercase"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col">
          <span className="text-sm font-semibold">Sitio *</span>
          <select value={form.sitio} onChange={(e) => setField("sitio", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
            <option value="">Select sitio</option>
            {OFFICIAL_SITIOS.map((sitio) => (
              <option key={sitio} value={sitio}>{sitio}</option>
            ))}
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Barangay *</span>
          <input value={form.barangay} readOnly className="mt-1 rounded-lg border bg-slate-100 px-3 py-2" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Municipality *</span>
          <input value={form.municipality} readOnly className="mt-1 rounded-lg border bg-slate-100 px-3 py-2" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Province *</span>
          <input value={form.province} readOnly className="mt-1 rounded-lg border bg-slate-100 px-3 py-2" />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col">
          <span className="text-sm font-semibold">Sex *</span>
          <select value={form.sex} onChange={(e) => setField("sex", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
            <option value="">Select</option>
            <option>Male</option>
            <option>Female</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Age *</span>
          <input
            type="number"
            min={0}
            value={form.age}
            readOnly
            aria-readonly="true"
            className="mt-1 rounded-lg border bg-slate-100 px-3 py-2 text-slate-700"
          />
          <span className="mt-1 text-xs text-slate-500">Age is calculated from Birth Date.</span>
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Birth Date *</span>
          <input
            type="date"
            value={form.birthDate}
            onChange={(e) => setField("birthDate", e.target.value)}
            required
            className="mt-1 rounded-lg border px-3 py-2"
          />
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col">
          <span className="text-sm font-semibold">Email Address *</span>
          <input type="email" value={form.email} onChange={(e) => setField("email", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Facebook Account (Name) *</span>
          <input value={form.facebook} onChange={(e) => setField("facebook", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2" />
        </label>
      </div>

      <label className="flex flex-col">
        <span className="text-sm font-semibold">Contact Number *</span>
        <input value={form.contactNumber} onChange={(e) => setField("contactNumber", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2" />
      </label>

      <h4 className="text-lg font-semibold">PART II: Demographic Characteristics</h4>

      <label className="flex flex-col">
        <span className="text-sm font-semibold">Civil Status *</span>
        <select value={form.civilStatus} onChange={(e) => setField("civilStatus", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
          <option value="">Select</option>
          <option>Single</option>
          <option>Married</option>
          <option>Widowed</option>
          <option>Divorced</option>
          <option>Separated</option>
          <option>Annulled</option>
          <option>Unknown</option>
          <option>Live-in</option>
        </select>
      </label>

      <label className="flex flex-col">
        <span className="text-sm font-semibold">Youth Classification *</span>
        <select value={form.youthClassification} onChange={(e) => setField("youthClassification", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
          <option value="">Select</option>
          <option>In school Youth</option>
          <option>Out of School Youth</option>
          <option>Working Youth</option>
          <option>Person w/ Disability</option>
          <option>Children In Conflict with Law</option>
          <option>Indigenous People</option>
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col">
          <span className="text-sm font-semibold">Youth age Group *</span>
          <select value={form.youthAgeGroup} onChange={(e) => setField("youthAgeGroup", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
            <option value="">Select</option>
            <option>Child Youth (15-17 yrs old)</option>
            <option>Core Youth (18-24 yrs old)</option>
            <option>Young Adult (15-30 yrs old)</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Work Status *</span>
          <select value={form.workStatus} onChange={(e) => setField("workStatus", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
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
        <span className="text-sm font-semibold">Educational Background *</span>
        <select value={form.educationalBackground} onChange={(e) => setField("educationalBackground", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <label className="flex flex-col">
          <span className="text-sm font-semibold">Registered SK Voter? *</span>
          <select value={form.registeredSKVoter} onChange={(e) => setField("registeredSKVoter", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
            <option value="">Select</option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Did you vote last SK election? *</span>
          <select value={form.votedLastSK} onChange={(e) => setField("votedLastSK", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
            <option value="">Select</option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Registered National Voter? *</span>
          <select value={form.registeredNationalVoter} onChange={(e) => setField("registeredNationalVoter", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
            <option value="">Select</option>
            <option>Yes</option>
            <option>No</option>
          </select>
        </label>
      </div>

      <label className="flex flex-col">
        <span className="text-sm font-semibold">Have you already attended a KK Assembly? *</span>
        <select value={form.attendedKKAssembly} onChange={(e) => setField("attendedKKAssembly", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2">
          <option value="">Select</option>
          <option>Yes</option>
          <option>No</option>
        </select>
      </label>

      {form.attendedKKAssembly === "Yes" && (
        <label className="flex flex-col">
          <span className="text-sm font-semibold">If Yes, How many times</span>
          <select value={form.assemblyTimes} onChange={(e) => setField("assemblyTimes", e.target.value)} className="mt-1 rounded-lg border px-3 py-2">
            <option value="">Select</option>
            <option>1-2 Times</option>
            <option>3-4 Times</option>
            <option>5 and above</option>
          </select>
        </label>
      )}

      {form.attendedKKAssembly === "No" && (
        <label className="flex flex-col">
          <span className="text-sm font-semibold">If No, Why?</span>
          <select value={form.noAssemblyReason} onChange={(e) => setField("noAssemblyReason", e.target.value)} className="mt-1 rounded-lg border px-3 py-2">
            <option value="">Select</option>
            <option>There were no KK Assembly Meetings</option>
            <option>Not interested to attend</option>
          </select>
        </label>
      )}

      <label className="flex items-start gap-3 mt-2">
        <input type="checkbox" checked={form.consent} onChange={(e) => setField("consent", e.target.checked)} className="mt-1" />
        <span className="text-sm">I have read and understood the informed consent and agree to participate in Barangay Pico&apos;s KK Profiling (required). <button type="button" onClick={() => setShowConsentModal(true)} className="ml-2 text-sm underline">(Read consent)</button></span>
      </label>

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
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
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
              <h2 className="text-2xl font-bold text-slate-900">Registration complete</h2>
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
                    ? // if already signed in, append skipKkCheck to help open the SKEAP modal immediately
                      successRedirectTo.includes("?")
                      ? `${successRedirectTo}&skipKkCheck=1`
                      : `${successRedirectTo}?skipKkCheck=1`
                    : `/login?next=${encodeURIComponent(successRedirectTo)}`;
                  router.push(target);
                }}
                className="inline-flex justify-center rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
              >
                {signedIn ? "Proceed to Apply for SKEAP" : "Sign in to apply for SKEAP"}
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
  );
}
