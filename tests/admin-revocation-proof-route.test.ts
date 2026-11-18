import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  findUser: vi.fn(),
  findGrantee: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.findUser },
    grantee: { findUnique: mocks.findGrantee },
  },
}));
vi.mock("@/lib/private-documents", () => ({
  PRIVATE_DOCUMENT_BUCKET: "private-documents",
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({ createSignedUrl: mocks.createSignedUrl })),
    },
  })),
}));

import { GET } from "@/app/api/admin/grantees/[id]/revocation-proof/route";

const context = { params: Promise.resolve({ id: "grantee-1" }) };

describe("admin revocation proof URL", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-auth-id" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: "SK_OFFICIAL" });
    mocks.findUser.mockResolvedValue({ isActive: true });
    mocks.findGrantee.mockResolvedValue({
      id: "grantee-1",
      revocationProofPath: "revocation-proofs/grantee-1/proof.pdf",
      revocationProofFileName: "proof.pdf",
      revocationProofType: "Police Report / Blotter",
      revocationProofHash: "a".repeat(64),
      revocationProofMimeType: "application/pdf",
    });
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example/signed-proof" },
      error: null,
    });
  });

  it("only creates a 60-second signed URL for an active SK official", async () => {
    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      signedUrl: "https://storage.example/signed-proof",
      fileName: "proof.pdf",
      proofType: "Police Report / Blotter",
      proofHash: "a".repeat(64),
      mimeType: "application/pdf",
    });
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      "grantee-1/proof.pdf",
      60,
    );
  });

  it("returns the specified not-found response when no proof is attached", async () => {
    mocks.findGrantee.mockResolvedValueOnce({
      id: "grantee-1",
      revocationProofPath: null,
    });

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "No supporting proof document is attached to this record.",
    });
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });

  it("preserves compatibility with prefixed objects in the proof bucket", async () => {
    mocks.createSignedUrl
      .mockResolvedValueOnce({ data: null, error: { message: "Object not found" } })
      .mockResolvedValueOnce({
        data: { signedUrl: "https://storage.example/legacy-proof" },
        error: null,
      });

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(200);
    expect(mocks.createSignedUrl).toHaveBeenNthCalledWith(1, "grantee-1/proof.pdf", 60);
    expect(mocks.createSignedUrl).toHaveBeenNthCalledWith(
      2,
      "revocation-proofs/grantee-1/proof.pdf",
      60,
    );
  });

  it("logs the storage error and returns the secure-preview error response", async () => {
    const storageError = { message: "Storage service unavailable" };
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.createSignedUrl.mockResolvedValue({ data: null, error: storageError });

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Unable to generate secure preview link for this document.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Could not create SKEAP revocation proof URL",
      storageError,
    );
    consoleError.mockRestore();
  });

  it("rejects non-admin roles before querying private proof metadata", async () => {
    mocks.ensureProfile.mockResolvedValueOnce({ id: "resident-1", role: "YOUTH" });

    const response = await GET(new Request("http://localhost"), context);

    expect(response.status).toBe(403);
    expect(mocks.findGrantee).not.toHaveBeenCalled();
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });
});
