DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kk_profiling_registrations') THEN
		IF NOT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_schema = 'public'
				AND table_name = 'kk_profiling_registrations'
				AND column_name = 'requires_manual_review'
		) THEN
			ALTER TABLE "kk_profiling_registrations"
				ADD COLUMN "requires_manual_review" BOOLEAN NOT NULL DEFAULT FALSE;
		END IF;
	END IF;
END $$;
