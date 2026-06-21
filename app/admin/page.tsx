import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DashboardHeaderActions } from "@/app/components/DashboardHeaderActions";

export default async function SKOfficialDashboardPage() {
  const [grantees, openInquiryCount, upcomingEventCount, pendingSubmissionCount, upcomingEvents, recentInquiries] =
    await Promise.all([
      prisma.grantee.findMany({
        take: 6,
        orderBy: { updatedAt: "desc" },
        include: { user: true },
      }),
      prisma.inquiry.count({
        where: { isResolved: false },
      }),
      prisma.event.count({
        where: {
          status: {
            in: ["UPCOMING", "REGISTRATION_OPEN"],
          },
        },
      }),
      prisma.submission.count({
        where: { status: "PENDING" },
      }),
      prisma.event.findMany({
        take: 4,
        orderBy: { eventDate: "asc" },
        where: {
          status: {
            in: ["UPCOMING", "REGISTRATION_OPEN"],
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          venue: true,
          eventDate: true,
          status: true,
          filledSlots: true,
          maxSlots: true,
        },
      }),
      prisma.inquiry.findMany({
        take: 4,
        orderBy: { createdAt: "desc" },
        where: { isResolved: false },
        select: {
          id: true,
          subject: true,
          message: true,
          createdAt: true,
          language: true,
          user: {
            select: {
              fullName: true,
              email: true,
            },
          },
        },
      }),
    ]);

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
            <Link href="#events" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Events</Link>
            <Link href="#inquiries" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Inquiries</Link>
          </nav>
          <DashboardHeaderActions />
        </div>
      </header>

      <main className="relative overflow-hidden pt-14 pb-20">
        <div className="absolute top-24 right-0 w-96 h-96 bg-gradient-to-br from-[#0F3D5C]/10 to-[#00B4E5]/5 rounded-full blur-3xl -z-10"></div>
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-12 lg:grid-cols-[1.25fr_0.85fr] items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                <span className="w-2 h-2 bg-[#0F3D5C] rounded-full"></span>
                SK Official Dashboard
              </div>
              <h1 className="text-5xl md:text-6xl font-black leading-[1.05] tracking-tight bg-gradient-to-r from-[#0F3D5C] via-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                Manage events, inquiries, and youth records with clarity.
              </h1>
              <p className="text-xl text-[#555555] max-w-2xl leading-relaxed">
                Review registrations, answer helpdesk inquiries, and keep Barangay Pico programs running smoothly from one dashboard.
              </p>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4">
                <a href="#events" className="group px-8 py-4 bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] text-white font-bold rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2">
                  Manage events
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </a>
                <a href="#inquiries" className="px-8 py-4 border-2 border-[#0F3D5C]/30 text-[#0F3D5C] font-bold rounded-xl hover:border-[#0F3D5C] hover:bg-[#0F3D5C]/5 transition-all duration-300">
                  Answer inquiries
                </a>
              </div>
            </div>

            <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white/80 p-10 shadow-xl backdrop-blur-xl">
              <div className="mb-6 rounded-3xl bg-gradient-to-r from-[#0F3D5C] to-[#00B4E5] p-8 text-white shadow-lg">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-200">Action center</p>
                <h2 className="mt-4 text-3xl font-black">Ready for the next review</h2>
                <p className="mt-3 text-sm leading-6 text-slate-200">
                  See event registrations, pending inquiries, and the latest youth engagement metrics at a glance.
                </p>
              </div>
              <div className="space-y-4">
                <StatCard title="Open inquiries" value={openInquiryCount.toString()} note="Respond promptly to keep service moving." />
                <StatCard title="Upcoming events" value={upcomingEventCount.toString()} note="Confirm slots and prepare materials." />
                <StatCard title="Scholarship reviews" value={pendingSubmissionCount > 0 ? `${pendingSubmissionCount} pending` : "0 pending"} note="Approve or request clarifications." />
              </div>
            </div>
          </div>

          <section id="grantees" className="mt-24">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                Grantee status
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                See your grantees and their scholarship progress.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {grantees.length > 0 ? (
                grantees.map((grantee) => (
                  <GranteeCard
                    key={grantee.id}
                    name={grantee.user.fullName}
                    status={grantee.status}
                    program="SKEAP Scholar"
                    progress={getProgressText(grantee.status, grantee.generalAverage)}
                  />
                ))
              ) : (
                <div className="md:col-span-3 rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-10 shadow-sm">
                  <p className="text-lg font-semibold text-[#0F3D5C]">No grantees found yet.</p>
                  <p className="mt-3 text-sm leading-6 text-[#555555]">Once scholars are approved, they will appear here with their current scholarship status.</p>
                </div>
              )}
            </div>
          </section>

          <section id="events" className="mt-24">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                Event management
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                Plan, publish, and track youth activities.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {upcomingEvents.length > 0 ? (
                upcomingEvents.map((event) => (
                  <EventCard
                    key={event.id}
                    title={event.title}
                    description={event.description}
                    venue={event.venue}
                    schedule={event.eventDate.toLocaleDateString()}
                    status={event.status}
                    capacity={`${event.filledSlots}/${event.maxSlots}`}
                  />
                ))
              ) : (
                <div className="md:col-span-2 rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-10 shadow-sm">
                  <p className="text-lg font-semibold text-[#0F3D5C]">No upcoming events found.</p>
                  <p className="mt-3 text-sm leading-6 text-[#555555]">Create an event in the database or admin flow and it will appear here automatically.</p>
                </div>
              )}
            </div>
          </section>

          <section id="inquiries" className="mt-24 pb-16">
            <div className="mb-10 text-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                Helpdesk queue
              </div>
              <h2 className="mt-6 text-4xl font-black tracking-tight bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                Stay on top of resident questions.
              </h2>
            </div>
            <div className="grid gap-6 md:grid-cols-2">
              {recentInquiries.length > 0 ? (
                recentInquiries.map((inquiry) => (
                  <InquiryCard
                    key={inquiry.id}
                    subject={inquiry.subject}
                    requester={inquiry.user.fullName}
                    email={inquiry.user.email}
                    language={inquiry.language}
                    message={inquiry.message}
                    createdAt={inquiry.createdAt.toLocaleDateString()}
                  />
                ))
              ) : (
                <div className="md:col-span-2 rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-10 shadow-sm">
                  <p className="text-lg font-semibold text-[#0F3D5C]">No open inquiries right now.</p>
                  <p className="mt-3 text-sm leading-6 text-[#555555]">Resolved requests are hidden from this queue, so this view only shows items that need attention.</p>
                </div>
              )}
            </div>
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

function GranteeCard({ name, status, program, progress }: { name: string; status: string; program: string; progress: string }) {
  const statusColor = status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : status === "PROBATIONARY" ? "bg-amber-100 text-amber-700" : status === "GRADUATED" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-700";

  return (
    <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-[#0F3D5C]">{name}</p>
          <p className="mt-2 text-sm text-[#5F6F84]">{program}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${statusColor}`}>{status}</span>
      </div>
      <p className="mt-5 text-sm leading-6 text-[#555555]">{progress}</p>
    </div>
  );
}

function getProgressText(status: string, average: number | null) {
  if (status === "ACTIVE") {
    return average ? `Average: ${average.toFixed(1)} — on track.` : "Active scholar with no recent average yet.";
  }

  if (status === "PROBATIONARY") {
    return "Probationary status — follow up on missing documents or grades.";
  }

  if (status === "GRADUATED") {
    return "Graduated scholar — no active scholarship requirements.";
  }

  return "Scholarship status not available.";
}

function ActionCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-gradient-to-br from-white to-[#F5F7FB] p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <p className="text-xl font-bold text-[#0F3D5C]">{title}</p>
      <p className="mt-4 text-sm leading-6 text-[#555555]">{description}</p>
    </div>
  );
}

function EventCard({
  title,
  description,
  venue,
  schedule,
  status,
  capacity,
}: {
  title: string;
  description: string;
  venue: string;
  schedule: string;
  status: string;
  capacity: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-gradient-to-br from-white to-[#F5F7FB] p-8 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xl font-bold text-[#0F3D5C]">{title}</p>
          <p className="mt-3 text-sm leading-6 text-[#555555]">{description}</p>
        </div>
        <span className="rounded-full bg-[#0F3D5C] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white">{status}</span>
      </div>
      <div className="mt-5 space-y-2 text-sm text-[#5F6F84]">
        <p><span className="font-semibold text-[#0F3D5C]">Date:</span> {schedule}</p>
        <p><span className="font-semibold text-[#0F3D5C]">Venue:</span> {venue}</p>
        <p><span className="font-semibold text-[#0F3D5C]">Slots:</span> {capacity}</p>
      </div>
    </div>
  );
}

function InquiryCard({
  subject,
  requester,
  email,
  language,
  message,
  createdAt,
}: {
  subject: string;
  requester: string;
  email: string;
  language: string;
  message: string;
  createdAt: string;
}) {
  return (
    <div className="rounded-[2rem] border border-[#0F3D5C]/10 bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-lg font-bold text-[#0F3D5C]">{subject}</p>
          <p className="mt-2 text-sm text-[#5F6F84]">{requester} · {email}</p>
        </div>
        <span className="rounded-full bg-[#0F3D5C]/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#0F3D5C]">{language}</span>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#555555]">{message}</p>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-[#5F6F84]">Submitted {createdAt}</p>
    </div>
  );
}
