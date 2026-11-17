import { describe, expect, it } from "vitest";
import {
  aggregateAuditActivityModules,
  normalizeAuditActivityModule,
} from "@/lib/system-admin-activity";

describe("system admin activity modules", () => {
  it("normalizes SKEAP waitlist events separately from application events", () => {
    expect(normalizeAuditActivityModule("skeap_applications", "APPLICATION_ADDED_TO_WAITLIST"))
      .toBe("Waitlist");
    expect(normalizeAuditActivityModule("skeap_applications", "SKEAP_APPLICATION_WITHDRAWN"))
      .toBe("SKEAP Applications");
  });

  it("returns the top five modules and groups the rest without losing events", () => {
    const rows = [
      { targetTable: "submissions", action: "DOCUMENT_REVIEWED", eventCount: 55 },
      { targetTable: "grantees", action: "GRANTEE_STATUS_CHANGED", eventCount: 20 },
      { targetTable: "kk_profiling_registrations", action: "PROFILE_UPDATED", eventCount: 15 },
      { targetTable: "skeap_applications", action: "APPLICATION_ADDED_TO_WAITLIST", eventCount: 10 },
      { targetTable: "users", action: "UPDATE_USER_ROLE", eventCount: 8 },
      { targetTable: "academic_term_schedules", action: "UPDATE_ACADEMIC_TERM_SCHEDULE", eventCount: 7 },
      { targetTable: "accounting_payouts", action: "PAYOUT_CONFIRMED", eventCount: 6 },
      { targetTable: "backup_snapshot", action: "RESTORE_SYSTEM_BACKUP", eventCount: 3 },
      { targetTable: "announcements", action: "ANNOUNCEMENT_UPDATED", eventCount: 1 },
      { targetTable: "chat_embeddings", action: "KNOWLEDGE_BASE_CHUNK_CREATED", eventCount: 1 },
    ];

    const modules = aggregateAuditActivityModules(rows);
    const totalEvents = rows.reduce((total, row) => total + row.eventCount, 0);

    expect(totalEvents).toBe(126);
    expect(modules.map(({ label }) => label)).toEqual([
      "Submissions",
      "Grantees",
      "KK Profiles",
      "Waitlist",
      "Users",
      "Other Modules",
    ]);
    expect(modules.at(-1)).toMatchObject({
      label: "Other Modules",
      count: 18,
      breakdown: "Term Schedules: 7 · Accounting: 6 · Backups: 3 · Announcements: 1 · Knowledge Base: 1",
    });
    expect(modules.reduce((total, module) => total + module.count, 0)).toBe(totalEvents);
  });

  it("omits Other Modules when every module fits in the top five", () => {
    const modules = aggregateAuditActivityModules([
      { targetTable: "submissions", action: "DOCUMENT_REVIEWED", eventCount: 2 },
      { targetTable: "grantees", action: "GRANTEE_STATUS_CHANGED", eventCount: 1 },
    ]);

    expect(modules).toEqual([
      { label: "Submissions", count: 2 },
      { label: "Grantees", count: 1 },
    ]);
  });
});
