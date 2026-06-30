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
  Megaphone,
  PencilLine,
  Sparkles,
} from "lucide-react";

export default async function GranteeOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findFirst({
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
      registrations: {
        include: {
          event: {
            select: {
              id: true,
              title: true,
              eventDate: true,
            },
          },
        },
      },
    },
  });

  if (appUser && appUser.authId !== user.id) {
    try {
      await prisma.user.update({
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

  const submissions = appUser.grantee?.submissions ?? [];
  const pendingCount = submissions.filter((s) => s.status === "PENDING").length;
  const approvedCount = submissions.filter((s) => s.status === "APPROVED").length;
  const needsEditCount = submissions.filter((s) => s.status === "REJECTED").length;

  const upcomingRegistered = appUser.registrations
    .filter((r) => new Date(r.event.eventDate) >= new Date())
    .sort((a, b) => new Date(a.event.eventDate).getTime() - new Date(b.event.eventDate).getTime());

  const nextEvent = upcomingRegistered[0]?.event;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10 lg:py-14">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_24px_60px_-30px_rgba(15,23,42,0.18)]">
          <div className="pointer-events-none absolute -right-32 -top-32 h-80 w-80 rounded-full bg-gradient-to-br from-sky-400/30 via-cyan-300/20 to-transparent blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-gradient-to-tr from-indigo-400/20 via-blue-300/10 to-transparent blur-3xl" />

          <div className="relative grid grid-cols-1 gap-8 p-8 lg:grid-cols-[1.4fr_1fr] lg:gap-12 lg:p-12">
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
                Track approvals and return-for-edit requests, see your next required action, and stay updated on SK events.
              </p>

              <div className="mt-7 flex flex-wrap items-center gap-3">
                <Link
                  href="/grantee-dashboard/documents"
                  className="group inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800"
                >
                  <ClipboardList className="h-4 w-4" />
                  Open requirements
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="/grantee-dashboard/events"
                  className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                >
                  <CalendarCheck className="h-4 w-4" />
                  Open events
                </Link>
              </div>

            </div>

            <div className="relative">
              <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-sky-950 p-7 text-white shadow-xl">
                <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky-500/20 blur-3xl" />
                <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-cyan-400/10 blur-3xl" />
                <div className="relative">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-100 ring-1 ring-inset ring-white/15">
                    <Sparkles className="h-3 w-3" />
                    Next up
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold tracking-tight">
                    {nextEvent?.title ?? "No upcoming events"}
                  </h3>
                  <p className="mt-2 text-sm text-slate-300">
                    {nextEvent
                      ? "You're registered and all set."
                      : "Browse events to register for one."}
                  </p>

                  <div className="mt-6 flex items-center justify-between rounded-xl border border-white/10 bg-white/5 p-3 backdrop-blur">
                    <div>
                      <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Event date
                      </div>
                      <div className="mt-0.5 text-sm font-medium text-white">
                        {nextEvent
                          ? new Date(nextEvent.eventDate).toLocaleString(undefined, {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "-"}
                      </div>
                    </div>
                    <Link
                      href="/grantee-dashboard/events"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-white text-slate-900 transition hover:bg-slate-100"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            icon={<Clock3 className="h-4 w-4" />}
            label="Pending review"
            value={pendingCount}
            note="Waiting for SK/admin verification"
            accent="from-amber-400 to-orange-500"
            tint="bg-amber-50 text-amber-700 ring-amber-200"
          />
          <StatCard
            icon={<CheckCircle2 className="h-4 w-4" />}
            label="Approved"
            value={approvedCount}
            note="Successfully validated semesters"
            accent="from-emerald-400 to-teal-500"
            tint="bg-emerald-50 text-emerald-700 ring-emerald-200"
          />
          <StatCard
            icon={<PencilLine className="h-4 w-4" />}
            label="Needs editing"
            value={needsEditCount}
            note="Returned with notes to revise"
            accent="from-rose-400 to-pink-500"
            tint="bg-rose-50 text-rose-700 ring-rose-200"
          />
          <StatCard
            icon={<CalendarCheck className="h-4 w-4" />}
            label="Upcoming events"
            value={upcomingRegistered.length}
            note="Registrations with future schedule"
            accent="from-sky-400 to-indigo-500"
            tint="bg-sky-50 text-sky-700 ring-sky-200"
          />
        </section>

        <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
          <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-900">Quick actions</h2>
                <p className="mt-1 text-sm text-slate-500">Jump straight into what matters this week.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                Workspace
              </span>
            </div>
            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <ActionTile
                href="/grantee-dashboard/documents"
                icon={<FileText className="h-4 w-4" />}
                title="Submit requirements"
                description="Upload semester files and track approvals."
              />
              <ActionTile
                href="/grantee-dashboard/events"
                icon={<CalendarCheck className="h-4 w-4" />}
                title="Browse events"
                description="Register for upcoming SK community events."
              />
              <ActionTile
                href="/grantee-dashboard/documents"
                icon={<PencilLine className="h-4 w-4" />}
                title="Resolve revisions"
                description="Address returned items with admin notes."
              />
              <ActionTile
                href="/grantee-dashboard/announcements"
                icon={<Megaphone className="h-4 w-4" />}
                title="Read announcements"
                description="Catch official updates and scholarship notices."
              />
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200/80 bg-white p-7 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">Recent activity</h2>
              <Link href="/grantee-dashboard/documents" className="text-xs font-medium text-slate-500 hover:text-slate-900">
                View all {"->"}
              </Link>
            </div>
            <ol className="mt-6 space-y-4">
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
  accent,
  tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  note: string;
  accent: string;
  tint: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition hover:shadow-md">
      <div className={`absolute -right-10 -top-10 h-28 w-28 rounded-full bg-gradient-to-br ${accent} opacity-10 blur-2xl transition group-hover:opacity-20`} />
      <div className="relative flex items-center justify-between">
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset ${tint}`}>{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</span>
      </div>
      <div className="relative mt-4 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      <div className="relative mt-1 text-xs text-slate-500">{note}</div>
    </div>
  );
}

function ActionTile({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href} className="group relative flex items-start gap-3 overflow-hidden rounded-2xl border border-[#0F3D5C]/15 bg-gradient-to-br from-white to-[#F6FBFF] p-4 transition hover:border-[#0F3D5C]/35 hover:from-[#F9FCFF] hover:to-white hover:shadow-md">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F3D5C] to-[#00B4E5] text-white shadow-sm">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <ArrowUpRight className="h-3.5 w-3.5 text-[#0F3D5C]/45 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-[#0F3D5C]" />
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{description}</p>
      </div>
    </Link>
  );
}
