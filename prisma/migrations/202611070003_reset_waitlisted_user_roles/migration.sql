UPDATE "users" AS app_user
SET
  "role" = 'YOUTH',
  "updatedAt" = CURRENT_TIMESTAMP
WHERE app_user."role" = 'GRANTEE'
  AND EXISTS (
    SELECT 1
    FROM "skeap_applications" waitlisted_application
    WHERE waitlisted_application."userId" = app_user."id"
      AND waitlisted_application."status" = 'WAITLISTED'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM "skeap_applications" approved_application
    WHERE approved_application."userId" = app_user."id"
      AND approved_application."status" = 'APPROVED'
  );
