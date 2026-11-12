UPDATE "system_settings"
SET "value" = LEAST("value", 55),
    "updatedAt" = CURRENT_TIMESTAMP
WHERE "key" = 'SKEAP_MAX_SLOTS';

-- Preserve existing over-capacity records for manual review; guards below block future increases.
CREATE OR REPLACE FUNCTION public.enforce_skeap_approved_user_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  occupied_user_count integer;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."status" = 'APPROVED'
    AND NEW."status" = 'APPROVED'
    AND OLD."userId" = NEW."userId" THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(2026, 55);

  IF NEW."status" <> 'APPROVED' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO occupied_user_count
  FROM (
    SELECT application."userId"
    FROM public."skeap_applications" AS application
    WHERE application."status" = 'APPROVED'
      AND NOT EXISTS (
        SELECT 1
        FROM public."grantees" AS linked_grantee
        WHERE linked_grantee."userId" = application."userId"
          AND linked_grantee."status" NOT IN ('ACTIVE', 'PROBATIONARY')
      )
    UNION
    SELECT grantee."userId"
    FROM public."grantees" AS grantee
    WHERE grantee."status" IN ('ACTIVE', 'PROBATIONARY')
  ) AS occupied_users
  WHERE occupied_users."userId" <> NEW."userId";

  IF occupied_user_count >= 55 THEN
    RAISE EXCEPTION 'SKEAP_CAPACITY_FULL'
      USING ERRCODE = '23514',
            CONSTRAINT = 'skeap_applications_approved_capacity';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "skeap_applications_approved_capacity"
BEFORE INSERT OR UPDATE OF "status", "userId"
ON public."skeap_applications"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_skeap_approved_user_capacity();

CREATE OR REPLACE FUNCTION public.enforce_active_grantee_capacity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  occupied_user_count integer;
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."status" IN ('ACTIVE', 'PROBATIONARY')
    AND NEW."status" IN ('ACTIVE', 'PROBATIONARY')
    AND OLD."userId" = NEW."userId" THEN
    RETURN NEW;
  END IF;

  PERFORM pg_advisory_xact_lock(2026, 55);

  IF NEW."status" NOT IN ('ACTIVE', 'PROBATIONARY') THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO occupied_user_count
  FROM (
    SELECT application."userId"
    FROM public."skeap_applications" AS application
    WHERE application."status" = 'APPROVED'
      AND NOT EXISTS (
        SELECT 1
        FROM public."grantees" AS linked_grantee
        WHERE linked_grantee."userId" = application."userId"
          AND linked_grantee."status" NOT IN ('ACTIVE', 'PROBATIONARY')
      )
    UNION
    SELECT grantee."userId"
    FROM public."grantees" AS grantee
    WHERE grantee."status" IN ('ACTIVE', 'PROBATIONARY')
  ) AS occupied_users
  WHERE occupied_users."userId" <> NEW."userId";

  IF occupied_user_count >= 55 THEN
    RAISE EXCEPTION 'SKEAP_CAPACITY_FULL'
      USING ERRCODE = '23514',
            CONSTRAINT = 'grantees_active_capacity';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER "grantees_active_capacity"
BEFORE INSERT OR UPDATE OF "status", "userId"
ON public."grantees"
FOR EACH ROW
EXECUTE FUNCTION public.enforce_active_grantee_capacity();
