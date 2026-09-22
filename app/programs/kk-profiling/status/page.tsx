"use client";

import dynamic from "next/dynamic";
import KKProfilingFormModal from "@/app/programs/kk-profiling/KKProfilingFormModal";
import KKProfilingApprovedSummaryCard from "@/app/programs/kk-profiling/KKProfilingApprovedSummaryCard";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Clock3, FileText, ShieldCheck } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

// NUCLEAR OPTION 1: Enforce SSR Disabled for Success Modal
// This ensures Next.js leaves a completely empty hole in HTML during pre-rendering
// The modal physically CANNOT exist until it hydrates on the client browser
const KKProfilingApprovedViewModal = dynamic(
  () => import("@/app/programs/kk-profiling/KKProfilingApprovedViewModal"),
  { ssr: false }
);


type KkProfileRegistration = {
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

type KkProfileStatus = {
  fullName: string;
  email: string;
  contactNumber: string;
  purok: string;
  addressLine: string;
  barangay: string;
  birthDate: string;
  age: number;
  isVerified: boolean;
  status: string;
  reviewNotes: string | null;
  registrationSubmittedAt: string | null;
  idDocumentType?: string | null;
  idFrontFileUrl?: string | null;
  idBackFileUrl?: string | null;
  idSingleFileUrl?: string | null;
  registration?: KkProfileRegistration | null;
};

function getStatusBadge(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("approved")) {
    return { label: "Approved", tone: "emerald" };
  }
  if (normalized.includes("pending")) {
    return { label: "Pending verification", tone: "amber" };
  }
  if (normalized.includes("returned")) {
    return { label: status, tone: "amber" };
  }
  if (normalized.includes("resubmitted")) {
    return { label: status, tone: "sky" };
  }
  return { label: status, tone: "slate" };
}

