import { SkLogo } from "@/app/components/SkLogo";

export default function OnboardingLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <div className="min-h-screen bg-[#F3F7FB] text-slate-900">
      <header className="relative mx-auto flex h-20 max-w-7xl items-center justify-center px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3" aria-label="SKonnect">
          <SkLogo className="h-10 w-10" />
          <span className="text-xl font-semibold tracking-tight text-[#0D2E47]">SKonnect</span>
        </div>
        <a
          href="/logout"
          className="absolute right-4 text-sm font-medium text-slate-600 transition hover:text-slate-900 sm:right-6 lg:right-8"
        >
          Sign out
        </a>
      </header>
      {children}
    </div>
  );
}
