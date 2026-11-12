ALTER TABLE public."users"
  ADD COLUMN IF NOT EXISTS "kk_status" TEXT NOT NULL DEFAULT 'UNPROFILED';

DO $$
BEGIN
  IF to_regclass('public.kk_profiling_registrations') IS NOT NULL THEN
    UPDATE public."users" AS u
    SET "kk_status" = CASE
      WHEN (
        SELECT lower(trim(r."reviewStatus"))
        FROM public.kk_profiling_registrations AS r
        WHERE r."userId" = u."id"
        ORDER BY r."submittedAt" DESC, r."id" DESC
        LIMIT 1
      ) = 'approved' THEN 'APPROVED'
      ELSE 'PENDING'
    END
    WHERE EXISTS (
      SELECT 1
      FROM public.kk_profiling_registrations AS r
      WHERE r."userId" = u."id"
    );
  END IF;

  IF to_regclass('public.kk_profiles') IS NOT NULL THEN
    UPDATE public."users" AS u
    SET "kk_status" = 'APPROVED'
    FROM public.kk_profiles AS kp
    WHERE u."kkProfileId" = kp."id"
      AND kp."isVerified" = true
      AND u."kk_status" = 'UNPROFILED';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public."users" (
    "id",
    "authId",
    "email",
    "fullName",
    "role",
    "kk_status",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    pg_catalog.gen_random_uuid()::text,
    NEW.id::text,
    pg_catalog.lower(NEW.email),
    COALESCE(
      NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
      pg_catalog.split_part(pg_catalog.lower(NEW.email), '@', 1)
    ),
    'YOUTH',
    'UNPROFILED',
    pg_catalog.now(),
    pg_catalog.now()
  )
  ON CONFLICT ("authId") DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

CREATE OR REPLACE FUNCTION public.sync_user_kk_status_from_registration()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  latest_status TEXT;
BEGIN
  IF NEW."userId" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT r."reviewStatus"
  INTO latest_status
  FROM public.kk_profiling_registrations AS r
  WHERE r."userId" = NEW."userId"
  ORDER BY r."submittedAt" DESC, r."id" DESC
  LIMIT 1;

  UPDATE public."users"
  SET "kk_status" = CASE
    WHEN lower(trim(COALESCE(latest_status, ''))) = 'approved' THEN 'APPROVED'
    ELSE 'PENDING'
  END
  WHERE "id" = NEW."userId";

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_user_kk_status_from_registration
  ON public.kk_profiling_registrations;
CREATE TRIGGER sync_user_kk_status_from_registration
  AFTER INSERT OR UPDATE ON public.kk_profiling_registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_user_kk_status_from_registration();
