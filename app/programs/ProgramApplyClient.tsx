"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, LoaderCircle, X } from "lucide-react";
import SkeapApplicationWizard from "@/app/programs/SkeapApplicationWizard";
import { fetchKKProfile, prefetchKKProfile, type KKProfile } from "@/lib/kk-profile-client";
import { useAuth } from "@/app/components/AuthProvider";
import { isSkeapTestAccount } from "@/lib/skeap-test-access";
import { createBrowserClient } from "@/lib/supabase/browser";
import { getSkeapRequiredDocuments } from "@/lib/skeap-upload";
import type { SkeapUploadKey, SkeapUploadValue } from "@/lib/skeap-upload";
import type { SkeapEducationLevel, SkeapEducationLevelCode } from "@/lib/skeap-education";
import AccountRequiredModal from "@/app/components/AccountRequiredModal";
import { handleSkeapApply } from "@/lib/skeap-application-client";
import VerificationModal from "@/app/components/VerificationModal";

type Props = {
  slug: string;
  initialActiveEducationLevels: readonly SkeapEducationLevelCode[];
  waitlistStatus?: {
    isWaitlisted: boolean;
    queuePosition: number | null;
    totalWaitlisted: number;
    isCycleClosedAndFull: boolean;
  };
};

type ProgramStatus = {
  badge?: string;
  label?: string;
  summary?: string;
  granteeCount?: number;
  activeScholarsCount?: number;
  maxSlots?: number | null;
  remainingSlots?: number;
  isCycleClosedAndFull?: boolean;
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

export default function ProgramApplyClient({
  slug,
  initialActiveEducationLevels,
  waitlistStatus = {
    isWaitlisted: false,
    queuePosition: null,
    totalWaitlisted: 0,
    isCycleClosedAndFull: false,
  },
}: Props) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [userProfile, setUserProfile] = useState<KKProfile | null>(null);
  const [checkingKkProfile, setCheckingKkProfile] = useState(false);
  const [kkCheckError, setKkCheckError] = useState<string | null>(null);
  const [kkCheckUnavailable, setKkCheckUnavailable] = useState(false);
  const [showKkRequiredModal, setShowKkRequiredModal] = useState(false);
  const [showAuthRequiredModal, setShowAuthRequiredModal] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState<string | null>(null);
  const [status, setStatus] = useState<ProgramStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [skeapEligibility, setSkeapEligibility] = useState<
    "unchecked" | "eligible" | "barred" | "unavailable"
  >("unchecked");
  const [eligibilityEmail, setEligibilityEmail] = useState<string | null>(null);
  const [skeapEligibilityMessage, setSkeapEligibilityMessage] = useState<string | null>(null);
  const [hasPriorRevocation, setHasPriorRevocation] = useState(false);
  const [initialUploadedFiles, setInitialUploadedFiles] = useState<
    Partial<Record<SkeapUploadKey, SkeapUploadValue>>
  >({});
  const [footerActionsTarget, setFooterActionsTarget] = useState<HTMLDivElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [submittedReference, setSubmittedReference] = useState<string | null>(null);
  const [educationLevel, setEducationLevel] = useState<SkeapEducationLevel | "">("");
  const [yearLevel, setYearLevel] = useState("");
  const isAuthenticated = Boolean(user);
  const currentSkeapEligibility =
    user?.email && user.email === eligibilityEmail ? skeapEligibility : "unchecked";
  const [applicantEligibility, setApplicantEligibility] = useState<{
    age: number;
    registeredVoter: boolean | null;
  }>({ age: 0, registeredVoter: null });
  const autoApplyHandled = useRef(false);
  const handleEligibilityChange = useCallback((age: number, registeredVoter: boolean | null) => {
    setApplicantEligibility({ age, registeredVoter });
  }, []);
  const requiredDocuments = useMemo(
    () => getSkeapRequiredDocuments(
      educationLevel,
      yearLevel,
      applicantEligibility.age,
      applicantEligibility.registeredVoter,
    ),
    [educationLevel, yearLevel, applicantEligibility]
  );

  function openApplicationModal(profile: KKProfile) {
    setUserProfile(profile);
    setApplicantEligibility({
      age: Number(profile.age) || 0,
      registeredVoter: null,
    });
    setStatus(getCachedProgramStatus(slug));
    setLoading(true);
    setEducationLevel("");
    setYearLevel("");
    setOpen(true);
  }

  async function openApplyFlow(skipKkCheck = false) {
    if (currentSkeapEligibility === "barred") return;
    if (currentSkeapEligibility === "unavailable") {
      setApplyError("Unable to verify SKEAP eligibility. Please refresh the page and try again.");
      return;
    }

    try {
      const supabase = createBrowserClient();
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (error) {
        console.error("Unable to check authentication before SKEAP application:", error);
        setShowAuthRequiredModal(true);
        return;
      }

      if (!session) {
        setShowAuthRequiredModal(true);
        return;
      }
    } catch (error) {
      console.error("Auth check failed:", error);
      setShowAuthRequiredModal(true);
      return;
    }

    setCheckingKkProfile(true);
    setKkCheckError(null);
    setKkCheckUnavailable(false);
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
      const profile = data?.profile;
      if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
        throw new Error("KK profile response is missing profile data.");
      }

      const kkProfileStatus = (
        data?.registration?.reviewStatus ??
        profile.registration?.reviewStatus ??
        profile.status ??
        ""
      ).trim().toUpperCase();

      if (skipKkCheck || kkProfileStatus === "APPROVED") {
        handleSkeapApply(
          "APPROVED",
          user?.skeapStatus,
          router,
          setShowVerificationModal,
          () => openApplicationModal(profile),
        );
      } else if (
        kkProfileStatus === "PENDING" ||
        kkProfileStatus === "PENDING VERIFICATION"
      ) {
        handleSkeapApply("PENDING", user?.skeapStatus, router, setShowVerificationModal);
      } else if (kkProfileStatus === "REJECTED") {
        handleSkeapApply("REJECTED", user?.skeapStatus, router, setShowVerificationModal);
      } else {
        setKkCheckError("Your KK profiling registration must be approved before you can apply for SKEAP.");
        setShowKkRequiredModal(true);
      }
    } catch (error) {
      if (!(error instanceof Error && error.message === "KK profile not found")) {
        console.error("Unable to load KK profile before SKEAP application:", error);
        setKkCheckUnavailable(true);
      }
      setShowKkRequiredModal(true);
    } finally {
      setCheckingKkProfile(false);
    }
  }

  async function handleApplyClick() {
    if (isApplying) return;
    if (currentSkeapEligibility === "barred") return;
    if (currentSkeapEligibility !== "eligible" && user) {
      setApplyError("SKEAP eligibility is still being verified. Please try again shortly.");
      return;
    }

    setIsApplying(true);
    setApplyError(null);
    try {
      if (!user) {
        setShowAuthRequiredModal(true);
        return;
      }

      await openApplyFlow();
    } catch (error) {
      console.error("Unable to start the SKEAP application:", error);
      setApplyError("Failed to verify eligibility. Please try again.");
    } finally {
      setIsApplying(false);
    }
  }

  useEffect(() => {
    prefetchProgramStatus(slug);
    if (!authLoading && !isSkeapTestAccount(user?.email)) prefetchKKProfile();
  }, [authLoading, slug, user?.email]);

  useEffect(() => {
    if (authLoading) return;
    const userEmail = user?.email;
    if (!userEmail) return;

    let active = true;
    fetch("/api/skeap/applications", { cache: "no-store", credentials: "same-origin" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result?.error || "Unable to verify SKEAP eligibility.");
        if (typeof result?.eligibility?.eligible !== "boolean") {
          throw new Error("SKEAP eligibility response is incomplete.");
        }
        if (active) {
          setEligibilityEmail(userEmail);
          setSkeapEligibility(result.eligibility.eligible ? "eligible" : "barred");
          setSkeapEligibilityMessage(
            result.eligibility.eligible ? null : result.eligibility.message,
          );
          setHasPriorRevocation(result.hasPriorRevocation === true);
          setInitialUploadedFiles(
            result.initialUploadedFiles && typeof result.initialUploadedFiles === "object"
              ? result.initialUploadedFiles
              : {},
          );
        }
      })
      .catch((error: unknown) => {
        console.error("Unable to verify SKEAP reapplication eligibility:", error);
        if (active) {
          setEligibilityEmail(userEmail);
          setSkeapEligibility("unavailable");
          setSkeapEligibilityMessage(null);
          setHasPriorRevocation(false);
          setInitialUploadedFiles({});
        }
      });

    return () => {
      active = false;
    };
  }, [authLoading, user?.email]);

  useEffect(() => {
    if (
      authLoading ||
      autoApplyHandled.current ||
      (isAuthenticated && currentSkeapEligibility === "unchecked")
    ) return;

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
  }, [authLoading, currentSkeapEligibility, isAuthenticated]);

  useEffect(() => {
    if (!open) return;
    let mounted = true;

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

  useEffect(() => {
    if (!showAuthRequiredModal) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowAuthRequiredModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showAuthRequiredModal]);

  const isOpen =
    (status?.label || "").toLowerCase().includes("open") ||
    (status?.badge || "").toLowerCase().includes("open");
  const isWaitlisted = waitlistStatus.isWaitlisted;
  const areSlotsFull = status?.remainingSlots === 0;
  const isCheckingSkeapEligibility =
    Boolean(user) && currentSkeapEligibility === "unchecked";
  const isApplyButtonBusy =
    authLoading || checkingKkProfile || isApplying || isCheckingSkeapEligibility;
  const applyButtonLabel = checkingKkProfile
    ? "Checking KK profile..."
    : isApplying
      ? "Opening application..."
      : authLoading
        ? "Checking account..."
        : isCheckingSkeapEligibility
          ? "Checking SKEAP eligibility..."
        : waitlistStatus.isCycleClosedAndFull
          ? "SKEAP cycle closed"
          : currentSkeapEligibility === "barred"
            ? "Not eligible for SKEAP"
            : waitlistStatus.isWaitlisted
              ? "Already on the waitlist"
            : currentSkeapEligibility === "unavailable"
              ? "Eligibility unavailable"
              : "Apply for SKEAP →";
  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <button
          type="button"
          onMouseEnter={() => {
            prefetchProgramStatus(slug);
            if (!authLoading && !isSkeapTestAccount(user?.email)) prefetchKKProfile();
          }}
          onClick={() => void handleApplyClick()}
          aria-busy={isApplyButtonBusy}
          disabled={
            checkingKkProfile ||
            isApplying ||
            authLoading ||
            isWaitlisted ||
            waitlistStatus.isCycleClosedAndFull ||
            (Boolean(user) && currentSkeapEligibility !== "eligible")
          }
          className="inline-flex min-w-[220px] items-center justify-center gap-2 rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_40px_rgba(15,23,42,0.16)] transition hover:bg-slate-800"
        >
          {isApplyButtonBusy ? <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {applyButtonLabel}
        </button>
        {currentSkeapEligibility === "barred" ? (
          <p role="alert" className="max-w-sm rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {skeapEligibilityMessage ||
              "You are permanently ineligible to reapply for SKEAP due to a prior conduct or disciplinary revocation."}
          </p>
        ) : null}
        {isWaitlisted ? (
          waitlistStatus.isCycleClosedAndFull ? (
            <section aria-label="Final SKEAP waitlist status" className="w-full max-w-sm rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-sm">
              <span className="inline-flex rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-bold tabular-nums text-slate-700">
                Final Queue Position: #{waitlistStatus.queuePosition ?? "—"}
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-800">
                Thank you for applying. The slots are already full and closed.
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-600">
                Your final position in the waitlist queue was #{waitlistStatus.queuePosition ?? "—"} of {waitlistStatus.totalWaitlisted}.
              </p>
            </section>
          ) : (
            <section aria-label="SKEAP waitlist status" className="w-full max-w-sm rounded-2xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
              <span className="inline-flex rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-bold tabular-nums text-amber-800">
                Queue Position: #{waitlistStatus.queuePosition ?? "—"}
              </span>
              <p className="mt-3 text-sm leading-relaxed text-amber-900">
                All slots are currently filled. You are <strong>#{waitlistStatus.queuePosition ?? "—"}</strong> in the waitlist queue, and we will notify you if a slot opens up.
              </p>
            </section>
          )
        ) : waitlistStatus.isCycleClosedAndFull ? (
          <p role="status" className="max-w-sm rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            The slots are already full and closed for this SKEAP cycle. Please check Application Status for updates.
          </p>
        ) : null}
        {currentSkeapEligibility === "unavailable" ? (
          <p role="alert" className="max-w-sm rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            We could not verify your SKEAP eligibility. Refresh the page to try again.
          </p>
        ) : null}
        {applyError ? (
          <p role="alert" className="max-w-[220px] text-sm text-rose-700">
            {applyError}
          </p>
        ) : null}
      </div>

      <VerificationModal
        open={showVerificationModal}
        onClose={() => setShowVerificationModal(false)}
        onCheckStatus={() => {
          setShowVerificationModal(false);
          router.push("/programs/kk-profiling/status");
        }}
      />

        <AccountRequiredModal
          open={showAuthRequiredModal}
          title="Account Required"
          description="You need a secure SKonnect account to apply for the SKEAP scholarship and track your status."
          nextPath="/programs/skeap"
          onClose={() => setShowAuthRequiredModal(false)}
        />

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
            ) : kkCheckUnavailable ? (
              <>
                <p className="text-xs uppercase tracking-[0.28em] text-amber-600">Temporarily unavailable</p>
                <h3 className="mt-2 text-3xl font-semibold text-slate-900">Unable to verify your KK profile</h3>
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  We couldn’t check your KK profile right now. Please try again in a moment.
                </p>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={() => setShowKkRequiredModal(false)}
                    className="rounded-full border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowKkRequiredModal(false);
                      void openApplyFlow();
                    }}
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                  >
                    Try again
                  </button>
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
              <div className="flex flex-1 flex-col items-center justify-center px-6 py-8 text-center sm:px-10">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-emerald-100 bg-emerald-50 shadow-sm">
                  <CheckCircle2 className="h-9 w-9 animate-in zoom-in duration-300 text-emerald-600" />
                </div>
                <span className="mb-1 text-[11px] font-bold uppercase tracking-widest text-emerald-600">
                  Success Confirmation
                </span>
                <h2 className="mb-2 text-xl font-black text-slate-900 sm:text-2xl">Application Submitted Successfully</h2>
                <p className="mb-5 max-w-md text-sm leading-relaxed text-slate-500">
                  Your application is now awaiting administrative review. After an admin pre-qualifies your digital documents, you will be notified to bring the original documents or Certified True Copies (CTCs) to Barangay Pico Hall for in-person verification. Check Application Status regularly—this is where you will receive review decisions, requests, and other updates.
                </p>
                <div className="flex w-full justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      router.push(`/applications/${encodeURIComponent(submittedReference)}`);
                      setOpen(false);
                    }}
                    className="mx-auto rounded-xl bg-emerald-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700"
                  >
                    View Application Status
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
                      areSlotsFull ? (
                        status.isCycleClosedAndFull ? (
                          <p>The SKEAP application cycle is closed. New waitlist applications are no longer being accepted.</p>
                        ) : (
                          <p>
                            All <strong className="font-bold text-slate-900">{status.maxSlots}</strong> slots are currently
                            filled. You can still apply to be placed on the waitlist, and we will contact you if new slots
                            open up.
                          </p>
                        )
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

                {(!status || isOpen) ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="text-sm font-semibold text-slate-900">Checklist before submit</p>
                    <div className="mt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                        Section A — Already on File via KK Profile (No Upload Needed)
                      </p>
                      <ul className="mt-3 space-y-3">
                        {[
                          ["Official SKEAP Application Form", "Auto-generated"],
                          ['2"×2" Latest I.D. Picture', "Attached from KK Profile"],
                          ["Birth Certificate", "Verified in KK Profile"],
                          ["Certificate of Residency", "Verified in KK Profile"],
                        ].map(([label, detail]) => (
                          <li key={label} className="flex items-start gap-2">
                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                            <span className="min-w-0 flex-1">
                              <span className="block text-xs font-medium leading-relaxed text-slate-700">{label}</span>
                              <span className="block text-[11px] leading-relaxed text-slate-500">{detail}</span>
                            </span>
                            <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-600/20">
                              On File (KK Profile)
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="mt-5 border-t border-slate-200 pt-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                        Section B — Required Digital Uploads for SKEAP
                      </p>
                      <ul className="mt-3 space-y-3">
                        {requiredDocuments.map((document) => (
                          <li key={document.key} className="flex items-start gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" aria-hidden="true" />
                            <span className="text-xs leading-relaxed text-slate-600">
                              <span>{document.label}</span>
                              {document.helperText ? (
                                <span className="mt-0.5 block text-[11px] text-slate-500">{document.helperText}</span>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
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
                ) : userProfile ? (
                  <SkeapApplicationWizard
                    educationLevel={educationLevel}
                    onEducationLevelChange={setEducationLevel}
                    initialActiveEducationLevels={initialActiveEducationLevels}
                    yearLevel={yearLevel}
                    onYearLevelChange={setYearLevel}
                    requiredDocuments={requiredDocuments}
                    footerActionsTarget={footerActionsTarget}
                    scrollContainerRef={scrollContainerRef}
                    userProfile={userProfile}
                    hasPriorRevocation={hasPriorRevocation}
                    initialUploadedFiles={initialUploadedFiles}
                    onEligibilityChange={handleEligibilityChange}
                    allowManualProfileDetails={isSkeapTestAccount(user?.email)}
                    onSubmitted={setSubmittedReference}
                  />
                ) : (
                  <div
                    role="alert"
                    className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm leading-6 text-rose-800"
                  >
                    Your profile details could not be loaded. Close this form and try again.
                  </div>
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
