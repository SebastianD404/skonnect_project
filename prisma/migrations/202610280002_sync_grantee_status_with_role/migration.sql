UPDATE "grantees" AS grantee
SET
  "status" = 'REMOVED',
  "dateRemoved" = COALESCE(grantee."dateRemoved", grantee."updatedAt"),
  "updatedAt" = CURRENT_TIMESTAMP
FROM "users" AS app_user
WHERE app_user."id" = grantee."userId"
  AND app_user."role" <> 'GRANTEE'
  AND grantee."status" IN ('ACTIVE', 'PROBATIONARY');
