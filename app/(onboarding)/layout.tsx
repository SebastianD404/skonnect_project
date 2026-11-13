import { LogOut } from "lucide-react";
import { SkLogo } from "@/app/components/SkLogo";

export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="relative isolate min-h-screen bg-[#F3F7FB] text-slate-900">
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center bg-no-repeat opacity-30"
        style={{
          backgroundImage: "url('/kkbgls.png')",
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-6rem] -z-10 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full sm:top-[-8rem] sm:h-[40rem] sm:w-[40rem]"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(250, 204, 21, 0.12) 0%, rgba(250, 204, 21, 0.06) 46%, transparent 72%)",
        }}
      />
      <header className="relative mx-auto flex h-20 max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3" aria-label="SKonnect">
          <SkLogo className="h-10 w-10" />
          <span className="text-xl font-semibold tracking-tight text-[#0D2E47]">SKonnect</span>
        </div>
        <a
          href="/logout"
          aria-label="Sign out"
          title="Sign out"
          className="absolute right-4 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 text-sm font-medium text-slate-600 shadow-sm backdrop-blur transition hover:border-amber-300 hover:bg-amber-50/90 hover:text-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 sm:right-6 lg:right-8"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          <span className="hidden sm:inline">Sign out</span>
        </a>
      </header>
      {children}
    </div>
  );
}
