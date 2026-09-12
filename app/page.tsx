"use client";

import Link from "next/link";
import HeroCtaButton from "@/app/components/HeroCtaButton";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";

export default function HomePage() {
  const pathname = usePathname();
  const [activeLink, setActiveLink] = useState<string>(pathname);
  const [kkProfileStatus, setKkProfileStatus] = useState<string | null>(null);
  const [loadingKkProfile, setLoadingKkProfile] = useState(true);
  const [youthCount, setYouthCount] = useState<number | null>(null);
  const [activeScholarCount, setActiveScholarCount] = useState<number | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadKkProfileStatus() {
      setLoadingKkProfile(true);
      try {
        const sessionResponse = await fetch("/api/session", { cache: "no-store" });
        if (!sessionResponse.ok) return;
        const sessionData = await sessionResponse.json();
        if (!sessionData.user) return;

        const response = await fetch("/api/my/kk-profile", { cache: "no-store", credentials: "include" });
        if (!mounted) return;
        if (response.ok) {
          const data = await response.json();
          const status = data.registration?.reviewStatus || data.profile?.status;
          setKkProfileStatus(status || null);
        } else {
          setKkProfileStatus(null);
        }
      } catch {
        if (mounted) setKkProfileStatus(null);
      } finally {
        if (mounted) setLoadingKkProfile(false);
      }
    }

    void loadKkProfileStatus();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    setLoadingMetrics(true);

    fetch("/api/homepage-metrics", { cache: "no-store" })
      .then(async (response) => {
        if (!mounted) return;
        if (!response.ok) {
          throw new Error("Failed to load homepage metrics");
        }

        const data = await response.json();
        setYouthCount(typeof data.youthCount === "number" ? data.youthCount : null);
        setActiveScholarCount(typeof data.activeScholarCount === "number" ? data.activeScholarCount : null);
      })
      .catch(() => {
        if (mounted) {
          setYouthCount(null);
          setActiveScholarCount(null);
        }
      })
      .finally(() => {
        if (mounted) setLoadingMetrics(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const currentHash = window.location.hash;
    setActiveLink(currentHash === "#programs" ? "#programs" : pathname.startsWith("/programs") ? "/programs" : pathname);

    const handleHashChange = () => {
      const hash = window.location.hash;
      setActiveLink(hash === "#programs" ? "#programs" : window.location.pathname.startsWith("/programs") ? "/programs" : window.location.pathname);
    };

    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [pathname]);

  const navLinkClass = (href: string) =>
    `px-4 py-2 font-semibold transition-all rounded-lg ${activeLink === href ? "text-[#0F3D5C] bg-[#0F3D5C]/10" : "text-[#3C3C3C] hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5"}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#FAFBFC] via-[#F5F7FB] to-[#F0F4FA] text-[#1A1A1A]">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden pt-12 md:pt-24 pb-20">
        {/* Animated gradient orbs */}
        <div className="absolute top-20 right-0 w-96 h-96 bg-gradient-to-br from-[#0F3D5C]/10 to-[#00B4E5]/5 rounded-full blur-3xl -z-10 animate-pulse"></div>
        <div className="absolute top-40 -left-40 w-80 h-80 bg-gradient-to-br from-[#D4A574]/8 to-transparent rounded-full blur-3xl -z-10"></div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left Content */}
            <div className="space-y-8">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#b8d0df] bg-[#eaf6fb] px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#123f5f]">
                <span className="h-2 w-2 rounded-full bg-[#164f70]"></span>
                Sangguniang Kabataan · Barangay Pico
              </div>
              
              <h1 className="text-4xl md:text-7xl font-black leading-[1.1] tracking-tight text-[#0F3D5C]">
                A Legacy of{" "}
                <span className="italic text-yellow-500">Service</span>{" "}
                to Pico.
              </h1>
              
              <p className="text-xl text-[#555555] leading-relaxed max-w-2xl">
                Empowering Barangay Pico youth scholars with scholarship tracking, and accessible multilingual support in one unified portal.
              </p>
              
              <div className="flex flex-col sm:flex-row flex-wrap items-start gap-3 pt-4">
                <HeroCtaButton />
                {loadingKkProfile ? (
                  <a
                    aria-disabled
                    className="inline-flex items-center justify-center px-6 py-3 border-2 border-[#0F3D5C]/30 text-[#0F3D5C] font-bold rounded-2xl transition-all duration-300 min-w-[220px] opacity-80 pointer-events-none"
                  >
                    Loading...
                  </a>
                ) : !kkProfileStatus || kkProfileStatus?.toLowerCase().includes("approved") ? (
                  <a
                    href="/#programs"
                    className="inline-flex items-center justify-center px-6 py-3 border-2 border-[#0F3D5C]/30 text-[#0F3D5C] font-bold rounded-2xl hover:border-[#0F3D5C] hover:bg-[#0F3D5C]/5 transition-all duration-300 min-w-[220px]"
                  >
                    See what we Offer
                  </a>
                ) : (
                  <a
                    href="/programs/kk-profiling/status"
                    className="inline-flex items-center justify-center px-6 py-3 border-2 border-[#0F3D5C]/30 text-[#0F3D5C] font-bold rounded-2xl hover:border-[#0F3D5C] hover:bg-[#0F3D5C]/5 transition-all duration-300 min-w-[220px]"
                  >
                    View KK Profiling Status
                  </a>
                )}
              </div>
              {/* Stats row */}
              <div className="mt-8 grid grid-cols-3 gap-6 max-w-md text-sm">
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-[#0F3D5C]">
                    {loadingMetrics ? "..." : youthCount !== null ? youthCount.toLocaleString() : "N/A"}
                  </div>
                  <div className="text-xs text-[#555555] uppercase tracking-wider mt-1">Youth registered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-[#0F3D5C]">
                    {loadingMetrics ? "..." : activeScholarCount !== null ? activeScholarCount.toLocaleString() : "N/A"}
                  </div>
                  <div className="text-xs text-[#555555] uppercase tracking-wider mt-1">Active scholars</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-[#0F3D5C]">24h</div>
                  <div className="text-xs text-[#555555] uppercase tracking-wider mt-1">Helpdesk response</div>
                </div>
              </div>
            </div>

            {/* Right Visual — Barangay Hall illustration */}
              <div className="relative h-96 md:h-[480px] hidden lg:flex items-center justify-center">
                
                {/* Main card frame */}
                  <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-[#EEF3F8] to-[#E3ECF5] overflow-visible shadow-xl border border-white/60">
                    
                    {/* Subtle grid pattern background */}
                    <div className="absolute inset-0 opacity-[0.08]" style={{
                      backgroundImage: `radial-gradient(#0F3D5C 1.5px, transparent 1.5px)`,
                      backgroundSize: '20px 20px'
                    }}></div>

                    {/* Soft sky gradient at top */}
                    <div className="absolute top-0 left-0 right-0 h-2/3 bg-gradient-to-b from-[#B8D8F0]/60 to-transparent rounded-t-3xl"></div>
                  {/* Building image */}
                  <img
                    src="/brgyhall.jpeg"
                    alt="Pico Barangay Hall"
                    className="absolute -bottom-16 left-1/2 -translate-x-1/2 w-[88%] object-contain drop-shadow-[0_20px_40px_rgba(15,61,92,0.2)]"
                  />

                  {/* Top-right badge — slightly outside frame */}
                  <div className="absolute -top-4 -right-6 flex items-center gap-3 bg-white rounded-2xl px-4 py-3 shadow-xl border border-slate-100">
                    <div className="w-8 h-8 rounded-full bg-[#0F3D5C] flex items-center justify-center">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                        <circle cx="9" cy="7" r="4" />
                        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-black text-[#0F3D5C] leading-tight">Join your community</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 leading-tight">Register to get started</p>
                    </div>
                  </div>

                  {/* Bottom-left badge — slightly outside frame */}
                  <div className="absolute -bottom-4 -left-6 bg-[#0F3D5C] rounded-2xl px-4 py-3 shadow-xl max-w-[210px]">
                    <div className="flex items-center gap-2 mb-1">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#86efac" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                        <polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-300">Barangay Pico</p>
                    </div>
                    <p className="text-xs font-bold text-white leading-snug">
                      La Trinidad, <span className="text-amber-400">Benguet</span>
                    </p>
                  </div>

                </div>
              </div>
          </div>
        </div>
      </section>

      {/* ── DIVIDER ── */}
      <div className="mx-auto max-w-7xl px-6">
        <div className="h-px bg-gradient-to-r from-transparent via-[#0F3D5C]/20 to-transparent"></div>
      </div>

      {/* ── SKEAP APPLICATION PROCESS ── */}
      <section id="programs" className="w-full bg-slate-50 px-6 py-16 lg:px-12">
        {/* Top Section: Timeline Process */}
        <div className="mx-auto mb-20 max-w-6xl">
          <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-[#245b7a]">
            SKEAP GRANT · APPLICATION PROCESS
          </div>
          <h2 className="mb-3 text-3xl font-extrabold tracking-tight text-slate-900 lg:text-4xl">
            Your path to the SKEAP Grant
          </h2>
          <p className="mb-16 max-w-xl text-sm text-slate-600 lg:text-base">
            A streamlined, transparent application process. Submit your requirements online and track your approval status in real-time.
          </p>

          {/* Timeline Grid with Dotted Line */}
          <div className="relative">
            {/* Connecting dashed line for desktop */}
            <div className="absolute left-12 right-12 top-6 z-0 hidden border-t-2 border-dashed border-slate-300 md:block" />

            <div className="relative z-10 grid grid-cols-1 gap-10 md:grid-cols-3">
              {/* Step 1 */}
              <div className="flex flex-col items-start rounded-2xl border border-slate-100 bg-white/60 p-6 shadow-sm md:border-none md:bg-transparent md:p-0 md:shadow-none">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-cyan-200 bg-cyan-50 text-cyan-700 shadow-sm">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">Step 1: Account Setup</h3>
                <p className="text-sm leading-relaxed text-slate-600">Create your secure profile via KK Profiling.</p>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-start rounded-2xl border border-slate-100 bg-white/60 p-6 shadow-sm md:border-none md:bg-transparent md:p-0 md:shadow-none">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700 shadow-sm">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">Step 2: Submit Documents</h3>
                <p className="text-sm leading-relaxed text-slate-600">Upload the required documents.</p>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-start rounded-2xl border border-slate-100 bg-white/60 p-6 shadow-sm md:border-none md:bg-transparent md:p-0 md:shadow-none">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="mb-2 text-lg font-bold text-slate-900">Step 3: Track Status</h3>
                <p className="text-sm leading-relaxed text-slate-600">Monitor your application progress directly from your dashboard.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Section: Dark Navy Container with Embedded White Card */}
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-12 rounded-3xl bg-[#0b1d3a] px-8 py-12 text-white shadow-xl lg:grid-cols-2 lg:px-16 lg:py-16">
          {/* Left Info Column */}
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-cyan-400">
              YOUR OFFICIAL REGISTRATION GATEWAY
            </span>
            <h2 className="mt-2 mb-4 text-3xl font-extrabold tracking-tight text-white">
              Katipunan ng Kabataan (KK) Profiling
            </h2>
            <p className="text-sm leading-relaxed text-slate-300 lg:text-base">
              Join the official youth registry of Barangay Pico. Completing your Katipunan ng Kabataan profile helps verify your local residency and serves as your secure gateway to apply for the SKEAP grant.
            </p>
          </div>

          {/* Right White Card Column */}
          <div className="rounded-2xl bg-white p-6 text-slate-900 shadow-2xl lg:p-8">
            <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">
              WHY IT MATTERS
            </div>
            <ul className="mb-8 space-y-4 text-sm text-slate-700">
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Identify and document barangay youth demographics.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Inform SK programs and local youth policies.</span>
              </li>
              <li className="flex items-start gap-3">
                <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cyan-50 text-cyan-600">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span>Update the NYC National Youth Database.</span>
              </li>
            </ul>
            <Link
              href="/programs/kk-profiling"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#0b1d3a] px-6 py-3 text-sm font-medium text-white shadow-md transition-colors duration-200 hover:bg-[#132d56]"
            >
              Start KK Profiling
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </Link>
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
            Secure your educational assistance today.
          </h2>
          <p className="text-xl text-slate-700 max-w-2xl mx-auto mb-10 leading-relaxed">
            Sign up once. Track your scholarship requirements and receive immediate updates on your grant status.
          </p>
          <Link
            href="/programs/kk-profiling"
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-xs font-black tracking-tighter">
                  SK
                </div>
                <span className="font-bold text-lg">SKonnect</span>
              </div>
              <p className="text-sm text-white/70 leading-6">
                Official Scholarship Management Portal<br/>
                for Barangay Pico
              </p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider">Links</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#programs" className="hover:text-white transition-colors">Programs</a></li>
                <li><Link href="/about" className="hover:text-white transition-colors">About</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider">Address</h4>
              <p className="text-sm text-white/70">
                JC-214 Km. 5, Pico<br/>
                La Trinidad, Benguet<br/>
                Philippines
              </p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider">Contact</h4>
              <div className="flex flex-col gap-2 text-sm text-white/70">
                <a href="mailto:skbarangaypico@gmail.com" className="inline-flex items-center gap-2 text-white hover:text-[#E2E8F0]">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
                    <Mail className="h-4 w-4" />
                  </span>
                  Gmail
                </a>
                <a href="https://www.facebook.com/skbarangay.pico" target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-white hover:text-[#E2E8F0]">
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-black">f</span>
                  Facebook
                </a>
              </div>
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
