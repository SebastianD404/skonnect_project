import Link from "next/link";
import { ArrowRight, FileQuestion, Inbox, MessageCircle } from "lucide-react";

export default function YouthDashboardPage() {
  return (
    <main className="px-6 pb-20 pt-10 lg:px-10 lg:pt-14">
      <div className="mx-auto max-w-7xl">
        <section className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-white p-8 shadow-sm lg:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cyan-100/70 blur-3xl" />
          <div className="relative max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#0F3D5C]">Youth dashboard</p>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-slate-950 sm:text-5xl">Stay connected to SK support.</h1>
            <p className="mt-4 text-base leading-7 text-slate-600">Ask questions about programs, KK profiling, events, ordinances, and your account. Follow every response from one support inbox.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/youth-dashboard/contact-support" className="inline-flex items-center gap-2 rounded-full bg-[#0F3D5C] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0D2E47]">
                <MessageCircle className="h-4 w-4" />
                Ask SK officials
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link href="/youth-dashboard/inquiries" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                <Inbox className="h-4 w-4" />
                Open Support Inbox
              </Link>
            </div>
          </div>
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-3">
          <Link href="/youth-dashboard/contact-support" className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <FileQuestion className="h-6 w-6 text-sky-700" />
            <h2 className="mt-5 text-lg font-bold text-slate-900">Start an inquiry</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Send a question or report an issue to the SK team.</p>
          </Link>
          <Link href="/youth-dashboard/inquiries" className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <Inbox className="h-6 w-6 text-emerald-700" />
            <h2 className="mt-5 text-lg font-bold text-slate-900">Track your requests</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">See whether each inquiry is awaiting a reply, answered, or resolved.</p>
          </Link>
          <Link href="/chatbot" className="rounded-3xl border border-slate-200/80 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <MessageCircle className="h-6 w-6 text-violet-700" />
            <h2 className="mt-5 text-lg font-bold text-slate-900">Ask the assistant</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Get quick guidance before sending a formal inquiry.</p>
          </Link>
        </section>
      </div>
    </main>
  );
}
