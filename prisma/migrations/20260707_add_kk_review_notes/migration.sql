-- Add reviewNotes column to kk_profiling_registrations table (guarded)
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kk_profiling_registrations') THEN
		IF NOT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_name = 'kk_profiling_registrations' AND column_name = 'reviewNotes'
		) THEN
			ALTER TABLE "kk_profiling_registrations" ADD COLUMN "reviewNotes" TEXT;
		END IF;
	END IF;
END $$;
