"use client";

import AdminExportButton from "../../AdminExportButton";

export default function GranteeArchiveExportMenu() {
  return (
    <AdminExportButton
      href="/api/admin/grantees/records/export?status=graduated"
      className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl bg-[#0F3D5C] px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#0D2E47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600 focus-visible:ring-offset-2"
      label="Export Graduates"
    />
  );
}
