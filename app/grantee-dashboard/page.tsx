import Link from "next/link";
import { DashboardHeaderActions } from "@/app/components/DashboardHeaderActions";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function GranteeDashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const appUser = await prisma.user.findUnique({
    where: { authId: user.id },
    include: {
      grantee: {
        include: {
          submissions: {
            where: { status: "PENDING" },
          },
        },
      },
    },
  });

  if (!appUser || appUser.role !== "GRANTEE") {
    try {
      await supabase.auth.signOut();
    } catch (e) {}
    redirect("/login");
  }

  const grantee = appUser.grantee;

  // Get upcoming events (UPCOMING or REGISTRATION_OPEN)
  const upcomingEvents = await prisma.event.findMany({
    where: {
      status: {
        in: ["UPCOMING", "REGISTRATION_OPEN"],
      },
    },
  });

  const pendingDocuments = grantee?.submissions.length ?? 0;
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      <header className="sticky top-0 z-50 border-b border-white/50 bg-gradient-to-b from-[#FAFBFC]/95 to-[#F5F7FB]/90 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F3D5C] to-[#0D2E47] shadow-lg text-xs font-black tracking-tighter text-white">
              SK
            </div>
            <span className="text-xl font-black tracking-tight text-[#0F3D5C]">SKonnect</span>
          </Link>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <Link href="#overview" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Overview</Link>
            <Link href="#documents" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Documents</Link>
            <Link href="#events" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Events</Link>
          </nav>
          <DashboardHeaderActions requiredRole="GRANTEE" />
        </div>
      </header>

      <main className="relative overflow-hidden pt-14 pb-20">
        <div className="absolute top-24 right-0 w-96 h-96 bg-gradient-to-br from-[#0F3D5C]/10 to-[#00B4E5]/5 rounded-full blur-3xl -z-10"></div>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-[1.25fr_0.85fr] items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                <span className="w-2 h-2 bg-[#0F3D5C] rounded-full"></span>
                Grantee Dashboard
              </div>
              <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight bg-gradient-to-r from-[#0F3D5C] via-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                Your scholarship progress, events, and reminders in one place.
              </h1>
              <p className="text-xl text-[#555555] max-w-2xl leading-relaxed">
                Track your SKEAP tasks, submit supporting documents, and register for youth programs while staying updated with clear next steps.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4">
                <a href="#documents" className="group px-8 py-4 bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] text-white font-bold rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2">
                  View required documents
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </a>
                <a href="#events" className="px-8 py-4 border-2 border-[#0F3D5C]/30 text-[#0F3D5C] font-bold rounded-xl hover:border-[#0F3D5C] hover:bg-[#0F3D5C]/5 transition-all duration-300">
                  Browse events
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white/80 p-10 shadow-xl backdrop-blur-xl">
              <div className="mb-6 rounded-3xl bg-gradient-to-r from-[#0F3D5C] to-[#00B4E5] p-8 text-white shadow-lg">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-200">Welcome back, Grantee</p>
                <h2 className="mt-4 text-3xl font-black">Next action</h2>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  Upload your latest grades or check your upcoming event registrations to stay on track.
                </p>
              </div>
              <div className="space-y-4">
                <StatCard 
                  title="Required documents" 
                  value={pendingDocuments > 0 ? `${pendingDocuments} pending` : "All complete"} 
                  note={pendingDocuments > 0 ? "Upload missing items before the deadline." : "Great job! All required documents have been submitted."} 
                />
                <StatCard 
                  title="Upcoming events" 
                  value={upcomingEvents.length.toString()} 
                  note={upcomingEvents.length > 0 ? "Open registration closes soon." : "No upcoming events at this time."} 
                />
              </div>
            </div>
          </div>

          <section id="documents" className="mt-24">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                Submission overview
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                Required documents and next steps
              </h2>
            </div>
            {grantee && grantee.submissions.length > 0 ? (
              <div className="grid gap-6 lg:grid-cols-3">
                {grantee.submissions.map((submission) => (
                  <InfoCard 
                    key={submission.id}
                    title={`Semester: ${submission.semester}`}
                    value="Pending review"
                    description={`Submitted on ${submission.submittedAt.toLocaleDateString()}. Awaiting admin review.`}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 text-center shadow-sm">
                <p className="text-lg text-[#555555]">
                  {grantee
                    ? "No pending submissions at this time. Great job staying on track!"
                    : "Your grantee profile is not set up yet. Please contact the SK office so your scholarship record can be linked to this account."}
                </p>
              </div>
            )}
          </section>

          <section id="events" className="mt-24 pb-16">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                Youth programs
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                Register and stay ready for every event
              </h2>
            </div>
            {upcomingEvents.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2">
                {upcomingEvents.map((event) => (
                  <ProgramCard 
                    key={event.id}
                    title={event.title}
                    description={event.description}
                    badge={event.status === "REGISTRATION_OPEN" ? "Open" : "Upcoming"}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 text-center shadow-sm">
                <p className="text-lg text-[#555555]">No upcoming events at this time. Check back soon!</p>
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}

function StatCard({ title, value, note }: { title: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border border-[#0F3D5C]/10 bg-white p-6 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.22em] text-[#0F3D5C]/70">{title}</p>
      <p className="mt-4 text-4xl font-black text-[#0F3D5C]">{value}</p>
      <p className="mt-3 text-sm leading-6 text-[#5F6F84]">{note}</p>
    </div>
  );
}

function InfoCard({ title, value, description }: { title: string; value: string; description: string }) {
  return (
    <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[#0F3D5C]/70">{title}</p>
      <p className="mt-4 text-3xl font-black text-[#0F3D5C]">{value}</p>
      <p className="mt-4 text-sm leading-6 text-[#555555]">{description}</p>
    </div>
  );
}

function ProgramCard({ title, description, badge }: { title: string; description: string; badge: string }) {
  return (
    <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-gradient-to-br from-white to-[#F5F7FB] p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xl font-bold text-[#0F3D5C]">{title}</p>
          <p className="mt-3 text-sm leading-6 text-[#555555]">{description}</p>
        </div>
        <span className="rounded-full bg-[#0F3D5C] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">{badge}</span>
      </div>
    </div>
  );
}
