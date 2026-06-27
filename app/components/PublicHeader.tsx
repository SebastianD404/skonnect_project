"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

interface SessionUser {
  fullName?: string;
  email?: string;
  avatarUrl?: string;
}

function navLinkClass(activePath: string, href: string) {
  const base = "inline-flex items-center justify-center px-4 py-2 font-semibold rounded-lg transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0F3D5C]/20 focus-visible:ring-offset-2 focus-visible:ring-offset-white";
  return activePath === href
    ? `${base} text-[#0F3D5C] bg-[#0F3D5C]/10`
    : `${base} text-[#3C3C3C] hover:text-[#0F3D5C] hover:bg-[#0F3D5C]/5`;
}

export function PublicHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [authLoading, setAuthLoading] = useState(true);
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(null);
  const [openPanel, setOpenPanel] = useState<"none" | "notifications" | "messages" | "settings">("none");
  const [isScrolledToProgramsSection, setIsScrolledToProgramsSection] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const handleNavigation = (href: string) => {
    startTransition(() => {
      router.push(href);
    });
  };

  // Detect when #programs section is in view
  useEffect(() => {
    const handleScroll = () => {
      const programsSection = document.getElementById("programs");
      if (!programsSection) {
        setIsScrolledToProgramsSection(false);
        return;
      }

      const rect = programsSection.getBoundingClientRect();
      // Highlight Programs button when the section is near the top of viewport
      setIsScrolledToProgramsSection(rect.top < 200 && rect.bottom > 0);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    function closePanel(event: MouseEvent | KeyboardEvent) {
      if (event instanceof KeyboardEvent && event.key !== "Escape") return;
      if (!wrapperRef.current || wrapperRef.current.contains(event.target as Node)) return;
      setOpenPanel("none");
    }

    if (openPanel !== "none") {
      document.addEventListener("mousedown", closePanel);
      document.addEventListener("keydown", closePanel);
      return () => {
        document.removeEventListener("mousedown", closePanel);
        document.removeEventListener("keydown", closePanel);
      };
    }
  }, [openPanel]);

  useEffect(() => {
    async function fetchSession() {
      try {
        setAuthLoading(true);
        const response = await fetch("/api/session", { cache: "no-store" });
        if (!response.ok) {
          setSessionUser(null);
          return;
        }

        const data = await response.json();
        setSessionUser(data?.user || null);
      } catch (error) {
        console.error("Failed to fetch session:", error);
        setSessionUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    fetchSession();
  }, []);

  const activePath = pathname.startsWith("/programs")
    ? "/programs"
    : pathname.startsWith("/events")
    ? "/events"
    : pathname.startsWith("/about")
    ? "/about"
    : isScrolledToProgramsSection && pathname === "/"
    ? "/programs"
    : "/";

  const initials = sessionUser?.fullName
    ? sessionUser.fullName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join("")
    : sessionUser?.email
    ? sessionUser.email.slice(0, 2).toUpperCase()
    : "?";

  return (
    <header className="sticky top-0 z-50 border-b border-white/50 bg-gradient-to-b from-[#FAFBFC]/95 to-[#F5F7FB]/90 backdrop-blur-xl shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#0F3D5C] to-[#0D2E47] shadow-lg text-xs font-black tracking-tighter text-white">
            SK
          </div>
          <span className="text-xl font-black tracking-tight text-[#0F3D5C]">SKonnect</span>
        </Link>

        <nav className="hidden items-center gap-1 text-sm md:flex relative">
          <button onClick={() => handleNavigation("/")} className={`${navLinkClass(activePath, "/")} transition-opacity duration-200 ${isPending ? "opacity-70" : "opacity-100"}`}>Home</button>
          <button onClick={() => handleNavigation("/about")} className={`${navLinkClass(activePath, "/about")} transition-opacity duration-200 ${isPending ? "opacity-70" : "opacity-100"}`}>About</button>
          <button onClick={() => handleNavigation("/events")} className={`${navLinkClass(activePath, "/events")} transition-opacity duration-200 ${isPending ? "opacity-70" : "opacity-100"}`}>Events</button>
          <button onClick={() => {
              const programsSection = document.getElementById("programs");
              if (programsSection) {
                programsSection.scrollIntoView({ behavior: "smooth", block: "start" });
              } else {
                router.push("/#programs");
              }
            }}
            className={`${navLinkClass(isScrolledToProgramsSection ? "/programs" : "", "/programs")} transition-opacity duration-200 ${isPending ? "opacity-70" : "opacity-100"}`}
          >
            Programs
          </button>
        </nav>

        <div className="flex items-center gap-3">
          {authLoading ? (
            <div className="h-10 w-32 rounded-full bg-slate-200/70 animate-pulse" />
          ) : sessionUser ? (
            <div className="relative flex items-center gap-3" ref={wrapperRef}>
              <button
                type="button"
                onClick={() => setOpenPanel(openPanel === "notifications" ? "none" : "notifications")}
                className="rounded-2xl border border-slate-200 bg-white/95 p-3 text-slate-600 shadow-sm transition hover:border-[#0F3D5C]/20 hover:text-[#0F3D5C]"
                aria-expanded={openPanel === "notifications"}
                aria-label="Notifications"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpenPanel(openPanel === "messages" ? "none" : "messages")}
                className="rounded-2xl border border-slate-200 bg-white/95 p-3 text-slate-600 shadow-sm transition hover:border-[#0F3D5C]/20 hover:text-[#0F3D5C]"
                aria-expanded={openPanel === "messages"}
                aria-label="Messages"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpenPanel(openPanel === "settings" ? "none" : "settings")}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/95 p-2.5 text-slate-700 shadow-sm transition hover:border-[#0F3D5C]/20 hover:bg-slate-50"
                aria-expanded={openPanel === "settings"}
                aria-label="Open account menu"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0F3D5C] text-xs font-bold text-white">
                  {initials}
                </span>
                <svg viewBox="0 0 24 24" className="h-3 w-3 text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {openPanel !== "none" && (
                <div className="absolute right-0 top-full z-20 mt-2 w-56 overflow-hidden rounded-3xl border border-slate-200 bg-white text-slate-900 shadow-2xl">
                  {openPanel === "notifications" && (
                    <div className="space-y-3 p-4">
                      <p className="text-sm font-semibold text-[#0F3D5C]">Notifications</p>
                      <p className="text-sm text-slate-500">No notifications yet</p>
                    </div>
                  )}
                  {openPanel === "messages" && (
                    <div className="space-y-3 p-4">
                      <p className="text-sm font-semibold text-[#0F3D5C]">Messages</p>
                      <p className="text-sm text-slate-500">No messages yet</p>
                    </div>
                  )}
                  {openPanel === "settings" && (
                    <>
                      <div className="space-y-3 px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0F3D5C] text-sm font-bold text-white">
                            {initials}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-slate-900">{sessionUser.fullName || sessionUser.email}</p>
                            <p className="truncate text-xs text-slate-500">Signed in</p>
                          </div>
                        </div>
                      </div>
                      <div className="border-t border-slate-200" />
                      <Link
                        href="/profile"
                        className="block px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        Profile
                      </Link>
                      <Link
                        href="/account"
                        className="block px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        Settings
                      </Link>
                      <div className="border-t border-slate-200" />
                      <button
                        type="button"
                        onClick={async () => {
                          setOpenPanel("none");
                          await fetch("/api/auth/signout", { method: "POST", headers: { "Content-Type": "application/json" } });
                          window.location.href = "/login";
                        }}
                        className="w-full text-left px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        Sign out
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <>
              <Link href="/login" className="text-sm font-semibold text-[#3C3C3C] transition-all px-4 py-2 hover:text-[#0F3D5C]">
                Log in
              </Link>
              <Link href="/signup" className="rounded-xl bg-gradient-to-r from-[#0F3D5C] to-[#0D2E47] px-6 py-2.5 text-sm font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-105 active:scale-95">
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
