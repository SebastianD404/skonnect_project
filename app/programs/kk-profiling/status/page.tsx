"use client";

import KKProfilingFormModal from "@/app/programs/kk-profiling/KKProfilingFormModal";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";


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
  const [showApprovalModal, setShowApprovalModal] = useState(false);

  function openPreviewModal(url: string, alt: string) {
    setPreviewModalUrl(url);
    setPreviewModalAlt(alt);
  }

  function closePreviewModal() {
    setPreviewModalUrl(null);
    setPreviewModalAlt("");
  }

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    setAuthRequired(false);
    setNoProfile(false);

    fetch("/api/my/kk-profile", { cache: "no-store", credentials: "include" })
      .then(async (response) => {
        if (!mounted) return null;
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          if (response.status === 401) {
            setAuthRequired(true);
            setError(body.error || "Please sign in to view your KK Profiling status.");
            setProfile(null);
            return null;
          }

          if (response.status === 404) {
            setNoProfile(true);
            setError(null);
            setProfile(null);
            return null;
          }

          setError(body.error || "Unable to load KK Profiling status.");
          setProfile(null);
          return null;
        }

        return response.json();
      })
      .then((json) => {
        if (!mounted || !json) return;
        const profileData = json.profile ?? null;
        setProfile(profileData);
        
        // Show approval modal if status is Approved and we haven't shown it yet this session
        if (profileData?.status.toLowerCase().includes("approved")) {
          const hasSeenApprovalModal = sessionStorage.getItem("kk-approval-modal-shown");
          if (!hasSeenApprovalModal) {
            setShowApprovalModal(true);
            sessionStorage.setItem("kk-approval-modal-shown", "true");
          }
        }
      })
      .catch((fetchError) => {
        if (!mounted) return;
        setError(String(fetchError?.message || "Unable to load KK Profile status."));
        setProfile(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const statusBadge = profile ? getStatusBadge(profile.status || "Pending verification") : null;
  const isReturnedStatus = profile?.status.toLowerCase().includes("returned");
  const isResubmittedStatus = profile?.status.toLowerCase().includes("resubmitted");

  const formattedDate = profile?.registrationSubmittedAt
    ? new Date(profile.registrationSubmittedAt).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#F3F7FB] text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
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
                {profile.idDocumentType === "Valid ID" ? (
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
                    {!profile.idFrontFileUrl && !profile.idBackFileUrl ? (
                      <p className="mt-4 text-sm text-slate-600">No ID images were found for this submission.</p>
                    ) : null}
                  </div>
                ) : profile.idSingleFileUrl ? (
                  <div className="mt-4">
                    <a
                      href={profile.idSingleFileUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                    >
                      View uploaded document
                    </a>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-slate-600">No uploaded ID documents are stored for this registration.</p>
                )}
              </div>

              {profile.reviewNotes ? (
                <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6">
                  <p className="text-sm font-semibold text-amber-900">Admin note</p>
                  <p className="mt-3 text-sm leading-7 text-amber-900">{profile.reviewNotes}</p>
                </div>
              ) : null}

              <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
                <h3 className="text-lg font-semibold text-slate-900">What happens next</h3>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  Your KK Profiling registration is under review. You will receive an update when Barangay Pico staff verify your details. If your registration is returned, please follow the admin note and re-submit any required updates.
                </p>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-slate-200 bg-white p-8 shadow-sm">
              <div className="flex flex-col gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Reviewer notes</p>
                    <p className="mt-2 text-sm text-slate-600">
                      Feedback from Barangay Pico staff for your KK Profiling submission.
                    </p>
                  </div>
                  {(profile.reviewNotes || /returned|resubmitted/.test(profile.status.toLowerCase())) && (
                    <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-amber-700">
                      Action required
                    </span>
                  )}
                </div>

                <div className="rounded-[1.75rem] border border-slate-200 bg-slate-50 p-6">
                  {profile.reviewNotes ? (
                    <p className="text-sm leading-7 text-slate-700">{profile.reviewNotes}</p>
                  ) : (
                    <p className="text-sm leading-7 text-slate-600">No reviewer comments have been posted yet.</p>
                  )}
                </div>

                {profile.registration ? (
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
              </div>
            </aside>
          </div>
        ) : null}
      </main>

      {profile?.registration ? (
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

      {showApprovalModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6">
          <div className="relative w-full max-w-xl rounded-[2rem] border border-emerald-200 bg-white p-8 shadow-2xl">
            <div className="flex items-start justify-center">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
                <svg className="h-8 w-8 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </div>
            </div>
            
            <h2 className="mt-6 text-center text-2xl font-bold text-slate-950">Congratulations!</h2>
            <p className="mt-4 text-center text-sm leading-7 text-slate-600">
              Your KK Profiling registration has been approved by Barangay Pico staff. You can now apply for the SKEAP scholarship and register for community events.
            </p>

            <div className="mt-8 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowApprovalModal(false);
                  router.push("/");
                }}
                className="inline-flex justify-center rounded-full bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Go to Homepage
              </button>
              <button
                type="button"
                onClick={() => setShowApprovalModal(false)}
                className="inline-flex justify-center rounded-full border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
