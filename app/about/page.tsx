import Link from "next/link";
import { BellRing, Map, MessageCircle, Zap } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50/50 to-slate-100/50 text-slate-900">
      <main className="relative mx-auto max-w-5xl space-y-16 px-6 py-12 md:py-16">
        <div
          className="pointer-events-none absolute left-1/2 top-0 z-0 h-64 w-full max-w-3xl -translate-x-1/2 rounded-full bg-emerald-500/5 blur-[100px]"
          aria-hidden="true"
        />
        <section className="relative z-10 mb-16 max-w-3xl">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-200/60 bg-emerald-50 px-3 py-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              About SKonnect
            </span>
          </div>
          <h1 className="mb-6 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
            Empowering the{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-teal-500 bg-clip-text text-transparent">
              Scholars of Barangay Pico
            </span>
          </h1>
          <p className="text-lg font-normal leading-relaxed text-slate-600">
            Simplifying SKEAP scholarship applications, document verifications, and academic grant tracking for students across Barangay Pico.
          </p>
        </section>

        <section className="relative z-10 max-w-3xl">
          <h2 className="mb-4 text-2xl font-bold tracking-tight text-slate-900">
            Our Mission
          </h2>
          <div className="relative border-l-2 border-emerald-500 bg-gradient-to-r from-emerald-50/50 to-transparent py-2 pl-5 sm:pl-6">
            <p className="text-base leading-relaxed text-slate-600">
              SKonnect was built to streamline educational support for the youth of Barangay Pico. We recognized that managing scholarship applications, tracking semester validations, and verifying requirement submissions could be slow and fragmented. By digitizing the SKEAP scholarship workflow, SKonnect provides a centralized and transparent platform where student grantees can track their academic progress and access relevant barangay policies in one place.
            </p>
          </div>
        </section>

        <section className="mt-16 border-t border-slate-200/60 pt-12">
          <div className="mb-10 max-w-2xl">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-emerald-600">
              Governing Principles
            </p>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">
              Built for Pico Student Grantees
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div className="space-y-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-600">
                01
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Transparent Tracking</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Providing students with real-time updates on their document status, semester validations, and scheduled grant disbursements.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-600">
                02
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Simplified Submissions</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Eliminating physical paperwork hurdles by allowing scholars to upload enrollment certificates and report cards directly online.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-600">
                03
              </div>
              <h3 className="text-sm font-semibold text-slate-900">Policy Reference</h3>
              <p className="text-xs leading-relaxed text-slate-600">
                Offering direct visibility into official barangay scholarship ordinances so grantees clearly understand eligibility guidelines.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-24 border-t border-slate-200/60 pt-16">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Everything you need to manage your grant
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              SKonnect integrates modern support tools and automated tracking so you never miss a deadline or a requirement.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-x-8 gap-y-12 md:grid-cols-2">
            <div className="flex gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                <Zap className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="mb-1 text-base font-semibold text-slate-900">AI-Powered Helpdesk</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Get instant answers to common FAQs regarding scholarship eligibility, document formats, and submission processes through our intelligent chat assistant.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="mb-1 text-base font-semibold text-slate-900">Direct Inquiry System</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Need specific administrative help? Submit direct inquiries within the platform to seamlessly communicate with SK officials without navigating external messaging apps.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                <BellRing className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="mb-1 text-base font-semibold text-slate-900">Smart Alerts &amp; Reminders</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Never miss a submission deadline or payout schedule. Receive automated status updates and critical reminders directly via in-app notifications and email.
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-emerald-400">
                <Map className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h3 className="mb-1 text-base font-semibold text-slate-900">Visual Academic Journey</h3>
                <p className="text-sm leading-relaxed text-slate-600">
                  Monitor your four-year college progression through an interactive timeline map that dynamically tracks your validated semesters and pending requirements.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="relative mt-20 overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 p-8 text-white shadow-2xl sm:p-12">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/20 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-500/15 blur-3xl"
          />

          <div className="relative z-10 flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div className="max-w-xl space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-400">
                SKEAP Grantee Portal
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Ready to track your academic grant?
              </h2>
              <p className="text-sm font-normal leading-relaxed text-slate-300">
                Log in to view your current semester validation status, upload required documents, or review official Pico scholarship ordinances.
              </p>
            </div>

            <div className="flex w-full shrink-0 flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Link
                className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-sm font-semibold text-slate-200 shadow-sm transition-colors duration-150 hover:bg-slate-800"
                href="/"
              >
                Back to Home
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-500/20 transition-all duration-150 hover:bg-emerald-400"
                href="/login"
              >
                Access Student Portal
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
