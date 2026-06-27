import Link from "next/link";

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-slate-900">
      <main className="mx-auto max-w-6xl px-6 py-16">
        <div className="space-y-6 rounded-[2rem] border border-slate-200 bg-white p-10 shadow-[0_20px_80px_rgba(15,23,42,0.08)]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-[#0F3D5C]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
              <span className="w-2 h-2 bg-[#0F3D5C] rounded-full"></span>
              About SKonnect
            </div>
            <h1 className="text-5xl md:text-6xl font-black tracking-tight text-[#0F3D5C]">Youth services for Pico</h1>
            <p className="text-lg leading-8 text-slate-600">
              SKonnect is designed to help Pico youth access scholarship programs, stay informed about local SK policies and resolutions, and follow the barangay ordinances that guide youth organizations and funding priorities.
            </p>
          </div>

          <section className="grid gap-8 lg:grid-cols-2">
            <div className="space-y-4 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6">
              <h2 className="text-2xl font-semibold text-slate-900">What is SKonnect?</h2>
              <p className="text-slate-600 leading-7">
                SKonnect helps youth of Barangay Pico navigate scholarship programs, register for community events, and stay up to date with SK guidance.
              </p>
              <ul className="mt-4 grid gap-3 text-slate-600 leading-7 sm:grid-cols-2">
                <li className="list-disc list-inside">Track scholarship status and requirements</li>
                <li className="list-disc list-inside">Register for youth events online</li>
                <li className="list-disc list-inside">Access ordinance and resolution summaries</li>
                <li className="list-disc list-inside">Get clearer youth organization guidance</li>
              </ul>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-teal-600">Why this matters</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Simpler youth support</h3>
                <p className="mt-2 text-slate-600 leading-7">
                  SKonnect makes it easier for youth groups, students, and families to understand what is required and where to get help.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-teal-600">What you can do</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Stay connected</h3>
                <p className="mt-2 text-slate-600 leading-7">
                  Use SKonnect to follow SK announcements, upcoming events, registration deadlines, and youth program priorities without guesswork.
                </p>
              </div>
            </div>
          </section>

          <section id="ordinances" className="space-y-8">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.35em] text-teal-600">Barangay Ordinances</p>
                <h2 className="text-3xl font-semibold text-slate-900">Official ordinances for youth programs</h2>
                <p className="text-slate-600 leading-7">
                  These ordinances guide how Barangay Pico supports youth organizations, honors academic achievement, and funds competitions for young residents.
                </p>
              </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-[#0F3D5C]">Ordinance No. 1-2023</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Youth Organizations Registration</h3>
                <p className="mt-2 text-slate-600 leading-7">
                  Registered youth organizations are prioritized for SK funds when implementing approved programs, projects, and activities, as long as the allotment follows existing laws, rules, and regulations.
                </p>
                <p className="mt-4 text-slate-600 leading-7 font-semibold">Registration requirements:</p>
                <ul className="mt-3 space-y-2 text-slate-600 leading-7 list-disc list-inside">
                  <li>Completed application form for the organization and each member</li>
                  <li>Roster of members and officers</li>
                  <li>ID card with proof of residency for each member</li>
                  <li>Organization constitution and by-laws</li>
                </ul>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-[#0F3D5C]">Ordinance No. 2-2023</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Graduate Incentive Program</h3>
                <p className="mt-2 text-slate-600 leading-7">
                  The cash incentive program honors graduates of Barangay Pico who meet residency and age requirements, and who are recognized for academic achievement at high school or college levels.
                </p>
                <p className="mt-4 text-slate-600 leading-7 font-semibold">Qualification highlights:</p>
                <ul className="mt-3 space-y-2 text-slate-600 leading-7 list-disc list-inside">
                  <li>Must be a bona fide resident of Barangay Pico</li>
                  <li>Must be 15–30 years old</li>
                  <li>Must be a graduate of high school, college, or university</li>
                </ul>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-6 shadow-sm">
                <p className="text-xs uppercase tracking-[0.35em] text-[#0F3D5C]">Ordinance No. 3-2023</p>
                <h3 className="mt-3 text-xl font-semibold text-slate-900">Youth Support System</h3>
                <p className="mt-2 text-slate-600 leading-7">
                  This ordinance provides financial support to youth participants and teams competing in sports, academic, or cultural competitions, with awards based on competition level and group size.
                </p>
                <p className="mt-4 text-slate-600 leading-7 font-semibold">Required documents:</p>
                <ul className="mt-3 space-y-2 text-slate-600 leading-7 list-disc list-inside">
                  <li>Application form</li>
                  <li>Photocopy of ID card with three specimens</li>
                  <li>Proof of participation from organizers or registration form</li>
                </ul>
              </div>
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-3">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.35em] text-teal-600">SK Ordinance</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">Priority funding</h3>
              <p className="mt-2 text-slate-600 leading-7">
                Registered youth organizations are first in line for SK funds as long as programs follow existing laws and regulations.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.35em] text-teal-600">Youth governance</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">SK resolutions</h3>
              <p className="mt-2 text-slate-600 leading-7">
                SK resolutions define how youth programs are implemented. SKonnect makes it easier to see how those resolutions affect scholarships, events, and local community support.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-xs uppercase tracking-[0.35em] text-teal-600">Community rules</p>
              <h3 className="mt-3 text-xl font-semibold text-slate-900">Procedure & compliance</h3>
              <p className="mt-2 text-slate-600 leading-7">
                When a rules change is needed, SKonnect helps youth leaders keep documents up to date and submit the required paperwork correctly.
              </p>
            </div>
          </section>

          <div className="rounded-[1.5rem] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold text-slate-900">Need to learn more?</h2>
            <p className="mt-3 text-slate-600 leading-7">
              If you want detailed ordinance or SK resolution text, the SK Council office in Barangay Pico can provide the latest official documents and help you complete the registration process.
            </p>
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <Link href="/" className="inline-flex items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-800 hover:bg-slate-100 transition">
                Back home
              </Link>
              <Link href="/signup" className="inline-flex items-center justify-center rounded-full bg-[#0F3D5C] px-5 py-3 text-sm font-semibold text-white hover:bg-[#0D2E47] transition">
                Register now
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
