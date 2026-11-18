ALTER TABLE "grantees"
  ADD COLUMN "revocation_proof_path" TEXT,
  ADD COLUMN "revocation_proof_file_name" TEXT,
  ADD COLUMN "revocation_proof_type" TEXT,
  ADD COLUMN "revocation_proof_hash" TEXT,
  ADD COLUMN "revocation_proof_mime_type" TEXT;
