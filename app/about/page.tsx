import Link from "next/link";
import { Check } from "lucide-react";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-slate-50/50 to-slate-100/50 text-slate-900">
      <main className="mx-auto max-w-5xl space-y-16 px-6 py-12 md:py-16">
        <section className="max-w-2xl space-y-4">
          <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
            About SKonnect
          </span>
          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Youth services for Pico
          </h1>
          <p className="text-base leading-relaxed text-slate-600">
            SKonnect helps Pico youth access scholarship programs, stay informed about local SK policies and resolutions, and understand the barangay ordinances that guide youth organizations and funding priorities.
          </p>
        </section>

        <section className="grid items-start gap-12 border-t border-slate-100 pt-8 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-slate-900">What is SKonnect?</h2>
            <p className="text-sm leading-relaxed text-slate-600">
              SKonnect helps youth of Barangay Pico navigate scholarship programs, register for community events, and stay up to date with SK guidance.
            </p>
            <ul className="space-y-2.5 pt-2 text-sm text-slate-700">
              {[
                "Track scholarship status and requirements",
                "Register for youth events online",
                "Access ordinance and resolution summaries",
                "Get clearer youth organization guidance",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-4 rounded-3xl bg-slate-900 p-8 text-white shadow-xl">
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-400">Why this matters</span>
            <h3 className="text-xl font-bold">Simpler youth support</h3>
            <p className="text-sm leading-relaxed text-slate-300">
              SKonnect makes it easier for youth groups, students, and families to understand what is required and where to get help. Follow announcements, event dates, registration deadlines, and program priorities in one place.
            </p>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-10 border-t border-slate-100 pt-8 md:grid-cols-3 md:gap-8">
          <div className="space-y-2 border-t-2 border-emerald-500/50 pt-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">SK Ordinance</span>
            <h3 className="text-base font-bold text-slate-900">Priority funding</h3>
            <p className="text-xs leading-relaxed text-slate-600">
              Registered youth organizations are first in line for SK funds as long as programs follow existing laws and regulations.
            </p>
          </div>

          <div className="space-y-2 border-t-2 border-emerald-500/50 pt-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Youth governance</span>
            <h3 className="text-base font-bold text-slate-900">SK resolutions</h3>
            <p className="text-xs leading-relaxed text-slate-600">
              SK resolutions define how youth programs are implemented, connecting scholarships and events to local community support.
            </p>
          </div>

          <div className="space-y-2 border-t-2 border-emerald-500/50 pt-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-600">Community rules</span>
            <h3 className="text-base font-bold text-slate-900">Procedure &amp; compliance</h3>
            <p className="text-xs leading-relaxed text-slate-600">
              When rules change, SKonnect helps youth leaders keep documents up to date and submit required paperwork correctly.
            </p>
          </div>
        </section>

        <section className="flex flex-col items-center justify-between gap-6 rounded-3xl border border-slate-200/80 bg-slate-50 p-6 md:flex-row md:p-8">
          <div className="space-y-1 text-center md:text-left">
            <h2 className="text-base font-bold text-slate-900">Need to learn more?</h2>
            <p className="max-w-lg text-xs leading-relaxed text-slate-500">
              For detailed ordinance or SK resolution text, the SK Council office in Barangay Pico can provide the latest official documents and help with registration.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <Link href="/" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100">
              Back home
            </Link>
            <Link href="/signup" className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800">
              Register now
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
