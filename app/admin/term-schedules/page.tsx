import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import TermScheduleManager from "../grantee-submissions/TermScheduleManager";

export default async function TermSchedulesPage() {
  await requireRole([Role.SK_OFFICIAL, Role.SUPER_ADMIN]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 bg-slate-50/60 pb-12 sm:gap-8">
      <header>
        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          SKEAP MANAGEMENT
        </span>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Term Schedules</h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
          Configure opening windows and submission deadlines for each semester&apos;s grantee requirements.
        </p>
      </header>
      <TermScheduleManager />
    </div>
  );
}
