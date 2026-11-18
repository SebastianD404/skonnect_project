import { File } from "node:buffer";
import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getBucket: vi.fn(),
  createBucket: vi.fn(),
  from: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      getBucket: mocks.getBucket,
      createBucket: mocks.createBucket,
      from: mocks.from,
    },
  })),
}));

import {
  storeSkeapRevocationProof,
  validateSkeapRevocationProof,
} from "@/lib/skeap-revocation-proof";
import { SKEAP_REVOCATION_PROOF_BUCKET } from "@/lib/skeap-revocation";

const proofType = "Barangay Incident Report";

describe("SKEAP revocation proof validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getBucket.mockResolvedValue({ data: { name: SKEAP_REVOCATION_PROOF_BUCKET }, error: null });
    mocks.createBucket.mockResolvedValue({ data: null, error: null });
    mocks.upload.mockResolvedValue({ data: {}, error: null });
    mocks.remove.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue({ upload: mocks.upload, remove: mocks.remove });
  });

  it("accepts supported document signatures and hashes the uploaded bytes", async () => {
    const bytes = Buffer.from("%PDF-1.7\nincident report");
    const file = new File([bytes], "incident-report.pdf", { type: "application/pdf" });

    const proof = await validateSkeapRevocationProof(file, "grantee-1", proofType);

    expect(proof).toMatchObject({
      path: expect.stringMatching(/^grantee-1\//),
      fileName: "incident-report.pdf",
      proofType,
      hash: createHash("sha256").update(bytes).digest("hex"),
      mimeType: "application/pdf",
    });
  });

  it("rejects unsupported MIME types, extensions, and file signatures", async () => {
    const invalidMime = new File(["%PDF-1.7"], "proof.exe", { type: "application/octet-stream" });
    const invalidSignature = new File(["not a PDF"], "proof.pdf", { type: "application/pdf" });

    await expect(validateSkeapRevocationProof(invalidMime, "grantee-1", proofType))
      .rejects.toThrow("Upload a PDF, JPG, PNG, or WEBP proof document.");
    await expect(validateSkeapRevocationProof(invalidSignature, "grantee-1", proofType))
      .rejects.toThrow("The uploaded file does not match its declared document type.");
  });

  it("rejects files larger than 10 MB and unknown proof types", async () => {
    const tooLarge = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "proof.pdf", { type: "application/pdf" });
    const validPdf = new File(["%PDF-1.7\n"], "proof.pdf", { type: "application/pdf" });

    await expect(validateSkeapRevocationProof(tooLarge, "grantee-1", proofType))
      .rejects.toThrow("Supporting proof must be a non-empty file of 10 MB or less.");
    await expect(validateSkeapRevocationProof(validPdf, "grantee-1", "Other"))
      .rejects.toThrow("Select a valid supporting proof document type.");
  });

  it("accepts a specified Other proof type and rejects short or oversized specifications", async () => {
    const validPdf = new File(["%PDF-1.7\n"], "proof.pdf", { type: "application/pdf" });

    await expect(validateSkeapRevocationProof(validPdf, "grantee-1", "Other: Sworn Affidavit"))
      .resolves.toMatchObject({ proofType: "Other: Sworn Affidavit" });
    await expect(validateSkeapRevocationProof(validPdf, "grantee-1", "Other: ab"))
      .rejects.toThrow("Select a valid supporting proof document type.");
    await expect(validateSkeapRevocationProof(validPdf, "grantee-1", `Other: ${"x".repeat(81)}`))
      .rejects.toThrow("Select a valid supporting proof document type.");
  });

  it("creates the private proof bucket before uploading and reports upload failures", async () => {
    mocks.getBucket.mockResolvedValueOnce({ data: null, error: { message: "Bucket not found" } });
    const file = new File(["%PDF-1.7\nincident report"], "incident.pdf", { type: "application/pdf" });

    await storeSkeapRevocationProof(file, "grantee-1", proofType);

    expect(mocks.createBucket).toHaveBeenCalledWith(SKEAP_REVOCATION_PROOF_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    });
    expect(mocks.from).toHaveBeenCalledWith(SKEAP_REVOCATION_PROOF_BUCKET);
    expect(mocks.upload).toHaveBeenCalledOnce();

    mocks.upload.mockResolvedValueOnce({ data: null, error: { message: "storage unavailable" } });
    await expect(storeSkeapRevocationProof(file, "grantee-1", proofType))
      .rejects.toThrow("Proof upload failed: storage unavailable");
  });

  it("reports a clear error if the private proof bucket cannot be created", async () => {
    mocks.getBucket
      .mockResolvedValueOnce({ data: null, error: { message: "Bucket not found" } })
      .mockResolvedValueOnce({ data: null, error: { message: "Bucket not found" } });
    mocks.createBucket.mockResolvedValueOnce({ data: null, error: { message: "Permission denied" } });
    const file = new File(["%PDF-1.7\nincident report"], "incident.pdf", { type: "application/pdf" });

    await expect(storeSkeapRevocationProof(file, "grantee-1", proofType))
      .rejects.toThrow("Could not create revocation-proofs bucket: Permission denied");
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
