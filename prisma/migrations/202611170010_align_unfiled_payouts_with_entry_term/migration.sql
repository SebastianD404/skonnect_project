UPDATE "accounting_payouts" AS payout
SET
  "semester" = grantee."entryAcademicYear" || ' ' || grantee."entrySemester",
  "status" = 'NOT_YET_FILED'
FROM "grantees" AS grantee
WHERE payout."granteeId" = grantee."id"
  AND payout."status" = 'PENDING'
  AND payout."disbursed_at" IS NULL
  AND payout."claimed_at" IS NULL
  AND grantee."entryAcademicYear" IS NOT NULL
  AND grantee."entrySemester" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "submissions" AS submission
    WHERE submission."granteeId" = grantee."id"
      AND submission."status" = 'APPROVED'
  );
