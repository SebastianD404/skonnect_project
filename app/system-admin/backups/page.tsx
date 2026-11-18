import { Role } from "@prisma/client";
import { requireRole } from "@/lib/auth";
import { runScheduledBackupIdempotent } from "@/lib/backup/snapshot";
import {
  getPhtTime,
  isPhtTimeAtOrAfterBackupTarget,
} from "@/lib/data-backup-schedule";
import DataBackupSection from "../components/DataBackupSection";

export default async function SystemAdminBackupsPage() {
  await requireRole([Role.SUPER_ADMIN]);
  const { hour, minute } = getPhtTime(new Date());
  if (isPhtTimeAtOrAfterBackupTarget(hour, minute)) {
    try {
      await runScheduledBackupIdempotent("System Cron");
    } catch (error) {
      console.error("Could not run the PHT daily backup catch-up on page load.", error);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto flex flex-col gap-6 sm:gap-8">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
        <span>System Admin</span>
        <span aria-hidden="true">/</span>
        <span className="text-slate-900">Data Backup</span>
      </div>

      <header className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">System Admin</p>
        <h1 className="text-4xl font-black text-slate-950 sm:text-5xl">Data Backup &amp; Recovery</h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Create verified system snapshots, review scheduled backup history, and restore data when needed.
        </p>
      </header>

      <DataBackupSection />
    </div>
  );
}
