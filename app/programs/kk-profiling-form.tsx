"use client";

import React, { useState } from "react";

export default function KKProfilingForm() {
  const [form, setForm] = useState({
    fullName: "",
    address: "",
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
  });

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);

  function setField<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  function validate() {
    if (!form.fullName.trim()) return "Full name is required";
    if (!form.address.trim()) return "Complete address is required";
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

    const err = validate();
    if (err) {
      setMessage(err);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/programs/kk-profiling/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const body = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage("Registration submitted — thank you!");
        setForm({
          fullName: "",
          address: "",
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
        });
      } else {
        setMessage(body?.error ?? "Failed to submit. Please try again.");
      }
    } catch (err) {
      setMessage("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
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

      <label className="flex flex-col">
        <span className="text-sm font-semibold">Complete Name (Family, First, Middle) *</span>
        <input value={form.fullName} onChange={(e) => setField("fullName", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2" />
      </label>

      <label className="flex flex-col">
        <span className="text-sm font-semibold">Complete Address *</span>
        <input value={form.address} onChange={(e) => setField("address", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2" />
      </label>

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
          <input type="number" min={0} value={form.age} onChange={(e) => setField("age", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2" />
        </label>

        <label className="flex flex-col">
          <span className="text-sm font-semibold">Birth Date *</span>
          <input type="date" value={form.birthDate} onChange={(e) => setField("birthDate", e.target.value)} required className="mt-1 rounded-lg border px-3 py-2" />
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
        <span className="text-sm">I have read and understood the informed consent and agree to participate in Barangay Pico's KK Profiling (required). <button type="button" onClick={() => setShowConsentModal(true)} className="ml-2 text-sm underline">(Read consent)</button></span>
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
                <p>By clicking "Submit" on the registration form you acknowledge that you have read and understood the information provided in this consent form and agree to participate in Barangay Pico's KK Profiling, including the use of your data as part of a corpus.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-60">
          {submitting ? "Submitting..." : "Submit"}
        </button>
        {message && <p className="text-sm text-slate-700">{message}</p>}
      </div>
    </form>
  );
}
