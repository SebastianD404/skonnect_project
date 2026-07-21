"use client";

import dynamic from "next/dynamic";
import KKProfilingFormModal from "@/app/programs/kk-profiling/KKProfilingFormModal";
import KKProfilingApprovedSummaryCard from "@/app/programs/kk-profiling/KKProfilingApprovedSummaryCard";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
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
  const isReturnedStatus = profile?.status.toLowerCase().includes("returned");
  const isResubmittedStatus = profile?.status.toLowerCase().includes("resubmitted");
  
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
      {isMounted && !isProfileDataValid && (
        <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-10 text-center text-sm text-slate-600 shadow-sm">
            Loading your KK profiling status...
          </div>
        </main>
      )}

      {/* Only render main content if data is valid and mounted */}
      {isMounted && isProfileDataValid && (
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
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm text-slate-900">
              <h2 className="text-xl font-semibold">No KK Profiling found</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">
                We could not find a KK Profiling registration linked to your account. Please register so you can track your status.
              </p>
              <div className="mt-6">
                <Link
                  href="/programs/kk-profiling"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Register for KK Profiling
                </Link>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-[2rem] border border-rose-200 bg-rose-50 p-8 shadow-sm text-slate-900">
              <h2 className="text-xl font-semibold">Unable to load status</h2>
              <p className="mt-3 text-sm leading-7 text-slate-700">{error}</p>
              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/programs/kk-profiling"
                  className="inline-flex items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Go to KK Profiling registration
                </Link>
                {authRequired ? (
                  <Link
                    href="/login?next=%2Fprograms%2Fkk-profiling%2Fstatus"
                    className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-900 hover:bg-slate-50"
                  >
                    Sign in to view status
                  </Link>
                ) : null}
              </div>
            </div>
          ) : profile ? (
            <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
              <div className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm uppercase tracking-[0.35em] text-slate-500">Current status</p>
                    <h2 className="mt-2 text-3xl font-bold text-slate-950">{profile.status}</h2>
                  </div>
                  <div
                    className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold text-white ${
                      statusBadge?.tone === "emerald"
                        ? "bg-emerald-600"
                        : statusBadge?.tone === "amber"
                        ? "bg-amber-500"
                        : statusBadge?.tone === "sky"
                        ? "bg-sky-600"
                        : "bg-slate-500"
                    }`}
                  >
                    {statusBadge?.label}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Registered name</p>
                    <p className="mt-3 text-lg font-semibold text-slate-950">{profile.fullName}</p>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-400">Submitted</p>
                    <p className="mt-3 text-lg font-semibold text-slate-950">{formattedDate ?? "Unknown"}</p>
                  </div>
                </div>

                <div className="rounded-[2rem] border border-slate-200 bg-slate-50 p-6">
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

                <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
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
                  <div className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6">
                    <h3 className="text-lg font-semibold text-emerald-900">Your Application is Approved</h3>
                    <p className="mt-3 text-sm leading-7 text-emerald-800">
                      Congratulations! Your KK Profiling registration has been successfully approved by Barangay Pico. You can now access member-only programs and benefits. Your complete application information is available in the summary card on the right.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                    <h3 className="text-lg font-semibold text-slate-900">What happens next</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      Your KK Profiling registration is under review. You will receive an update when Barangay Pico staff verify your details. If your registration is returned, please follow the admin note and re-submit any required updates.
                    </p>
                  </div>
                )}
              </div>

              <aside className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
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
                                Review and update your registration details if any information is incorrect.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setShowFormModal(true)}
                              className="inline-flex items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                            >
                              View KK Profiling Form
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </aside>
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
