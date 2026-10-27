import Link from "next/link";
import { prisma } from "@/lib/prisma";
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
import { buildSemesterTracker } from "@/lib/semester-progress";
import {
  getAcademicJourneyProgress,
  resolveScheduledJourneyStepStatus,
} from "@/lib/academic-journey";
import AcademicJourneyMap from "@/app/components/AcademicJourneyMap";
import { getAcademicTermScheduleState, getAcademicTermDeadlineTarget } from "@/lib/academic-term-schedule";

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
      OR: [{ authId: user.id }, { email: user.email ?? "" }],
    },
    include: {
      grantee: {
        include: {
          submissions: {
            orderBy: { submittedAt: "desc" },
          },
        },
      },
    },
  });

  if (appUser && appUser.authId !== user.id) {
    try {
      await db.user.update({
        where: { id: appUser.id },
        data: { authId: user.id },
      });
    } catch {
      // Ignore relink failures and continue with fetched account data.
    }
  }

  if (!appUser || appUser.role !== "GRANTEE") {
    redirect("/login");
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

  const submissions = appUser.grantee?.submissions ?? [];
  const pendingCount = submissions.filter((s) => s.status === "PENDING").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const needsEditCount = submissions.filter((s) => s.status === "REJECTED" || s.status === "RETURNED_FOR_EDIT").length;

  const tracker = buildSemesterTracker(submissions);
  const now = new Date();
  const { schedules } = await getAcademicTermScheduleState(now);
  const targetTerm = getAcademicTermDeadlineTarget(schedules, now);
  const journeyProgress = getAcademicJourneyProgress(
    submissions,
    appUser.grantee?.dateEnrolled ?? appUser.createdAt,
    now,
    4,
    targetTerm?.semester ?? undefined,
  );
  const currentStepSchedule = schedules.find(
    (schedule) => schedule.semester === journeyProgress.currentStepSemester,
  ) ?? null;
  const currentStepStatus = resolveScheduledJourneyStepStatus(
    journeyProgress.currentStepStatus,
    currentStepSchedule,
    now,
  );
  const isTermOpen = Boolean(
    targetTerm && targetTerm.opensAt <= now && targetTerm.closesAt >= now
  );
  const targetDateLabel = targetTerm
    ? new Intl.DateTimeFormat("en-PH", {
        dateStyle: "long",
        timeStyle: "short",
        timeZone: "Asia/Manila",
      }).format(isTermOpen ? targetTerm.closesAt : targetTerm.opensAt)
    : "—";

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
                  <div className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ring-1 ring-inset ${
                    isTermOpen
                      ? "bg-rose-500/20 text-rose-200 ring-rose-200/20"
                      : "bg-white/10 text-cyan-100 ring-white/15"
                  }`}>
                    <Sparkles className="h-3 w-3" />
                    {targetTerm ? (isTermOpen ? "ACTION REQUIRED" : "NEXT UP") : "NEXT UP"}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                    {targetTerm
                      ? `${targetTerm.semester} ${isTermOpen ? "Deadline" : "Upcoming"}`
                      : "No Upcoming Submissions"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {targetTerm
                      ? isTermOpen
                        ? `Prepare and submit your requirements for ${targetTerm.semester} before the deadline.`
                        : `Gather your requirements for ${targetTerm.semester}. The submission window opens soon.`
                      : "There are currently no active or scheduled submission windows."}
                  </p>

                  <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        {targetTerm && !isTermOpen ? "SUBMISSIONS OPEN ON" : "DEADLINE DATE & TIME"}
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-white">
                        {targetDateLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

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

        <section className="grantee-dashboard-enter grantee-dashboard-enter-activity mt-8">
          <AcademicJourneyMap
            studentName={appUser.fullName}
            photoUrl={journeyPhotoUrl}
            currentSemesterIndex={journeyProgress.currentSemesterIndex}
            validatedSemesterIndexes={journeyProgress.validatedSemesterIndexes}
            currentStepStatus={currentStepStatus}
            currentStepOpensAt={
              currentStepSchedule && now < currentStepSchedule.opensAt
                ? currentStepSchedule.opensAt.toISOString()
                : null
            }
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
                    <h4 className="text-xs font-bold text-slate-900 truncate">Submit requirements</h4>
                    <ArrowUpRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-slate-600 shrink-0" />
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight line-clamp-2">Upload files and track approvals.</p>
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
          </div>

          <div className="flex h-full flex-col rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_2px_10px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Recent activity</h2>
              <Link href="/grantee-dashboard/documents" className="text-xs font-medium text-slate-500 hover:text-slate-900">
                View all {"->"}
              </Link>
            </div>
            <div className="mt-1 flex flex-1 flex-col justify-start">
              <ol className="space-y-4">
                {submissions.slice(0, 4).map((s, i, arr) => {
                  const tone = s.status === "APPROVED" ? "approved" : s.status === "REJECTED" ? "edit" : "event";
                  return (
                    <li key={s.id} className="flex gap-3">
                      <div className="relative flex flex-col items-center">
                        <div
                          className={
                            "flex h-8 w-8 items-center justify-center rounded-full ring-4 ring-white " +
                            (tone === "approved"
                              ? "bg-emerald-100 text-emerald-700"
                              : tone === "edit"
                              ? "bg-rose-100 text-rose-700"
                              : "bg-sky-100 text-sky-700")
                          }
                        >
                          {tone === "approved" ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : tone === "edit" ? (
                            <PencilLine className="h-4 w-4" />
                          ) : (
                            <Clock3 className="h-4 w-4" />
                          )}
                        </div>
                        {i < arr.length - 1 && <div className="mt-1 h-full w-px flex-1 bg-slate-200" />}
                      </div>
                      <div className="pb-2">
                        <div className="text-sm font-medium text-slate-900">Submission · {s.status.toLowerCase()}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{new Date(s.submittedAt).toLocaleDateString()}</div>
                      </div>
                    </li>
                  );
                })}
                {submissions.length === 0 && (
                  <li className="text-sm text-slate-500">No activity yet. Start by submitting your first requirement.</li>
                )}
              </ol>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 px-2 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">{label}</div>
      <div className="mt-0.5 text-base font-semibold text-white">{value}</div>
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
