-- Add link from Inquiry to SkeapApplication
ALTER TABLE "inquiries"
ADD COLUMN IF NOT EXISTS "applicationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "inquiries_applicationId_key" ON "inquiries" ("applicationId");

-- Only add the foreign key if the referenced table exists
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'skeap_applications') THEN
		IF NOT EXISTS (
			SELECT 1 FROM pg_constraint c
			JOIN pg_class t ON t.oid = c.conrelid
			WHERE t.relname = 'inquiries' AND c.conname = 'inquiries_applicationId_fkey'
		) THEN
			ALTER TABLE "inquiries"
			ADD CONSTRAINT "inquiries_applicationId_fkey"
			FOREIGN KEY ("applicationId") REFERENCES "skeap_applications"("id") ON DELETE CASCADE;
		END IF;
	END IF;
END $$;
