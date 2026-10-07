"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CheckCircle2, X } from "lucide-react";
import SkeapApplicationWizard from "@/app/programs/SkeapApplicationWizard";
import { fetchKKProfile, prefetchKKProfile, type KKProfile } from "@/lib/kk-profile-client";
import { useAuth } from "@/app/components/AuthProvider";
import { isSkeapTestAccount } from "@/lib/skeap-test-access";

type Props = {
  slug: string;
  requirements?: string[];
};

type ProgramStatus = {
  badge?: string;
  label?: string;
  summary?: string;
  granteeCount?: number;
  activeScholarsCount?: number;
  maxSlots?: number | null;
  remainingSlots?: number;
};

const PROGRAM_STATUS_CACHE_TTL = 5 * 60 * 1000;
const programStatusCache = new Map<string, { data: ProgramStatus; expiresAt: number }>();
const programStatusRequests = new Map<string, Promise<ProgramStatus | null>>();

function getCachedProgramStatus(slug: string) {
  const cached = programStatusCache.get(slug);
  if (!cached) return null;
  if (cached.expiresAt <= Date.now()) {
    programStatusCache.delete(slug);
    return null;
  }
  return cached.data;
}

function fetchProgramStatus(slug: string): Promise<ProgramStatus | null> {
  const cached = getCachedProgramStatus(slug);
  if (cached) return Promise.resolve(cached);

  const existingRequest = programStatusRequests.get(slug);
  if (existingRequest) return existingRequest;

  const request = fetch(`/api/programs/${slug}/status`, { cache: "no-store" })
    .then(async (response) => {
      if (!response.ok) return null;
      const data = (await response.json()) as ProgramStatus;
      programStatusCache.set(slug, { data, expiresAt: Date.now() + PROGRAM_STATUS_CACHE_TTL });
      return data;
    })
    .finally(() => {
      programStatusRequests.delete(slug);
    });

  programStatusRequests.set(slug, request);
  return request;
}

function prefetchProgramStatus(slug: string) {
  void fetchProgramStatus(slug).catch(() => undefined);
}

