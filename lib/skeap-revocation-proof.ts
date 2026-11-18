import "server-only";
import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  isSkeapRevocationProofType,
  MAX_SKEAP_REVOCATION_PROOF_SIZE,
  SKEAP_REVOCATION_PROOF_BUCKET,
  type SkeapRevocationProofType,
} from "@/lib/skeap-revocation";

const MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export class InvalidSkeapRevocationProofError extends Error {}

export type StoredSkeapRevocationProof = {
  path: string;
  fileName: string;
  proofType: SkeapRevocationProofType;
  hash: string;
  mimeType: string;
};

export type ValidatedSkeapRevocationProof = StoredSkeapRevocationProof & {
  buffer: Buffer;
};

export type SkeapRevocationProofUpload = {
  name: string;
  type: string;
  size: number;
  arrayBuffer(): Promise<ArrayBuffer>;
};

function isValidFileSignature(bytes: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  if (mimeType === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  return (
    mimeType === "image/webp" &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

function hasMatchingExtension(fileName: string, mimeType: string) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  if (mimeType === "application/pdf") return extension === "pdf";
  if (mimeType === "image/jpeg") return extension === "jpg" || extension === "jpeg";
  if (mimeType === "image/png") return extension === "png";
  return mimeType === "image/webp" && extension === "webp";
}

export async function validateSkeapRevocationProof(
  file: SkeapRevocationProofUpload,
  granteeId: string,
  proofType: string,
): Promise<ValidatedSkeapRevocationProof> {
  if (!isSkeapRevocationProofType(proofType)) {
    throw new InvalidSkeapRevocationProofError("Select a valid supporting proof document type.");
  }
  if (!file.size || file.size > MAX_SKEAP_REVOCATION_PROOF_SIZE) {
    throw new InvalidSkeapRevocationProofError("Supporting proof must be a non-empty file of 10 MB or less.");
  }
  if (!granteeId || /[\\/]/.test(granteeId)) {
    throw new InvalidSkeapRevocationProofError("Invalid grantee id.");
  }

  const mimeType = file.type.toLowerCase() === "image/jpg" ? "image/jpeg" : file.type.toLowerCase();
  if (!MIME_TYPES.has(mimeType) || !hasMatchingExtension(file.name, mimeType)) {
    throw new InvalidSkeapRevocationProofError("Upload a PDF, JPG, PNG, or WEBP proof document.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length !== file.size || !isValidFileSignature(buffer, mimeType)) {
    throw new InvalidSkeapRevocationProofError("The uploaded file does not match its declared document type.");
  }

  const hash = createHash("sha256").update(buffer).digest("hex");
  const safeFileName = file.name.replace(/[\r\n\\/]/g, "_").replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 150) || "proof";
  const path = `${granteeId}/${hash}-${safeFileName}`;
  return {
    path,
    fileName: safeFileName,
    proofType,
    hash,
    mimeType,
    buffer,
  };
}

export async function storeSkeapRevocationProof(
  file: SkeapRevocationProofUpload,
  granteeId: string,
  proofType: string,
): Promise<StoredSkeapRevocationProof> {
  const validatedProof = await validateSkeapRevocationProof(file, granteeId, proofType);
  const supabaseAdmin = createAdminClient();
  const { data: bucket } = await supabaseAdmin.storage.getBucket(SKEAP_REVOCATION_PROOF_BUCKET);
  if (!bucket) {
    const { error: createError } = await supabaseAdmin.storage.createBucket(SKEAP_REVOCATION_PROOF_BUCKET, {
      public: false,
      fileSizeLimit: MAX_SKEAP_REVOCATION_PROOF_SIZE,
    });
    if (createError) {
      const { data: existingBucket } = await supabaseAdmin.storage.getBucket(SKEAP_REVOCATION_PROOF_BUCKET);
      if (!existingBucket) {
        throw new Error(`Could not create revocation-proofs bucket: ${createError.message}`);
      }
    }
  }

  const { error: uploadError } = await supabaseAdmin.storage.from(SKEAP_REVOCATION_PROOF_BUCKET)
    .upload(validatedProof.path, validatedProof.buffer, {
      contentType: validatedProof.mimeType,
      cacheControl: "31536000",
      upsert: true,
    });

  if (uploadError) throw new Error(`Proof upload failed: ${uploadError.message}`);

  return {
    path: validatedProof.path,
    fileName: validatedProof.fileName,
    proofType: validatedProof.proofType,
    hash: validatedProof.hash,
    mimeType: validatedProof.mimeType,
  };
}

export async function removeSkeapRevocationProof(path: string) {
  const [granteeId, fileName, ...extraSegments] = path.split("/");
  if (!granteeId || !fileName || extraSegments.length > 0 || /[.]{1,2}/.test(granteeId)) {
    throw new Error("Invalid SKEAP revocation proof storage path.");
  }
  const { error } = await createAdminClient()
    .storage.from(SKEAP_REVOCATION_PROOF_BUCKET)
    .remove([path]);
  if (error) throw new Error(`Proof cleanup failed: ${error.message}`);
}
