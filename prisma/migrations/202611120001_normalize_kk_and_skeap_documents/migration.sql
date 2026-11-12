ALTER TABLE public.kk_profiling_registrations
  ADD COLUMN IF NOT EXISTS "birthCertificateFileUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "photoFileUrl" TEXT;
