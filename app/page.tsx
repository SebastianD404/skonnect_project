"use client";

import Link from "next/link";
import HeroCtaButton from "@/app/components/HeroCtaButton";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Mail } from "lucide-react";

export default function HomePage() {
  const pathname = usePathname();
  const [activeLink, setActiveLink] = useState<string>(pathname);

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
              <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C]">
                <span className="w-2 h-2 bg-[#0F3D5C] rounded-full"></span>
                Sangguniang Kabataan · Barangay Pico
              </div>
              
              <h1 className="text-4xl md:text-7xl font-black leading-[1.1] tracking-tight text-[#0F3D5C]">
                A Legacy of{" "}
                <span className="italic text-yellow-500">Service</span>{" "}
                to Pico.
              </h1>
              
              <p className="text-xl text-[#555555] leading-relaxed max-w-2xl">
                Empowering Barangay Pico youth scholars with SKEAP event updates, scholarship tracking, and accessible multilingual support in one unified portal.
              </p>
              
              <div className="flex flex-col sm:flex-row flex-wrap items-start gap-3 pt-4">
                <HeroCtaButton />
                <a
                  href="#programs"
                  className="inline-flex items-center justify-center px-6 py-3 border-2 border-[#0F3D5C]/30 text-[#0F3D5C] font-bold rounded-2xl hover:border-[#0F3D5C] hover:bg-[#0F3D5C]/5 transition-all duration-300"
                >
                  See what we offer
                </a>
              </div>
              {/* Stats row */}
              <div className="mt-8 grid grid-cols-3 gap-6 max-w-md text-sm">
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-[#0F3D5C]">1,240+</div>
                  <div className="text-xs text-[#555555] uppercase tracking-wider mt-1">Youth registered</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-extrabold text-[#0F3D5C]">48</div>
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

      {/* ── REGISTRY OF SERVICES ── */}
      <section id="programs" className="relative py-24">
        {/* Background elements */}
        <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-[#00B4E5]/8 to-transparent rounded-full blur-3xl -z-10"></div>

        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-16 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#0F3D5C]/20 bg-gradient-to-r from-[#0F3D5C]/8 to-[#00B4E5]/8 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-[#0F3D5C] mb-6">
              <span className="w-2 h-2 bg-[#0F3D5C] rounded-full"></span>
              SKonnect Services
            </div>
            <h2 className="text-4xl md:text-5xl font-black tracking-tight bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] bg-clip-text text-transparent mb-4">
              Everything youth need in one place
            </h2>
            <p className="text-lg text-[#555555] max-w-2xl mx-auto">
              Apply for educational assistance, register for youth events, stay updated with official announcements, submit profiling data, and get support — all from one dashboard.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <ServiceCard
              icon={<GraduationCapIcon />}
              title="SKEAP"
              desc="The SK Educational Assistance Program provides financial support for qualified students in Barangay Pico. Skip the trips to the SK office and easily submit your documents online."
              slug="skeap-scholarship"
            />
            <ServiceCard
              icon={<CalendarIcon />}
              title="Youth Events"
              desc="The central hub for official Barangay Pico youth programs and SK activities. Browse upcoming events, view live registration slot counts in real time, and secure your seat before spots fill up."
              slug="/events"
            />
            <ServiceCard
              icon={<BellIcon />}
              title="KK Profiling"
              desc="Register as an official member of the Katipunan ng Kabataan in Barangay Pico. Submit your profiling data online to ensure your voice is counted and help shape upcoming youth initiatives, policies, and community projects."
              slug="kk-profiling"
            />
            <ServiceCard
              icon={<ChatIcon />}
              title="Official Announcements"
              desc="Stay updated with the latest announcements from SK officials. Get important updates on programs, events, and community initiatives."
              slug="/announcements"
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8 pb-8 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-xs font-black tracking-tighter">
                  SK
                </div>
                <span className="font-bold text-lg">SKonnect</span>
              </div>
              <p className="text-sm text-white/70 leading-6">
                Youth services platform<br/>
                for Barangay Pico
              </p>
            </div>
            <div>
              <h4 className="font-bold text-sm mb-3 uppercase tracking-wider">Links</h4>
              <ul className="space-y-2 text-sm text-white/70">
                <li><a href="#programs" className="hover:text-white transition-colors">Programs</a></li>
                <li><Link href="/events" className="hover:text-white transition-colors">Events</Link></li>
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


function ServiceCard({
  icon,
  title,
  desc,
  id,
  slug,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  id?: string;
  slug?: string;
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
      
      <div className="mt-6">
        {/** prefer explicit paths (starting with /), otherwise use program slug, otherwise default to chatbot */}
        {slug?.startsWith("/") ? (
          // direct path (e.g., "/announcements", "/events")
          <Link href={slug} className="inline-flex items-center gap-1 text-sm font-bold text-[#0F3D5C] px-3 py-1.5 rounded-lg transition-all duration-300 hover:bg-[#0F3D5C]/10 hover:translate-x-1">
            Learn more →
          </Link>
        ) : (slug && !slug.startsWith("/events")) || !slug ? (
          // default behavior: link to program slug when provided, else chatbot
          (slug ? (
            <Link href={`/programs/${slug}`} className="inline-flex items-center gap-1 text-sm font-bold text-[#0F3D5C] px-3 py-1.5 rounded-lg transition-all duration-300 hover:bg-[#0F3D5C]/10 hover:translate-x-1">
              Learn more →
            </Link>
          ) : (
            <Link href="/chatbot" className="inline-flex items-center gap-1 text-sm font-bold text-[#0F3D5C] px-3 py-1.5 rounded-lg transition-all duration-300 hover:bg-[#0F3D5C]/10 hover:translate-x-1">
              Learn more →
            </Link>
          ))
        ) : (
          // fallback: if slug equals "/events" use that path
          <Link href={slug} className="inline-flex items-center gap-1 text-sm font-bold text-[#0F3D5C] px-3 py-1.5 rounded-lg transition-all duration-300 hover:bg-[#0F3D5C]/10 hover:translate-x-1">
            Learn more →
          </Link>
        )}
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