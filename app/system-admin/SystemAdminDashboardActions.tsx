"use client";

import { Download } from "lucide-react";

export default function SystemAdminDashboardActions() {
  function handleExportLogs() {
    window.location.assign("/api/system-admin/audit/export");
  }

  return (
    <div className="flex shrink-0 items-center">
      <button
        type="button"
        onClick={handleExportLogs}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 shadow-sm transition-all hover:bg-slate-50"
      >
        <Download className="h-3.5 w-3.5" />
        Export Logs
      </button>
    </div>
  );
}