export default function ProgramApplyClient({ slug, requirements = [] }: Props) {
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<KKProfile | null>(null);
  const [checkingKkProfile, setCheckingKkProfile] = useState(false);
  const [kkCheckError, setKkCheckError] = useState<string | null>(null);
  const [showKkRequiredModal, setShowKkRequiredModal] = useState(false);
  const [status, setStatus] = useState<ProgramStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [footerActionsTarget, setFooterActionsTarget] = useState<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);
  const autoApplyHandled = useRef(false);

  function openApplicationModal(profile: KKProfile) {
    setUserProfile(profile);
    setStatus(getCachedProgramStatus(slug));
    setOpen(true);
  }

  async function openApplyFlow(skipKkCheck = false) {
    setCheckingKkProfile(true);
    setKkCheckError(null);
    const isTestAccount = isSkeapTestAccount(user?.email);

    try {
      if (isTestAccount && user?.email) {
        openApplicationModal({
          fullName: user.fullName || "",
          email: user.email,
          contactNumber: "",
          purok: "",
          addressLine: "",
          barangay: "Pico",
          birthDate: "",
          age: 0,
        });
        return;
      }

      const data = await fetchKKProfile();
      const isApproved =
        data.registration?.reviewStatus === "Approved" ||
        data.profile.registration?.reviewStatus === "Approved" ||
        data.profile.status === "Approved";

      if (skipKkCheck || isApproved) {
        openApplicationModal(data.profile);
      } else {
        setKkCheckError("Your KK profiling registration must be approved before you can apply for SKEAP.");
        setShowKkRequiredModal(true);
      }
    } catch (error) {
      console.error("Unable to load KK profile before SKEAP application:", error);
      setShowKkRequiredModal(true);
    } finally {
      setCheckingKkProfile(false);
    }
  }

  useEffect(() => {
    prefetchProgramStatus(slug);
    if (!authLoading && !isSkeapTestAccount(user?.email)) prefetchKKProfile();
  }, [authLoading, slug, user?.email]);

  useEffect(() => {
    if (authLoading || autoApplyHandled.current) return;

    let autoApplyTimer: number | undefined;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("openApply") === "1") {
        autoApplyHandled.current = true;
        const skip = params.get("skipKkCheck") === "1";
        autoApplyTimer = window.setTimeout(() => void openApplyFlow(skip), 0);
        params.delete("openApply");
        params.delete("skipKkCheck");
        const base = window.location.pathname + (params.toString() ? `?${params.toString()}` : "");
        window.history.replaceState({}, document.title, base + window.location.hash);
      }
    } catch {
      // ignore environments without window
    }
    return () => {
      if (autoApplyTimer !== undefined) window.clearTimeout(autoApplyTimer);
    };
  // The auth-ready guard and handled ref ensure the URL action runs once for the resolved user.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, user?.email]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;

    const cachedStatus = getCachedProgramStatus(slug);
    if (cachedStatus) {
      setStatus(cachedStatus);
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    setLoading(true);
    fetchProgramStatus(slug)
      .then((json) => {
        if (!mounted) return;
        setStatus(json);
      })
      .catch(() => {
        if (!mounted) return;
        setStatus(null);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [open, slug]);

  const isOpen =
    (status?.label || "").toLowerCase().includes("open") ||
    (status?.badge || "").toLowerCase().includes("open");
  const isWaitlisted = status?.remainingSlots === 0;
  return (
    <>
      <button
        onMouseEnter={() => {
          prefetchProgramStatus(slug);
          if (!authLoading && !isSkeapTestAccount(user?.email)) prefetchKKProfile();
        }}
        onClick={() => {
          void openApplyFlow();
        }}
        disabled={checkingKkProfile || authLoading}
        className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
      >
        {checkingKkProfile ? "Checking KK profile..." : "Apply for SKEAP →"}
      </button>

      {showKkRequiredModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm"
            onClick={() => setShowKkRequiredModal(false)}
          />
          <div className="relative w-full max-w-xl rounded-[2rem] border border-slate-200 bg-white p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              aria-label="Close"
              onClick={() => setShowKkRequiredModal(false)}
              className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <X className="h-5 w-5" />
            </button>
            {kkCheckError ? (
              <>
                <p className="text-xs uppercase tracking-[0.28em] text-amber-600">Approval required</p>
                <h3 className="mt-2 text-3xl font-semibold text-slate-900">KK Profiling awaiting approval</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  {kkCheckError}
                </p>
                <p className="mt-3 text-sm leading-7 text-slate-600">
                  You can check the status of your KK Profiling submission and submit corrections if needed.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowKkRequiredModal(false)}
                    className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <Link
                    href="/programs/kk-profiling/status"
                    className="inline-flex justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Check KK Status
                  </Link>
                </div>
              </>
            ) : (
              <>
                <p className="text-xs uppercase tracking-[0.28em] text-emerald-600">SK Program Access</p>
                <h3 className="mt-2 text-3xl font-semibold text-slate-900">Set up your KK Profile first</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  To apply for the SKEAP grant, you first need an official Katipunan ng Kabataan (KK) profile to verify your residency in Barangay Pico. Already have an SKonnect account? Log in to continue your application.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
                  <Link
                    href={typeof window !== "undefined" ? `/programs/kk-profiling?redirect=${encodeURIComponent(window.location.href)}` : "/programs/kk-profiling"}
                    className="inline-flex justify-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Create KK Profile
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.location.href = `/login?redirect=${encodeURIComponent(window.location.href)}`;
                      }
                    }}
                    className="inline-flex justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                  >
                    Log in
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}


      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-950/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative flex h-[85vh] min-h-[600px] max-h-[900px] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="z-10 flex shrink-0 items-start justify-between rounded-t-2xl bg-[linear-gradient(120deg,#0f3d5c_0%,#145b72_58%,#e7f4f1_160%)] px-8 py-6">
              <div className="flex flex-col gap-1 pr-8">
                <p className="text-[10px] font-bold uppercase tracking-widest text-white/70">SKEAP Application</p>
                <h3 className="text-2xl font-black text-white">Application</h3>
                <p className="mt-1 text-sm text-white/80">
                  This is the official SKEAP application. Your KK profile details are auto-filled and locked; complete each section and upload the required documents to submit.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="rounded-full bg-white/10 p-2 text-white/70 backdrop-blur-sm transition-colors hover:bg-white/20 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {submittedReference ? (
              <div className="my-auto flex flex-1 flex-col items-center justify-center p-12 text-center">
                <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 shadow-sm">
                  <CheckCircle2 className="h-10 w-10 animate-in zoom-in duration-300 text-emerald-600" />
                </div>
                <span className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-600">
                  Success Confirmation
                </span>
                <h2 className="mb-2 text-2xl font-black text-slate-900">Application Submitted Successfully</h2>
                <p className="mb-8 max-w-md text-sm leading-relaxed text-slate-500">
                  Your SKEAP application has been securely logged. You can now monitor your review status and track document verification on your dashboard.
                </p>
                <div className="flex w-full max-w-sm items-center justify-center gap-4">
                  <Link
                    href={`/applications/${encodeURIComponent(submittedReference)}`}
                    onClick={() => setOpen(false)}
                    className="flex-1 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                  >
                    View application status
                  </Link>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
            <div ref={scrollContainerRef} className="relative flex min-h-0 flex-1 flex-col items-start gap-x-8 gap-y-8 overflow-y-auto overflow-x-hidden p-8 lg:flex-row">
              <aside className="sticky top-0 z-10 flex w-full shrink-0 self-start flex-col gap-4 lg:w-80">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
                    <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Program window</p>
                  <p className={`mt-2 text-sm font-semibold ${isWaitlisted ? "text-amber-600" : "text-slate-900"}`}>
                    {!loading && status
                      ? isWaitlisted
                        ? "Waitlist Open"
                        : isOpen
                          ? "Applications are open"
                          : "Applications are closed"
                      : "Checking application status"}
                  </p>
                  <div className="mt-2 text-sm text-slate-500">
                    {loading ? (
                      <div className="mt-1 flex items-center gap-2" aria-label="Loading registered scholar count">
                        <span>Loading available SKEAP slots</span>
                        <span className="inline-block h-4 w-6 animate-pulse rounded bg-slate-200" aria-hidden="true" />
                      </div>
                    ) : typeof status?.maxSlots === "number" &&
                      typeof status.remainingSlots === "number" ? (
                      isWaitlisted ? (
                        <p>
                          All <strong className="font-bold text-slate-900">{status.maxSlots}</strong> slots are currently
                          filled. You can still apply to be placed on the waitlist, and we will contact you if new slots
                          open up.
                        </p>
                      ) : (
                        <p>
                          <strong className="font-bold text-slate-900">{status.remainingSlots}</strong>{" "}
                          SKEAP slots remaining out of{" "}
                          <strong className="font-bold text-slate-900">{status.maxSlots}</strong>.
                        </p>
                      )
                    ) : status &&
                      (typeof status.maxSlots === "undefined" || status.maxSlots === null) ? (
                      <p>
                        Open for applications (
                        <strong className="font-bold text-slate-900">
                          {status.activeScholarsCount ?? status.granteeCount ?? 0}
                        </strong>{" "}
                        approved scholars).
                      </p>
                    ) : (
                      <p>Unable to load available SKEAP slots.</p>
                    )}
                  </div>
                </div>

                {!loading && status && isOpen ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">Checklist before submit</p>
                    <ul className="mt-4 flex flex-col space-y-4">
                      {requirements.map((item, index) => (
                        <li key={`${item}-${index}`} className="flex items-start gap-3">
                          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                          <span className="text-sm leading-relaxed text-slate-600">{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {!loading && status && !isOpen ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm leading-relaxed text-amber-800">
                    This cycle is currently closed. Watch announcements for the next application window.
                    <div className="mt-3">
                      <Link href="/announcements" className="font-semibold text-amber-900 underline">
                        View announcements
                      </Link>
                    </div>
                  </div>
                ) : null}
            </aside>

            <section className="min-w-0 w-full flex-1 self-start">
                {!loading && status && !isOpen ? (
                  <div className="rounded-3xl border border-slate-200 bg-white p-6 text-sm text-slate-700">
                    SKEAP applications are currently closed for this cycle.
                  </div>
                ) : (
                  <SkeapApplicationWizard
                    requirements={requirements}
                    footerActionsTarget={footerActionsTarget}
                    scrollContainerRef={scrollContainerRef}
                    userProfile={userProfile!}
                    allowManualProfileDetails={isSkeapTestAccount(user?.email)}
                    onSubmitted={setSubmittedReference}
                  />
                )}
              </section>
            </div>
            )}

            {!submittedReference ? (
              <div
                ref={setFooterActionsTarget}
                className="z-20 mt-auto flex min-h-[80px] w-full shrink-0 items-center justify-between border-t border-slate-200 bg-slate-50 px-8 py-5"
              />
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
