import Link from "next/link";
import { hasGranteeColumn, prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  CheckCircle2,
  ClipboardList,
  Clock3,
  FileText,
  Mail,
  PencilLine,
  Sparkles,
  UserCheck,
  Wallet,
} from "lucide-react";
import ReturnedForEditCard from "./ReturnedForEditCard";
import GranteeWelcomeGate from "./GranteeWelcomeGate";
import AcademicJourneySetup from "./AcademicJourneySetup";
import { buildSemesterTracker } from "@/lib/semester-progress";
import {
  resolveScheduledJourneyStepStatus,
} from "@/lib/academic-journey";
import { getAcademicTermScheduleState } from "@/lib/academic-term-schedule";
import { buildGranteeActivity } from "@/lib/grantee-activity";
import { resolveGranteeAcademicTimeline, getScheduleSemesterForTargetTerm } from "@/lib/grantee-semester";
import { isGranteeDueForGraduation } from "@/lib/grantee-due-for-graduation";
import ExitClearanceSubmission from "./ExitClearanceSubmission";

export default async function GranteeDashboardContent() {
  const db = prisma;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await db.user.findFirst({
    where: {
      authId: user.id,
      isActive: true,
    },
    select: {
      id: true,
      role: true,
      fullName: true,
      avatarUrl: true,
      createdAt: true,
      hasSeenOnboarding: true,
      skeapApplications: {
        orderBy: { submittedAt: "desc" },
        take: 5,
        select: {
          id: true,
          status: true,
          submittedAt: true,
          updatedAt: true,
          gwa: true,
          enrollmentFileUrl: true,
          reportCardFileUrl: true,
          educationLevel: true,
          currentCourse: true,
          yearLevel: true,
        },
      },
    },
  });

  if (!appUser || appUser.role !== "GRANTEE") {
    redirect("/");
  }
  const [hasExitClearanceFileNameColumn, hasExitClearanceSubmittedAtColumn] = await Promise.all([
    hasGranteeColumn("exitClearanceFileName"),
    hasGranteeColumn("exitClearanceSubmittedAt"),
  ]);
  const grantee = await db.grantee.findFirst({
    where: {
      userId: appUser.id,
      status: { notIn: ["GRADUATED", "REVOKED"] },
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      status: true,
      yearLevel: true,
      entryAcademicYear: true,
      entrySemester: true,
      journeyStart: true,
      journeyEnd: true,
      dateEnrolled: true,
      exitClearanceStatus: true,
      exitClearanceUrl: true,
      graduationRemarks: true,
      ...(hasExitClearanceFileNameColumn ? { exitClearanceFileName: true } : {}),
      ...(hasExitClearanceSubmittedAtColumn ? { exitClearanceSubmittedAt: true } : {}),
      submissions: {
        orderBy: { submittedAt: "desc" },
      },
      payout: {
        select: {
          id: true,
          semester: true,
          amount: true,
          disbursedAt: true,
          claimedAt: true,
        },
      },
    },
  });
  if (!grantee || !["ACTIVE", "PROBATIONARY"].includes(grantee.status)) {
    redirect("/youth/dashboard");
  }

  let journeyPhotoUrl: string | undefined;
  if (appUser.avatarUrl) {
    if (/^https?:\/\//i.test(appUser.avatarUrl)) {
      journeyPhotoUrl = appUser.avatarUrl;
    } else {
      const { data, error } = await supabase.storage
        .from("avatars")
        .createSignedUrl(appUser.avatarUrl, 60 * 60 * 24 * 7);

      if (error) {
        console.warn("Unable to create a signed URL for the grantee avatar:", error.message);
      } else {
        journeyPhotoUrl = data.signedUrl;
      }
    }
  }

  const submissions = grantee.submissions;
  const payout = grantee.payout;
  const recentActivity = buildGranteeActivity(submissions, payout).slice(0, 4);
  const awaitingPhysicalCtcSubmission = submissions.find(
    (submission) => submission.status === "AWAITING_PHYSICAL_CTC",
  ) ?? null;
  const pendingCount = submissions.filter(
    (s) => s.status === "PENDING" || s.status === "AWAITING_PHYSICAL_CTC",
  ).length;
  const needsEditCount = submissions.filter((s) => s.status === "REJECTED" || s.status === "RETURNED_FOR_EDIT").length;

  const tracker = buildSemesterTracker(submissions);
  const now = new Date();
  const { schedules } = await getAcademicTermScheduleState(now);
  const academicTimeline = resolveGranteeAcademicTimeline(
    {
      ...grantee,
      skeapApplications: appUser.skeapApplications,
    },
    submissions,
    { schedules, now },
  );
  const detectedTerm = academicTimeline.targetTerm;
  const detectedSchedule = detectedTerm
    ? schedules.find((schedule) => schedule.semester === getScheduleSemesterForTargetTerm(detectedTerm)) ?? null
    : null;
  const journeyProgress = academicTimeline.journeyProgress;
  const isJourneyConfigured = Boolean(
    grantee.journeyStart && grantee.journeyEnd,
  ) || journeyProgress.nodes.length > 0;
  const isDueForGraduation = isGranteeDueForGraduation({
    status: grantee.status,
    journeyStart: grantee.journeyStart,
    journeyEnd: grantee.journeyEnd,
    currentStepSemester: journeyProgress.currentStepSemester,
    finalJourneySemester: journeyProgress.nodes.at(-1)?.semester ?? null,
  }, now);
  const approvedCount = journeyProgress.validatedSemesterIndexes.length;
  const normalizeScheduleSemester = (value: string) =>
    value.trim()
      .replace(/\b1st\s+Semester\b/i, "First Semester")
      .replace(/\b2nd\s+Semester\b/i, "Second Semester");
  const journeyNodes = journeyProgress.nodes.map((node) => {
    const matchingSchedule = schedules.find(
      (schedule) => normalizeScheduleSemester(schedule.semester) === normalizeScheduleSemester(node.semester),
    ) ?? null;
    const scheduleStatus: "open" | "future" | "closed" | "none" | null =
      node.status === "VALIDATED"
      ? null
      : matchingSchedule
        ? matchingSchedule.opensAt <= now && matchingSchedule.closesAt >= now
          ? "open"
          : matchingSchedule.opensAt > now
            ? "future"
            : "closed"
        : "none";

    return {
      ...node,
      scheduleStatus,
      scheduleOpensAt: matchingSchedule?.opensAt ?? null,
      submittedAt: node.submittedAt instanceof Date ? node.submittedAt.toISOString() : node.submittedAt,
      approvedAt: node.approvedAt instanceof Date ? node.approvedAt.toISOString() : node.approvedAt,
      gradeReportUrl: node.submissionId && node.gradeReportUrl
        ? `/api/submissions/${node.submissionId}/file?kind=grade`
        : null,
      coeFileUrl: node.submissionId && node.coeFileUrl
        ? `/api/submissions/${node.submissionId}/file?kind=coe`
        : null,
    };
  });
  const currentStepSchedule = schedules.find(
    (schedule) => schedule.semester === journeyProgress.currentStepSemester,
  ) ?? null;
  const currentStepStatus = resolveScheduledJourneyStepStatus(
    journeyProgress.currentStepStatus,
    currentStepSchedule,
    now,
  );
  const isTermOpen = Boolean(
    detectedSchedule && detectedSchedule.opensAt <= now && detectedSchedule.closesAt >= now
  );
  const canReplacePendingSubmission = Boolean(detectedTerm?.canReplacePendingSubmission);
  const isPendingSubmissionLocked = Boolean(
    detectedTerm?.hasPendingSubmission && !canReplacePendingSubmission
  );
  const targetDateLabel = isPendingSubmissionLocked
    ? "Under SK Admin Review"
    : canReplacePendingSubmission
      ? isTermOpen ? "Replace files before review starts" : "Submission window closed"
    : detectedTerm?.isResubmission
      ? "Corrections may be uploaded now"
      : detectedSchedule
        ? new Intl.DateTimeFormat("en-PH", {
            dateStyle: "long",
            timeStyle: "short",
            timeZone: "Asia/Manila",
          }).format(isTermOpen ? detectedSchedule.closesAt : detectedSchedule.opensAt)
        : "—";
  const needsAction = Boolean(
    awaitingPhysicalCtcSubmission || (detectedTerm && (isTermOpen || detectedTerm.isResubmission)),
  );
  const requirementStatusLabel = awaitingPhysicalCtcSubmission
    ? "PHYSICAL DOCUMENTS REQUIRED"
    : detectedTerm?.hasPendingSubmission
    ? canReplacePendingSubmission ? "SUBMITTED · EDITABLE" : "UNDER SK ADMIN REVIEW"
    : detectedTerm?.isResubmission
      ? "CORRECTION REQUIRED"
      : isTermOpen
        ? "ACTION REQUIRED"
        : "NEXT UP";
  const requirementPrompt = awaitingPhysicalCtcSubmission
    ? `Your digital documents for ${awaitingPhysicalCtcSubmission.semester} passed pre-check. Submit the physical Original / CTC at the SK Office for final approval.`
    : detectedTerm?.hasPendingSubmission
    ? canReplacePendingSubmission
      ? `Your ${detectedTerm.termLabel} submission is waiting for initial review. You may replace files while the submission window is open.`
      : `Your ${detectedTerm.termLabel} submission is under SK Admin review.`
    : detectedTerm?.isResubmission
      ? `Please upload the requested corrections for ${detectedTerm.termLabel}.`
      : detectedTerm
        ? isTermOpen
          ? `Prepare and submit your requirements for ${detectedTerm.termLabel} before the deadline.`
          : `Gather your requirements for ${detectedTerm.termLabel}. The submission window opens soon.`
        : "There are currently no active or scheduled submission windows.";
  const targetDateHeading = awaitingPhysicalCtcSubmission || detectedTerm?.hasPendingSubmission
    ? "SUBMISSION STATUS"
    : detectedTerm?.isResubmission
      ? "CORRECTION STATUS"
      : detectedSchedule && !isTermOpen
        ? "SUBMISSIONS OPEN ON"
        : "DEADLINE DATE & TIME";

  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50/50 to-slate-100/50 text-slate-900">
      <GranteeWelcomeGate initialShouldShow={!appUser.hasSeenOnboarding} />
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <section className="grantee-dashboard-enter relative">
          <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-gradient-to-br from-sky-400/30 via-cyan-300/20 to-transparent blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-gradient-to-tr from-indigo-400/20 via-blue-300/10 to-transparent blur-3xl" />

          <div className="relative grid grid-cols-1 gap-8 py-5 lg:grid-cols-[1.4fr_1fr] lg:gap-12 lg:py-8">
            <div className="flex flex-col justify-center">
              <div className="inline-flex w-fit items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-600 backdrop-blur">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                Grantee Dashboard Active
              </div>

              <h1 className="mt-5 text-4xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
                Your semester{" "}
                <span className="bg-gradient-to-r from-sky-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
                  beautifully organized.
                </span>
              </h1>

              <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-600">
                Track approvals and return-for-edit requests, see your next required action, and stay informed on SK announcements.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-4">
                <Link
                  href="/grantee-dashboard/documents"
                  className="group inline-flex items-center gap-2 rounded-full bg-[#0B132B] px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
                >
                  <ClipboardList className="h-4 w-4" />
                  Open requirements
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/grantee-dashboard/payouts"
                  className="inline-flex items-center rounded-full border border-slate-300 bg-transparent px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Check Payout Status
                </Link>
              </div>

            </div>

            <div className="relative">
              <div className="relative min-h-[234px] overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-7 text-white shadow-xl">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-500/20 blur-3xl" />
                <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="relative">
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider border backdrop-blur-sm shadow-sm ${
                    needsAction || detectedTerm?.hasPendingSubmission
                      ? "bg-amber-400/10 text-amber-300 border-amber-500/20"
                      : "border-white/15 bg-white/10 text-cyan-100"
                  }`}>
                    <Sparkles className={`h-3 w-3 ${needsAction || detectedTerm?.hasPendingSubmission ? "text-amber-400" : "text-cyan-200"}`} />
                    {requirementStatusLabel}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                    {detectedTerm
                      ? `${detectedTerm.schoolYear} · ${detectedTerm.semester}`
                      : "No Upcoming Submissions"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {requirementPrompt}
                  </p>

                  <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {targetDateHeading}
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-white">
                        {awaitingPhysicalCtcSubmission
                          ? "Original / CTC required for final approval"
                          : targetDateLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {awaitingPhysicalCtcSubmission ? (
          <section
            role="status"
            className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-bold text-amber-950 sm:text-base">
                    Action Required: Submit Original / CTC at SK Office
                  </h2>
                  <p className="mt-1.5 max-w-3xl text-xs leading-relaxed text-amber-900">
                    Your digital upload for {awaitingPhysicalCtcSubmission.semester} passed the initial pre-check.
                    Full approval will be granted once you submit the physical Certified True Copy (CTC) or
                    original documents to the SK Council at the Barangay Pico SK Office.
                  </p>
                </div>
              </div>
              <Link
                href="/grantee-dashboard/documents"
                className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-700 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-amber-800"
              >
                View requirements
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </section>
        ) : null}

        <section className="grantee-dashboard-enter grantee-dashboard-enter-stats mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-4 md:divide-x md:divide-y-0">
            <StatCard
              icon={<Clock3 className="h-4 w-4" />}
              label="Pending review"
              value={pendingCount}
              note="Waiting for SK/admin verification"
              tint="bg-amber-50 text-amber-700 ring-amber-200"
            />
            <StatCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              label="Approved"
              value={approvedCount}
              note="Successfully validated semesters"
              tint="bg-emerald-50 text-emerald-700 ring-emerald-200"
            />
            <ProgressCard
              icon={<CalendarCheck className="h-4 w-4" />}
              label="Current semester progress"
              approved={tracker.approved}
              total={tracker.total}
              pct={tracker.pct}
            />
            <ReturnedForEditCard count={needsEditCount} className="h-full" />
          </div>
        </section>

        <section id="academic-journey" className="grantee-dashboard-enter grantee-dashboard-enter-activity mt-8 scroll-mt-8">
          <AcademicJourneySetup
            journeyConfigured={isJourneyConfigured}
            journeyStart={grantee.journeyStart ?? null}
            journeyEnd={grantee.journeyEnd ?? null}
            mapProps={{
              studentName: appUser.fullName,
              photoUrl: journeyPhotoUrl,
              currentSemesterIndex: journeyProgress.currentSemesterIndex,
              validatedSemesterIndexes: journeyProgress.validatedSemesterIndexes,
              eligibleSemesterCount: journeyProgress.totalRequiredSemesters,
              journeyNodes,
              currentStepStatus,
              currentStepOpensAt:
                currentStepSchedule && now < currentStepSchedule.opensAt
                  ? currentStepSchedule.opensAt.toISOString()
                  : null,
            }}
          />
        </section>

        <section className="grantee-dashboard-enter grantee-dashboard-enter-activity mt-8 grid grid-cols-1 items-stretch gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Quick actions</h2>
                <p className="mt-1 text-sm text-slate-500">Jump straight into what matters this week.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Workspace
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mt-4">
              <Link
                className="flex items-start gap-3 p-3.5 border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all group"
                href="/grantee-dashboard/documents"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-700 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-xs font-bold text-slate-900 truncate">
                      Submit requirements
                    </h4>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">
                    {detectedTerm
                      ? `${detectedTerm.schoolYear} · ${detectedTerm.semester}${isPendingSubmissionLocked ? " · Under SK Admin Review" : canReplacePendingSubmission ? " · Editable before review" : ""}`
                      : "Upload files and track approvals."}
                  </p>
                </div>
              </Link>

              <Link
                className="flex items-start gap-3 p-3.5 border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all group"
                href="/grantee-dashboard/payouts"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-700 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <Wallet className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-xs font-bold text-slate-900 truncate">Payout status</h4>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">Check allowance eligibility and schedule.</p>
                </div>
              </Link>

              <Link
                className="flex items-start gap-3 p-3.5 border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all group"
                href="/grantee-dashboard/profile"
              >
                <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <UserCheck className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-xs font-bold text-slate-900 truncate">Update Profile</h4>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">Keep your profiling data current.</p>
                </div>
              </Link>

              <Link
                className="flex items-start gap-3 p-3.5 border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all group"
                href="/grantee-dashboard/support"
              >
                <div className="w-8 h-8 rounded-lg bg-indigo-700 flex items-center justify-center text-white shrink-0 group-hover:scale-105 transition-transform">
                  <Mail className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between mb-0.5">
                    <h4 className="text-xs font-bold text-slate-900 truncate">Contact support</h4>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">Review your requests and replies.</p>
                </div>
              </Link>
            </div>
            <ExitClearanceSubmission
              initialStatus={grantee.exitClearanceStatus}
              initialUrl={grantee.exitClearanceUrl}
              initialRemarks={grantee.graduationRemarks}
              initialFileName={
                "exitClearanceFileName" in grantee ? grantee.exitClearanceFileName : null
              }
              initialSubmittedAt={
                "exitClearanceSubmittedAt" in grantee
                  ? grantee.exitClearanceSubmittedAt?.toISOString() ?? null
                  : null
              }
              isDueForGraduation={isDueForGraduation}
            />
          </div>

          <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Recent activity</h2>
              <Link
                href="/grantee-dashboard/activity"
                className="text-xs font-medium text-slate-500 transition-colors hover:text-slate-900 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-600 focus-visible:ring-offset-2"
              >
                View all {"->"}
              </Link>
            </div>
            <div className="mt-1 flex flex-1 flex-col justify-start">
              <ol className="space-y-4">
                {recentActivity.map((activity, i, arr) => {
                  const toneClasses = {
                    approved: "bg-emerald-100 text-emerald-700",
                    attention: "bg-rose-100 text-rose-700",
                    pending: "bg-sky-100 text-sky-700",
                    confirmed: "bg-emerald-100 text-emerald-700",
                  }[activity.kind];
                  return (
                    <li key={activity.id} className="flex gap-3">
                      <div className="relative flex flex-col items-center">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white ${toneClasses}`}>
                          {activity.kind === "approved" || activity.kind === "confirmed" ? (
                            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                          ) : activity.kind === "attention" ? (
                            <PencilLine className="h-4 w-4" aria-hidden="true" />
                          ) : (
                            <Clock3 className="h-4 w-4" aria-hidden="true" />
                          )}
                        </div>
                        {i < arr.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-slate-200" />}
                      </div>
                      <div className="min-w-0 pb-2">
                        <div className="truncate text-sm font-medium text-slate-900">{activity.label}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {activity.date.toLocaleDateString("en-PH", { dateStyle: "medium", timeZone: "Asia/Manila" })}
                          {activity.detail ? ` · ${activity.detail}` : ""}
                        </div>
                      </div>
                    </li>
                  );
                })}
                {recentActivity.length === 0 && (
                  <li className="text-sm text-slate-500">No activity yet. Your submissions and payout updates will appear here.</li>
                )}
              </ol>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  note,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
  tint: string;
}) {
  return (
    <div className="relative min-h-[160px] p-5">
      <div className="relative flex items-center justify-between">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ${tint}`}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      </div>
      <div className="relative mt-4 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="relative mt-1 text-xs text-slate-500">{note}</div>
    </div>
  );
}

function ProgressCard({
  icon,
  label,
  approved,
  total,
  pct,
}: {
  icon: React.ReactNode;
  label: string;
  approved: number;
  total: number;
  pct: number;
}) {
  return (
    <div className="relative min-h-[160px] p-5">
      <div className="relative flex items-center justify-between">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-slate-900">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      </div>
      <div className="relative mt-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-3xl font-semibold tracking-tight text-slate-900">{approved}/{total}</p>
            <p className="text-xs text-slate-500">Approved this semester</p>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-indigo-600 transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
