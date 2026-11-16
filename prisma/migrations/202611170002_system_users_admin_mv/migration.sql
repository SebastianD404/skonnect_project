CREATE MATERIALIZED VIEW "public"."system_users_admin_mv" AS
WITH user_details AS (
  SELECT
    app_user."id" AS "user_id",
    app_user."fullName" AS "full_name",
    CASE
      WHEN NULLIF(TRIM(kk_profile."firstName"), '') IS NOT NULL
        AND NULLIF(TRIM(kk_profile."lastName"), '') IS NOT NULL
      THEN UPPER(CONCAT_WS(
        ', ',
        TRIM(kk_profile."lastName"),
        TRIM(kk_profile."firstName"),
        NULLIF(TRIM(kk_profile."middleName"), '')
      ))
      ELSE UPPER(REGEXP_REPLACE(TRIM(app_user."fullName"), '\s+', ' ', 'g'))
    END AS "display_name",
    app_user."email" AS "email",
    app_user."role" AS "role",
    app_user."isActive" AS "is_active",
    app_user."createdAt" AS "created_at",
    app_user."updatedAt" AS "updated_at",
    app_user."avatarUrl" AS "avatar_url",
    app_user."username" AS "username",
    app_user."phoneNumber" AS "phone_number",
    app_user."barangay" AS "barangay",
    app_user."languagePref" AS "language_pref",
    grantee."status" AS "grantee_status",
    grantee."school" AS "grantee_school",
    grantee."yearLevel" AS "grantee_year_level",
    grantee."generalAverage" AS "grantee_general_average",
    grantee."dateEnrolled" AS "grantee_date_enrolled",
    COALESCE(grantee."graduatedAt", grantee."dateRemoved") AS "grantee_archived_at",
    grantee."retentionExpiresAt" AS "grantee_retention_expires_at",
    latest_application."status" AS "skeap_application_status",
    CASE
      WHEN grantee."status" IN ('REVOKED', 'REMOVED') THEN 'Revoked'
      WHEN grantee."status" = 'GRADUATED' THEN 'N/A'
      WHEN grantee."status" IN ('ACTIVE', 'PROBATIONARY')
        OR latest_application."status" = 'APPROVED'
      THEN 'Active Scholar'
      WHEN latest_application."status" = 'WAITLISTED' THEN 'Waitlisted'
      ELSE 'N/A'
    END AS "skeap_status",
    EXISTS (
      SELECT 1
      FROM "public"."kk_profiling_registrations" AS registration
      WHERE registration."userId" = app_user."id"
        AND registration."reviewStatus" = 'Approved'
        AND registration."archived_at" IS NULL
    ) AS "has_verified_kk_profile",
    EXISTS (
      SELECT 1
      FROM "public"."kk_profiling_registrations" AS registration
      WHERE registration."userId" = app_user."id"
        AND (
          registration."reviewStatus" = 'Archived'
          OR registration."archived_at" IS NOT NULL
        )
    ) AS "has_archived_kk_profile"
  FROM "public"."users" AS app_user
  LEFT JOIN "public"."kk_profiles" AS kk_profile
    ON kk_profile."id" = app_user."kkProfileId"
  LEFT JOIN "public"."grantees" AS grantee
    ON grantee."userId" = app_user."id"
  LEFT JOIN LATERAL (
    SELECT application."status"
    FROM "public"."skeap_applications" AS application
    WHERE application."userId" = app_user."id"
    ORDER BY application."updatedAt" DESC, application."submittedAt" DESC, application."id" DESC
    LIMIT 1
  ) AS latest_application ON TRUE
)
SELECT
  "user_id",
  "full_name",
  "display_name",
  "email",
  "role",
  "is_active",
  "created_at",
  "updated_at",
  "avatar_url",
  "username",
  "phone_number",
  "barangay",
  "language_pref",
  "grantee_status",
  "grantee_school",
  "grantee_year_level",
  "grantee_general_average",
  "grantee_date_enrolled",
  "grantee_archived_at",
  "grantee_retention_expires_at",
  "skeap_application_status",
  "skeap_status",
  CASE
    WHEN "is_active" AND "has_verified_kk_profile" THEN 'VERIFIED_KK'
    WHEN "is_active"
      AND (
        "role" = 'YOUTH'
        OR (
          "role" = 'GRANTEE'
          AND "grantee_status" IN ('ACTIVE', 'PROBATIONARY')
        )
      )
      AND NOT "has_verified_kk_profile"
      AND NOT "has_archived_kk_profile"
    THEN 'PENDING_UNPROFILED'
    WHEN "is_active"
      AND "role" IN ('SK_OFFICIAL', 'SUPER_ADMIN')
      AND NOT "has_verified_kk_profile"
    THEN 'ADMIN_STAFF'
    ELSE 'ARCHIVED_INACTIVE'
  END AS "segment"
FROM user_details;

CREATE UNIQUE INDEX "system_users_admin_mv_user_id_key"
  ON "public"."system_users_admin_mv" ("user_id");
CREATE INDEX "system_users_admin_mv_segment_created_at_idx"
  ON "public"."system_users_admin_mv" ("segment", "created_at" DESC);
CREATE INDEX "system_users_admin_mv_role_created_at_idx"
  ON "public"."system_users_admin_mv" ("role", "created_at" DESC);
CREATE INDEX "system_users_admin_mv_full_name_email_idx"
  ON "public"."system_users_admin_mv" ("full_name", "email");
