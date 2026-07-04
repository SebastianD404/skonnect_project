-- Add link from Inquiry to SkeapApplication
ALTER TABLE "inquiries"
ADD COLUMN IF NOT EXISTS "applicationId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "inquiries_applicationId_key" ON "inquiries" ("applicationId");

ALTER TABLE "inquiries"
ADD CONSTRAINT "inquiries_applicationId_fkey"
FOREIGN KEY ("applicationId") REFERENCES "skeap_applications"("id") ON DELETE CASCADE;
