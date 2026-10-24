CREATE INDEX IF NOT EXISTS "kk_profiling_registrations_reviewStatus_submittedAt_idx"
  ON "kk_profiling_registrations" ("reviewStatus", "submittedAt" DESC);

CREATE INDEX IF NOT EXISTS "submissions_status_submittedAt_idx"
  ON "submissions" ("status", "submittedAt" DESC);

CREATE INDEX IF NOT EXISTS "submissions_granteeId_submittedAt_idx"
  ON "submissions" ("granteeId", "submittedAt" DESC);

CREATE INDEX IF NOT EXISTS "grantees_status_updatedAt_idx"
  ON "grantees" ("status", "updatedAt" DESC);

CREATE INDEX IF NOT EXISTS "inquiries_isResolved_createdAt_idx"
  ON "inquiries" ("isResolved", "createdAt" DESC);

CREATE INDEX IF NOT EXISTS "audit_logs_createdAt_idx"
  ON "audit_logs" ("createdAt" DESC);
