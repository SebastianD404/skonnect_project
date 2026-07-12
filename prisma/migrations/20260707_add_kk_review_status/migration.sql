-- Add reviewStatus column to kk_profiling_registrations table (guarded)
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kk_profiling_registrations') THEN
		IF NOT EXISTS (
			SELECT 1 FROM information_schema.columns
			WHERE table_name = 'kk_profiling_registrations' AND column_name = 'reviewStatus'
		) THEN
			ALTER TABLE "kk_profiling_registrations" ADD COLUMN "reviewStatus" TEXT NOT NULL DEFAULT 'Pending';
		END IF;

		-- Create an index on reviewStatus for faster filtering (if table exists)
		PERFORM 1;
		IF NOT EXISTS (
			SELECT 1 FROM pg_class WHERE relname = 'kk_profiling_registrations_reviewStatus_idx'
		) THEN
			CREATE INDEX "kk_profiling_registrations_reviewStatus_idx" ON "kk_profiling_registrations"("reviewStatus");
		END IF;
	END IF;
END $$;
