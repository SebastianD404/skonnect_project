ALTER TABLE "kk_profiling_registrations"
  ADD COLUMN IF NOT EXISTS "withdrawnAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "withdrawalReason" TEXT;

CREATE MATERIALIZED VIEW "public"."skeap_applications_admin_mv" AS
SELECT
  application."id" AS "id",
  inquiry."id" AS "inquiryId",
  inquiry."createdAt" AS "inquiryCreatedAt",
  application."userId" AS "userId",
  COALESCE(profile."fullName", app_user."fullName", application."applicantName", 'Unknown applicant') AS "fullName",
  COALESCE(app_user."email", application."emailAddress", '') AS "email",
  COALESCE(application."age", EXTRACT(YEAR FROM age(CURRENT_DATE, application."dateOfBirth"))::INTEGER) AS "age",
  COALESCE(app_user."phoneNumber", application."contactNumber") AS "phone",
  application."permanentAddress" AS "sitio",
  application."school" AS "school",
  application."educationLevel" AS "educationLevel",
  application."currentCourse" AS "course",
  application."yearLevel" AS "yearLevel",
  application."status"::TEXT AS "status",
  inquiry."reviewStatus" AS "reviewStatus",
  application."withdrawnAt" AS "withdrawnAt",
  application."withdrawalReason" AS "withdrawalReason",
  application."submittedAt" AS "submittedAt",
  application."updatedAt" AS "updatedAt",
  CASE jsonb_typeof(application."uploadedFiles")
    WHEN 'object' THEN (
      SELECT COUNT(*)::INTEGER
      FROM jsonb_object_keys(application."uploadedFiles")
    )
    WHEN 'array' THEN jsonb_array_length(application."uploadedFiles")
    ELSE (
      (application."enrollmentFileUrl" IS NOT NULL)::INTEGER +
      (application."reportCardFileUrl" IS NOT NULL)::INTEGER +
      (application."photoFileUrl" IS NOT NULL)::INTEGER
    )
  END AS "documentCount",
  (
    SELECT COUNT(*)::INTEGER
    FROM jsonb_each(
      CASE
        WHEN jsonb_typeof(application."uploadedFiles") = 'object'
          THEN application."uploadedFiles"
        ELSE '{}'::JSONB
      END
    ) AS upload
    WHERE upload.value ->> 'ocrNameStatus' = 'NAME_MISMATCH'
  ) AS "ocrNameMismatchCount",
  EXISTS (
    SELECT 1
    FROM jsonb_each(
      CASE
        WHEN jsonb_typeof(application."uploadedFiles") = 'object'
          THEN application."uploadedFiles"
        ELSE '{}'::JSONB
      END
    ) AS upload
    WHERE upload.value ->> 'ocrNameStatus' = 'NAME_MISMATCH'
  ) AS "hasOcrNameMismatch"
FROM "public"."skeap_applications" AS application
LEFT JOIN "public"."users" AS app_user
  ON app_user."id" = application."userId"
LEFT JOIN "public"."kk_profiles" AS profile
  ON profile."id" = app_user."kkProfileId"
LEFT JOIN "public"."inquiries" AS inquiry
  ON inquiry."applicationId" = application."id";

CREATE UNIQUE INDEX "skeap_applications_admin_mv_id_key"
  ON "public"."skeap_applications_admin_mv" ("id");
CREATE INDEX "skeap_applications_admin_mv_status_updated_at_idx"
  ON "public"."skeap_applications_admin_mv" ("status", "updatedAt" DESC);
CREATE INDEX "skeap_applications_admin_mv_review_status_submitted_at_idx"
  ON "public"."skeap_applications_admin_mv" ("reviewStatus", "submittedAt" DESC);

CREATE MATERIALIZED VIEW "public"."kk_profiling_applications_admin_mv" AS
SELECT
  registration."id" AS "id",
  registration."program" AS "program",
  registration."userId" AS "userId",
  COALESCE(app_user."fullName", registration."fullName") AS "fullName",
  COALESCE(app_user."email", registration."email") AS "email",
  registration."address" AS "address",
  registration."sex" AS "sex",
  registration."age" AS "age",
  CASE
    WHEN registration."age" BETWEEN 15 AND 17 THEN '15-17'
    WHEN registration."age" BETWEEN 18 AND 24 THEN '18-24'
    WHEN registration."age" BETWEEN 25 AND 30 THEN '25-30'
    ELSE NULL
  END AS "ageGroup",
  registration."birthDate" AS "birthDate",
  registration."facebook" AS "facebook",
  registration."contactNumber" AS "contactNumber",
  registration."civilStatus" AS "civilStatus",
  registration."youthClassification" AS "youthClassification",
  registration."youthClassification" AS "classification",
  registration."youthAgeGroup" AS "youthAgeGroup",
  registration."workStatus" AS "workStatus",
  registration."educationalBackground" AS "educationalBackground",
  registration."registeredSKVoter" AS "registeredSKVoter",
  LOWER(TRIM(registration."registeredSKVoter")) IN ('yes', 'true', '1') AS "isSkVoter",
  registration."votedLastSK" AS "votedLastSK",
  registration."registeredNationalVoter" AS "registeredNationalVoter",
  registration."attendedKKAssembly" AS "attendedKKAssembly",
  registration."assemblyTimes" AS "assemblyTimes",
  registration."noAssemblyReason" AS "noAssemblyReason",
  registration."consent" AS "consent",
  registration."submittedAt" AS "submittedAt",
  COALESCE(NULLIF(registration."reviewStatus", ''), 'Pending') AS "reviewStatus",
  COALESCE(NULLIF(registration."reviewStatus", ''), 'Pending') AS "status",
  registration."withdrawnAt" AS "withdrawnAt",
  registration."withdrawalReason" AS "withdrawalReason",
  registration."archived_reason" AS "archivedReason",
  registration."archived_at" AS "archivedAt",
  registration."reviewNotes" AS "reviewNotes",
  registration."idBackFileUrl" AS "idBackFileUrl",
  registration."birthCertificateFileUrl" AS "birthCertificateFileUrl",
  registration."idDocumentType" AS "idDocumentType",
  registration."idFrontFileUrl" AS "idFrontFileUrl",
  registration."photoFileUrl" AS "photoFileUrl",
  registration."idSingleFileUrl" AS "idSingleFileUrl",
  registration."residencyStatementAcknowledgement" AS "residencyStatementAcknowledgement",
  registration."middleName" AS "middleName",
  registration."requires_manual_review" AS "requiresManualReview",
  grantee."status"::TEXT AS "skeapStatus",
  grantee."id" AS "granteeId"
FROM "public"."kk_profiling_registrations" AS registration
LEFT JOIN "public"."users" AS app_user
  ON app_user."id" = registration."userId"
LEFT JOIN "public"."grantees" AS grantee
  ON grantee."userId" = registration."userId";

CREATE UNIQUE INDEX "kk_profiling_applications_admin_mv_id_key"
  ON "public"."kk_profiling_applications_admin_mv" ("id");
CREATE INDEX "kk_profiling_applications_admin_mv_status_submitted_at_idx"
  ON "public"."kk_profiling_applications_admin_mv" ("status", "submittedAt" DESC);
