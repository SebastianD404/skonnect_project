import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      {/* ── NAV ── */}
      <header className="sticky top-0 z-50 border-b border-white/50 bg-gradient-to-b from-[#FAFBFC]/95 to-[#F5F7FB]/90 backdrop-blur-xl shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Elegant SK Logo */}
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F3D5C] to-[#0D2E47] shadow-lg text-xs font-black tracking-tighter text-white">
              SK
            </div>
            <span className="text-xl font-black tracking-tight text-[#0F3D5C]">
              SKonnect
            </span>
          </div>
          <nav className="hidden items-center gap-1 text-sm md:flex">
            <a href="#programs" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Programs</a>
            <a href="#events" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Events</a>
            <a href="#chatbot" className="px-4 py-2 font-semibold text-[#3C3C3C] transition-all hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5 rounded-lg">Ask SKonnect</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm font-semibold text-[#3C3C3C] transition-all px-4 py-2 hover:text-[#0F3D5C]"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-xl bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95"
            >
              Sign up
            </Link>
          </div>
        </div>
      </header>

      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-12 md:pt-24 pb-20">
        {/* Animated gradient orbs */}
        <div className="absolute top-20 right-0 w-96 h-96 bg-gradient-to-br from-[#0F3D5C]/10 to-[#00B4E5]/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
        <div className="absolute top-40 -left-40 w-80 h-80 bg-gradient-to-br from-[#D4A574]/8 to-transparent rounded-full blur-3xl -z-10"></div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                <span className="w-2 h-2 bg-[#0F3D5C] rounded-full"></span>
                Sangguniang Kabataan · Barangay Pico
              </div>
              
              <h1 className="text-6xl md:text-7xl font-black leading-[1.1] tracking-tight bg-gradient-to-r from-[#0F3D5C] via-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent">
                One record for every youth we serve.
              </h1>
              
              <p className="text-xl text-[#555555] leading-relaxed max-w-2xl">
                Scholarship tracking, event registration, and a multilingual helpdesk — all in one elegant platform replacing scattered Facebook posts and paper folders.
              </p>
              
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pt-4">
                <Link
                  href="/signup"
                  className="group px-8 py-4 bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] text-white font-bold rounded-xl shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-2"
                >
                  Create your account
                  <span className="group-hover:translate-x-1 transition-transform">→</span>
                </Link>
                <a
                  href="#programs"
                  className="px-8 py-4 border-2 border-[#0F3D5C]/30 text-[#0F3D5C] font-bold rounded-xl hover:border-[#0F3D5C] hover:bg-[#0F3D5C]/5 transition-all duration-300"
                >
                  See what we offer
                </a>
              </div>
            </div>

            {/* Right Visual */}
            <div className="relative h-96 md:h-[500px] hidden lg:block">
              <div className="absolute inset-0 bg-gradient-to-br from-[#00B4E5]/20 to-[#0F3D5C]/20 rounded-3xl"></div>
              <svg viewBox="0 0 400 500" className="w-full h-full">
                <defs>
                  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" style={{stopColor: "#00B4E5", stopOpacity: 0.3}} />
                    <stop offset="100%" style={{stopColor: "#0F3D5C", stopOpacity: 0.3}} />
                  </linearGradient>
                  <pattern id="weave2" x="0" y="0" width="50" height="50" patternUnits="userSpaceOnUse">
                    <rect width="50" height="50" fill="url(#grad1)" />
                    <circle cx="25" cy="25" r="15" fill="none" stroke="#0F3D5C" strokeWidth="1.5" opacity="0.4" />
                    <line x1="10" y1="25" x2="40" y2="25" stroke="#D4A574" strokeWidth="2" opacity="0.5" />
                    <line x1="25" y1="10" x2="25" y2="40" stroke="#00B4E5" strokeWidth="2" opacity="0.5" />
                  </pattern>
                </defs>
                <rect width="400" height="500" fill="url(#weave2)" />
                <circle cx="200" cy="200" r="120" fill="none" stroke="#0F3D5C" strokeWidth="2" opacity="0.2" />
                <circle cx="200" cy="200" r="100" fill="none" stroke="#00B4E5" strokeWidth="2" opacity="0.3" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#0F3D5C]/20 to-transparent"></div>
      </div>

      {/* ── REGISTRY OF SERVICES ── */}
      <section id="programs" className="relative py-24">
        {/* Background elements */}
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-[#00B4E5]/8 to-transparent rounded-full blur-3xl -z-10"></div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C] mb-6">
              <span className="w-2 h-2 bg-[#0F3D5C] rounded-full"></span>
              Registry of Services
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent mb-4">
              Everything you need
            </h2>
            <p className="text-lg text-[#555555] max-w-2xl mx-auto">
              One platform for scholarships, events, reminders, and real answers
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ServiceCard
              icon={<GraduationCapIcon />}
              title="SKEAP Scholarship"
              desc="Submit grades and Certificates of Enrollment each semester. Track your status — Active, Probationary, or Graduated — without a single trip to the SK office."
            />
            <ServiceCard
              icon={<CalendarIcon />}
              title="Event Registration"
              desc="Browse Katipunan ng Kabataan and community events with live slot counts. Register in seconds; registration closes the moment slots fill."
            />
            <ServiceCard
              icon={<BellIcon />}
              title="Automated Reminders"
              desc="Deadline reminders and status updates land in your inbox automatically — no more missed submissions because a Facebook post got buried."
            />
            <ServiceCard
              icon={<ChatIcon />}
              title="Multilingual Helpdesk"
              desc="Ask in English, Filipino, or Ilocano. Answers come from real-time SKEAP and event data — available any hour, any day."
              id="chatbot"
            />
          </div>
        </div>
      </section>

      {/* ── CLOSING CTA ── */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0F3D5C] via-[#0D2E47] to-[#051D32] -z-10"></div>
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00B4E5]/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-[#D4A574]/5 rounded-full blur-3xl -z-10"></div>

        <div className="mx-auto max-w-7xl px-6 text-center">
          <h2 className="text-5xl md:text-6xl font-black leading-tight text-[#0B2545] mb-6">
            Built for the youth of <br/> Barangay Pico
          </h2>
          <p className="text-xl text-slate-700 max-w-2xl mx-auto mb-10 leading-relaxed">
            Sign up once. Track your scholarship, register for events, and get real answers — all in one record.
          </p>
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-10 py-4 bg-white text-[#0F3D5C] font-bold rounded-xl shadow-2xl hover:shadow-3xl transition-all duration-300 hover:scale-105 active:scale-95"
          >
            Get started
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] text-white border-t border-white/10">
        <div className="mx-auto max-w-7xl px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-xs font-black tracking-tighter">
                  SK
                </div>
                <span className="font-bold text-lg">SKonnect</span>
              </div>
              <p className="text-sm text-white/70">
                Youth services platform for Barangay Pico
              </p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider">Links</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#programs" className="hover:text-white transition-colors">Programs</a></li>
                <li><a href="#events" className="hover:text-white transition-colors">Events</a></li>
                <li><a href="#chatbot" className="hover:text-white transition-colors">Ask SKonnect</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider">Contact</h4>
              <p className="text-sm text-white/70">
                Sangguniang Kabataan<br/>
                Barangay Pico, La Trinidad<br/>
                Benguet
              </p>
            </div>
          </div>
          <div className="flex flex-col md:flex-row items-center justify-between text-xs text-white/60">
            <span>© 2026 Sangguniang Kabataan — Barangay Pico</span>
            <span>SKonnect Youth Services Portal</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function ServiceCard({
  icon,
  title,
  desc,
  id,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  id?: string;
}) {
  return (
    <div id={id} className="group relative rounded-2xl border border-[#0F3D5C]/10 bg-gradient-to-br from-white to-[#F5F7FB] p-8 shadow-sm hover:shadow-xl transition-all duration-300 hover:border-[#0F3D5C]/30 hover:-translate-y-1">
      <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-[#00B4E5]/5 to-transparent rounded-full -z-10 group-hover:from-[#00B4E5]/10 transition-all duration-300"></div>
      
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#00B4E5] to-[#0F3D5C] shadow-lg mb-6 group-hover:shadow-xl transition-all duration-300 group-hover:scale-110">
        {icon}
      </div>
      
      <h3 className="text-2xl font-bold text-[#0F3D5C] mb-4">
        {title}
      </h3>
      
      <p className="text-[#555555] leading-relaxed text-base">
        {desc}
      </p>
      
      <div className="mt-6 flex items-center text-sm font-bold text-[#0F3D5C] group-hover:translate-x-1 transition-transform duration-300">
        Learn more →
      </div>
    </div>
  );
}

/* Icon Components with Cyan/Blue Gradient */
function GraduationCapIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6m0 0v4m0-4H2m20-4l-8.5-5.5a2 2 0 0 0-2.999 0L2 10m20 0l-10-6.464" />
      <circle cx="12" cy="17" r="2" fill="white" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <circle cx="9" cy="16" r="1.5" fill="white" />
      <circle cx="15" cy="16" r="1.5" fill="white" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <circle cx="9" cy="10" r="1" fill="white" />
      <circle cx="12" cy="10" r="1" fill="white" />
      <circle cx="15" cy="10" r="1" fill="white" />
    </svg>
  );
}