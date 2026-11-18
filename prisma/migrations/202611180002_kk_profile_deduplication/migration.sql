ALTER TABLE "kk_profiles"
ADD COLUMN "id_document_hash" TEXT,
ADD COLUMN "duplicate_flag" TEXT,
ADD COLUMN "duplicate_note" TEXT;

CREATE INDEX "kk_profiles_id_document_hash_idx"
ON "kk_profiles"("id_document_hash");