export default function KKProfilingStatusPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<KkProfileStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authRequired, setAuthRequired] = useState(false);
  const [noProfile, setNoProfile] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [previewModalUrl, setPreviewModalUrl] = useState<string | null>(null);
  const [previewModalAlt, setPreviewModalAlt] = useState<string>("");
  const [isMounted, setIsMounted] = useState(false);
  const refreshAbortControllerRef = useRef<AbortController | null>(null);
  const refreshIntervalMs = 15000;
  
  // RULE 2: Dedicated Primitive State Hook (Never Derived)
  // This state is ONLY set to true once, and NEVER changes after
  const [showCongratulationModal, setShowCongratulationModal] = useState(false);
  const modalDecisionMadeRef = useRef(false);
  
  // Track if modal has already been dismissed to prevent reopening
  const [hasModalBeenDismissed, setHasModalBeenDismissed] = useState(false);

  function openPreviewModal(url: string, alt: string) {
    setPreviewModalUrl(url);
    setPreviewModalAlt(alt);
  }

  function closePreviewModal() {
    setPreviewModalUrl(null);
    setPreviewModalAlt("");
  }

  // RULE 1: Mounting Guard
  useEffect(() => {
    setIsMounted(true);
    return () => {
      setIsMounted(false);
    };
  }, []);

  // RULE 1: Data Freeze Guard - Prevent rendering until profile invariant is met
  const isProfileDataValid = profile && Object.keys(profile).length > 0;

  const fetchProfile = async ({ background = false } = {}) => {
    const controller = new AbortController();
    refreshAbortControllerRef.current?.abort();
    refreshAbortControllerRef.current = controller;

    if (!background) {
      setLoading(true);
      setError(null);
      setAuthRequired(false);
      setNoProfile(false);
    }

    try {
      const response = await fetch("/api/my/kk-profile", {
        cache: "no-store",
        credentials: "include",
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));

        if (!background) {
          if (response.status === 401) {
            setAuthRequired(true);
            setError(body.error || "Please sign in to view your KK Profiling status.");
            setProfile(null);
            return;
          }

          if (response.status === 404) {
            setNoProfile(true);
            setError(null);
            setProfile(null);
            return;
          }

          setError(body.error || "Unable to load KK Profiling status.");
          setProfile(null);
        }

        return;
      }

      const json = await response.json();
      const profileData = json.profile ?? null;
      if (!mountedRef.current) return;
      if (profileData && typeof profileData === "object" && Object.keys(profileData).length > 0) {
        setProfile(profileData);
      } else {
        setProfile(null);
      }
    } catch (fetchError) {
      if (!mountedRef.current) return;
      const msg = String((fetchError as any)?.message || "");
      const isAbort = (fetchError as any)?.name === "AbortError" || /aborted|abort|signal/i.test(msg);
      if (isAbort) {
        // Ignore aborts — they are expected when we refresh or unmount
        return;
      }
      if (!background) {
        setError(msg || "Unable to load KK Profile status.");
        setProfile(null);
      }
    } finally {
      if (!background && mountedRef.current) {
        setLoading(false);
      }
    }
  };

  const mountedRef = useRef(false);

  useEffect(() => {
    let intervalId: number | undefined;
    let visibleListener: (() => void) | null = null;

    mountedRef.current = true;
    fetchProfile();

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        fetchProfile({ background: true });
      }
    };

    intervalId = window.setInterval(() => fetchProfile({ background: true }), refreshIntervalMs);
    visibleListener = () => refreshIfVisible();
    document.addEventListener("visibilitychange", visibleListener);
    window.addEventListener("focus", refreshIfVisible);

    return () => {
      mountedRef.current = false;
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (visibleListener) {
        document.removeEventListener("visibilitychange", visibleListener);
      }
      window.removeEventListener("focus", refreshIfVisible);
      refreshAbortControllerRef.current?.abort();
    };
  }, []);

  const statusBadge = profile ? getStatusBadge(profile.status || "Pending verification") : null;
  // NUCLEAR OPTION 2: Strict Type Booleans - Eliminate Falsy Traps
  // Never use loose checks like !user.hasSeenModal or && !hasSeen
  // Require explicit boolean evaluation against true/false only
  const isApprovedStatus = profile?.status.toLowerCase().includes("approved") === true;
  const hasValidRegistration = profile?.registration !== null && profile?.registration !== undefined;
  
  // NUCLEAR OPTION 3: Strict Modal Visibility Gate
  // Modal should ONLY be visible when ALL conditions are EXPLICITLY true
  const shouldRenderApprovedModal = 
    isApprovedStatus === true &&
    hasValidRegistration === true &&
    showCongratulationModal === true;



  // RULE 2: CONTROLLED MODAL DECISION
  // This effect ONLY runs when data is 100% stable and valid
  // It sets the state ONCE and never changes it again
  useEffect(() => {
    // Early escapes to prevent partial state triggers
    if (isMounted !== true) return;
    if (loading !== false) return;
    if (isProfileDataValid !== true) return;
    if (isApprovedStatus !== true) return;
    if (hasValidRegistration !== true) return;
    if (modalDecisionMadeRef.current === true) return; // Already decided - never run again

    // Check if user already dismissed - use strict boolean check
    const hasUserDismissed = localStorage.getItem("kk-approval-modal-shown-v2") === "true";
    if (hasUserDismissed === false) {
      setShowCongratulationModal(true);
      setHasModalBeenDismissed(false);
      localStorage.setItem("kk-approval-modal-shown-v2", "true");
    } else {
      setHasModalBeenDismissed(true);
    }
    
    // Mark decision as made - NEVER run this effect again
    modalDecisionMadeRef.current = true;
  }, [isMounted, loading, profile, isProfileDataValid, isApprovedStatus, hasValidRegistration]);

  const formattedDate = profile?.registrationSubmittedAt
    ? new Date(profile.registrationSubmittedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#F3F7FB] text-slate-900">
      {/* RULE 1: Freeze Rendering Until Data Invariant is Met */}
      {/* If profile data is not valid, show skeleton and never render modals */}
      {!isMounted && (
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-sm text-slate-600 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-slate-200 rounded w-3/4 mx-auto"></div>
              <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
            </div>
          </div>
        </main>
      )}

      {/* Data validation guard */}
      {isMounted && !loading && !isProfileDataValid && !noProfile && !error && !authRequired && (
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-sm text-slate-600 shadow-sm">
            Loading your KK profiling status...
          </div>
        </main>
      )}

      {/* Only render main content if data is valid and mounted */}
      {isMounted && (isProfileDataValid || noProfile || error || authRequired) && (
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center gap-2 text-sm text-slate-600">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 hover:text-slate-950"
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </button>
            <span className="text-slate-400">/</span>
            <span className="font-semibold text-slate-900">KK Profiling Status</span>
          </div>

          <div className="mb-8 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
            <div className="space-y-4">
              <p className="text-xs uppercase tracking-[0.35em] text-teal-600">KK Profiling</p>
              <h1 className="text-3xl font-bold text-slate-950">KK Profiling Status</h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-600">
                Monitor your KK Profiling registration and see the current review status. If your registration requires more information or a corrected document, the admin note will help you update it.
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-sm text-slate-600 shadow-sm">
              Loading your KK profiling status...
            </div>
          ) : noProfile ? (
            <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
              <div className="bg-[linear-gradient(120deg,#0f3d5c_0%,#145b72_58%,#e7f4f1_160%)] px-6 py-8 text-white sm:px-10 sm:py-10">
                <div className="flex max-w-3xl flex-col gap-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                    <FileText className="h-6 w-6" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-100">Application center</p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Start your KK Profiling application</h2>
                    <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-100 sm:text-base">
                      You do not have an active KK Profiling application yet. Complete the registration once and this page will become your dedicated place to track review progress, documents, and next steps.
                    </p>
                  </div>
                  <div>
                    <Link
                      href="/programs/kk-profiling"
                      className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0F3D5C] shadow-lg transition hover:-translate-y-0.5 hover:bg-teal-50"
                    >
                      Begin application
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                  </div>
                </div>
              </div>

              <div className="px-6 py-8 sm:px-10 sm:py-10">
                <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
                  <section aria-labelledby="application-process-heading">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-700">What to expect</p>
                    <h3 id="application-process-heading" className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">A clear path from registration to review</h3>
                    <div className="mt-6 divide-y divide-slate-200 border-y border-slate-200">
                      <div className="flex gap-4 py-5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-teal-50 text-sm font-bold text-teal-800">1</span>
                        <div>
                          <p className="font-semibold text-slate-950">Complete your profile</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">Enter your personal details and upload the required identification documents.</p>
                        </div>
                      </div>
                      <div className="flex gap-4 py-5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm font-bold text-amber-800">2</span>
                        <div>
                          <p className="font-semibold text-slate-950">Staff verification</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">Barangay Pico staff review your information and documents for completeness.</p>
                        </div>
                      </div>
                      <div className="flex gap-4 py-5">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-sm font-bold text-emerald-800">3</span>
                        <div>
                          <p className="font-semibold text-slate-950">Monitor your decision</p>
                          <p className="mt-1 text-sm leading-6 text-slate-600">Return here to see your status, reviewer notes, and any requested updates.</p>
                        </div>
                      </div>
                    </div>
                  </section>

                  <aside className="border-l-0 border-slate-200 lg:border-l lg:pl-8">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Before you begin</p>
                    <div className="mt-4 space-y-4">
                      <div className="flex gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                        <p className="text-sm leading-6 text-slate-600">Have a valid ID and Certificate of Residency ready for upload.</p>
                      </div>
                      <div className="flex gap-3">
                        <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                        <p className="text-sm leading-6 text-slate-600">The form saves your progress while you work in this browser.</p>
                      </div>
                      <div className="flex gap-3">
                        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden="true" />
                        <p className="text-sm leading-6 text-slate-600">After submission, this page becomes your application dashboard.</p>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>
          ) : error ? (
            authRequired ? (
              <div className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                <div className="bg-[linear-gradient(120deg,#0f3d5c_0%,#145b72_58%,#e7f4f1_160%)] px-6 py-8 text-white sm:px-10 sm:py-10">
                  <div className="max-w-2xl">
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-100">Your application center</p>
                    <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">Sign in to continue</h2>
                    <p className="mt-4 max-w-xl text-sm leading-7 text-slate-100 sm:text-base">
                      Sign in to view your KK Profiling application, or begin a new application if you are not registered yet.
                    </p>
                    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                      <Link
                        href="/login?next=%2Fprograms%2Fkk-profiling%2Fstatus"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-[#0F3D5C] shadow-lg transition hover:-translate-y-0.5 hover:bg-teal-50"
                      >
                        Sign in to view status
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                      </Link>
                      <Link
                        href="/programs/kk-profiling"
                        className="inline-flex items-center justify-center rounded-xl border border-white/40 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        Begin new application
                      </Link>
                    </div>
                  </div>
                </div>
                <div className="grid gap-4 px-6 py-6 sm:grid-cols-3 sm:px-10">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">Track progress</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">See review updates in one place.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">Manage documents</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Review submitted identification.</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">Stay informed</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Find notes and next steps quickly.</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-8 text-slate-900 shadow-sm">
                <h2 className="text-xl font-semibold">We could not load your status</h2>
                <p className="mt-3 text-sm leading-7 text-slate-700">{error}</p>
                <button
                  type="button"
                  onClick={() => fetchProfile()}
                  className="mt-6 inline-flex items-center justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                >
                  Try again
                </button>
              </div>
            )
          ) : profile ? (
            <div className="space-y-6">
              <section className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.08)]">
                <div className="bg-[linear-gradient(120deg,#0f3d5c_0%,#145b72_58%,#e7f4f1_160%)] px-6 py-8 text-white sm:px-10">
                  <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-teal-100">Application overview</p>
                      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{profile.status}</h2>
                      <p className="mt-2 text-sm text-slate-100">Your KK Profiling application is being tracked here.</p>
                    </div>
                    <span className={`inline-flex w-fit items-center rounded-full px-4 py-2 text-sm font-semibold ${
                      statusBadge?.tone === "emerald" ? "bg-emerald-100 text-emerald-900" :
                      statusBadge?.tone === "amber" ? "bg-amber-100 text-amber-900" :
                      statusBadge?.tone === "sky" ? "bg-sky-100 text-sky-900" : "bg-white/15 text-white ring-1 ring-white/25"
                    }`}>
                      {statusBadge?.label}
                    </span>
                  </div>
                </div>
                <div className="grid gap-5 border-b border-slate-200 px-6 py-6 sm:grid-cols-3 sm:px-10">
                  <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Applicant</p><p className="mt-2 font-semibold text-slate-950">{profile.fullName}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Submitted</p><p className="mt-2 font-semibold text-slate-950">{formattedDate ?? "Unknown"}</p></div>
                  <div><p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Next step</p><p className="mt-2 font-semibold text-slate-950">{isApprovedStatus ? "Access your benefits" : "Await staff review"}</p></div>
                </div>
                <div className="grid gap-4 px-6 py-5 sm:grid-cols-3 sm:px-10">
                  {["Application submitted", "Staff verification", "Decision and update"].map((step, index) => {
                    const complete = isApprovedStatus || index === 0;
                    const active = !complete && index === 1;
                    return <div key={step} className="flex items-center gap-3" aria-current={active ? "step" : undefined}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${complete ? "bg-teal-700 text-white" : active ? "bg-teal-50 text-teal-700 ring-2 ring-teal-200" : "bg-slate-100 text-slate-400"}`}>{complete ? "✓" : active ? <span className="flex items-center gap-0.5" aria-label="In progress"><i className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-pulse" /><i className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-pulse [animation-delay:150ms]" /><i className="h-1.5 w-1.5 rounded-full bg-teal-600 animate-pulse [animation-delay:300ms]" /></span> : index + 1}</span><span className={`text-sm font-medium ${complete ? "text-slate-900" : active ? "text-teal-800" : "text-slate-400"}`}>{step}{active ? <span className="ml-2 text-xs font-normal text-slate-500">In progress</span> : null}</span></div>;
                  })}
                </div>
              </section>

              <div className="grid items-stretch gap-6 lg:grid-cols-[1fr_0.85fr]">
              <div className="divide-y divide-slate-200 overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_18px_50px_rgba(15,23,42,0.06)]">

                <div className="p-6 sm:p-7">
                  <p className="text-sm font-semibold text-slate-900">Registration details</p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Email</p>
                      <p className="mt-2 text-sm text-slate-700">{profile.email}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Contact</p>
                      <p className="mt-2 text-sm text-slate-700">{profile.contactNumber}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Address</p>
                      <p className="mt-2 text-sm text-slate-700">{profile.purok}, {profile.addressLine}, {profile.barangay}</p>
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-[0.35em] text-slate-500">Age</p>
                      <p className="mt-2 text-sm text-slate-700">{profile.age}</p>
                    </div>
                  </div>
                </div>

                <div className="p-6 sm:p-7">
                  <p className="text-sm font-semibold text-slate-900">Uploaded identification</p>
                  <p className="mt-2 text-sm text-slate-600">{profile.idDocumentType || "Not uploaded yet"}</p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {profile.idFrontFileUrl ? (
                      <a
                        href={profile.idFrontFileUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                      >
                        View front of ID
                      </a>
                    ) : null}
                    {profile.idBackFileUrl ? (
                      <a
                        href={profile.idBackFileUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                      >
                        View back of ID
                      </a>
                    ) : null}
                    {profile.idSingleFileUrl ? (
                      <a
                        href={profile.idSingleFileUrl}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                      >
                        View Certificate of Residency
                      </a>
                    ) : null}
                    {!profile.idFrontFileUrl && !profile.idBackFileUrl && !profile.idSingleFileUrl ? (
                      <p className="mt-4 text-sm text-slate-600">No uploaded ID documents are stored for this registration.</p>
                    ) : null}
                  </div>
                </div>

                {profile.reviewNotes ? (
                  <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
                    <p className="text-sm font-semibold text-amber-900">Admin note</p>
                    <p className="mt-3 text-sm leading-7 text-amber-900">{profile.reviewNotes}</p>
                  </div>
                ) : null}

                {isApprovedStatus === true ? (
                  <div className="bg-emerald-50 p-6 sm:p-7">
                    <h3 className="text-lg font-semibold text-emerald-900">Your Application is Approved</h3>
                    <p className="mt-3 text-sm leading-7 text-emerald-800">
                      Congratulations! Your KK Profiling registration has been successfully approved by Barangay Pico. You can now access member-only programs and benefits. Your complete application information is available in the summary card on the right.
                    </p>
                  </div>
                ) : (
                  <div className="bg-slate-50/70 p-6 sm:p-7">
                    <h3 className="text-lg font-semibold text-slate-900">What happens next</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Your KK Profiling registration is under review. You will receive an update when Barangay Pico staff verify your details. If your registration is returned, please follow the admin note and re-submit any required updates.
                    </p>
                  </div>
                )}
              </div>

              <aside className="h-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] lg:sticky lg:top-24">
                <div className="flex flex-col gap-5">
                  {isApprovedStatus === true ? (
                    <KKProfilingApprovedSummaryCard
                      fullName={profile.fullName}
                      email={profile.email}
                      contactNumber={profile.contactNumber}
                      age={profile.age}
                      submittedDate={profile.registrationSubmittedAt ?? undefined}
                      onViewApplication={() => {
                        setShowCongratulationModal(true);
                      }}
                    />
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">Reviewer notes</p>
                          <p className="mt-2 text-sm text-slate-600">
                            Feedback from Barangay Pico staff for your KK Profiling submission.
                          </p>
                        </div>
                        {(profile?.reviewNotes || /returned|resubmitted/.test(profile?.status.toLowerCase() ?? "")) && (
                          <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                            Action required
                          </span>
                        )}
                      </div>

                      <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
                        {profile?.reviewNotes ? (
                          <p className="text-sm leading-7 text-slate-700">{profile.reviewNotes}</p>
                        ) : (
                          <p className="text-sm leading-7 text-slate-600">No reviewer comments have been posted yet.</p>
                        )}
                      </div>

                      {profile?.registration && !isApprovedStatus ? (
                        <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="text-sm font-semibold text-slate-900">KK Profiling form</p>
                              <p className="mt-2 text-sm text-slate-600">
                                Review and update your registration details when information needs correction.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowFormModal(true)}
                              className="inline-flex shrink-0 items-center justify-center rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </aside>
              </div>
            </div>
          ) : null}
        </main>
      )}

      {profile?.registration && !isApprovedStatus ? (
        <KKProfilingFormModal
          isOpen={showFormModal}
          registration={profile.registration}
          onClose={() => setShowFormModal(false)}
          onSaved={(updated) => {
            setProfile((current) =>
              current
                ? {
                    ...current,
                    status: updated.reviewStatus ?? current.status,
                    registration: {
                      ...current.registration,
                      ...updated,
                    },
                  }
                : current
            );
          }}
        />
      ) : null}

      {/* NUCLEAR OPTION 4: Kill CSS Transition Initialization */}
      {/* Wrap approved modal in hardcoded inline utility style class to prevent transitions */}
      {/* This component is dynamically imported with ssr: false */}
      {shouldRenderApprovedModal === true && (
        <div className={shouldRenderApprovedModal === true ? "block" : "hidden"}>
          <KKProfilingApprovedViewModal
            isOpen={shouldRenderApprovedModal === true}
            registration={profile!.registration!}
            onClose={() => {
              setShowCongratulationModal(false);
              setHasModalBeenDismissed(true);
            }}
            approvalDate={profile.registrationSubmittedAt ?? undefined}
          />
        </div>
      )}

      {previewModalUrl ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4" role="dialog" aria-modal="true">
          <div className="relative max-h-full w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <p className="text-sm font-semibold text-slate-900">{previewModalAlt}</p>
              <button
                type="button"
                onClick={closePreviewModal}
                className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
            <div className="max-h-[85vh] overflow-auto bg-slate-950 p-4">
              <img src={previewModalUrl} alt={previewModalAlt} className="mx-auto max-h-[80vh] w-auto max-w-full object-contain" />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
