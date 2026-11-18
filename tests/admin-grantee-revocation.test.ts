import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  notificationFindUnique: vi.fn(),
  notificationUpdateMany: vi.fn(),
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  writeAuditLog: vi.fn(),
  sendEmail: vi.fn(),
  refreshView: vi.fn(),
  downgradeRole: vi.fn(),
  revalidatePath: vi.fn(),
  storeProof: vi.fn(),
  removeProof: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    grantee: {
      findUnique: mocks.notificationFindUnique,
      updateMany: mocks.notificationUpdateMany,
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

vi.mock("@/lib/grantee-role", () => ({
  downgradeInactiveGranteeRole: mocks.downgradeRole,
}));

vi.mock("@/lib/grantee-archive-view", () => ({
  refreshInactiveGranteesView: mocks.refreshView,
}));

vi.mock("@/lib/skeap-capacity", () => ({
  getSkeapCapacitySnapshot: vi.fn(),
  lockSkeapCapacity: vi.fn(),
}));

vi.mock("@/lib/skeap-waitlist", () => ({
  reindexSkeapWaitlist: vi.fn(),
}));

vi.mock("@/lib/skeap-revocation-email", () => ({
  sendSkeapRevocationEmail: mocks.sendEmail,
}));

vi.mock("@/lib/skeap-revocation-proof", () => ({
  InvalidSkeapRevocationProofError: class InvalidSkeapRevocationProofError extends Error {},
  storeSkeapRevocationProof: mocks.storeProof,
  removeSkeapRevocationProof: mocks.removeProof,
}));

import { PATCH } from "@/app/api/admin/grantees/[id]/route";

const validReason = "OTHER_SCHOLARSHIP";
const validReasonLabel = "Became a grantee of another scholarship agency";
const additionalNotes = "Another agency";

let grantee: {
  id: string;
  userId: string;
  status: string;
  graduatedAt: Date | null;
  dateRemoved: Date | null;
  revocationReason: string | null;
  revocationNotes: string | null;
  revocationProofType: string | null;
  isPermanentlyDisqualified: boolean;
  revocationNotificationStatus: string;
  revocationNotificationAttempts: number;
  revocationNotificationError: string | null;
  revocationNotificationSentAt: Date | null;
  updatedAt: Date;
  user: { id: string; email: string; fullName: string; role: string };
};

function applyUpdate(data: Record<string, unknown>) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && "increment" in value) {
      grantee[key as keyof typeof grantee] =
        (Number(grantee[key as keyof typeof grantee]) + Number(value.increment)) as never;
    } else {
      grantee[key as keyof typeof grantee] = value as never;
    }
  }
  grantee.updatedAt = new Date();
}

function createTransactionClient() {
  return {
    grantee: {
      findUnique: vi.fn(async () => ({
        ...grantee,
        user: { ...grantee.user },
      })),
      updateMany: vi.fn(async ({ where, data }: {
        where: { id: string; status: string };
        data: Record<string, unknown>;
      }) => {
        if (where.id !== grantee.id || where.status !== grantee.status) return { count: 0 };
        applyUpdate(data);
        return { count: 1 };
      }),
    },
    user: { update: vi.fn() },
    skeapApplication: {
      findMany: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
    },
  };
}

function createRequest(
  reason = validReason,
  notes = additionalNotes,
  isPermanentlyDisqualified = false,
  proofType = "",
) {
  return new NextRequest("http://localhost/api/admin/grantees/grantee-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "REVOKED", reason, additionalNotes: notes, isPermanentlyDisqualified, proofType }),
  });
}

function createProofRequest(
  notes = "Incident on 2026-01-02; report BR-42",
  proofType = "Barangay Incident Report",
) {
  const formData = new FormData();
  formData.set("status", "REVOKED");
  formData.set("reason", "UNBECOMING_ACTS");
  formData.set("additionalNotes", notes);
  formData.set("isPermanentlyDisqualified", "true");
  formData.set("proofType", proofType);
  formData.set("proofFile", new File(["%PDF-1.7\nreport"], "incident.pdf", { type: "application/pdf" }));
  return new NextRequest("http://localhost/api/admin/grantees/grantee-1", {
    method: "PATCH",
    body: formData,
  });
}

async function revoke(
  reason = validReason,
  notes = additionalNotes,
  isPermanentlyDisqualified = false,
  proofType = "",
) {
  return PATCH(createRequest(reason, notes, isPermanentlyDisqualified, proofType), {
    params: Promise.resolve({ id: "grantee-1" }),
  });
}

describe("active grantee revocation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grantee = {
      id: "grantee-1",
      userId: "user-1",
      status: "ACTIVE",
      graduatedAt: null,
      dateRemoved: null,
      revocationReason: null,
      revocationNotes: null,
      revocationProofType: null,
      isPermanentlyDisqualified: false,
      revocationNotificationStatus: "NOT_REQUIRED",
      revocationNotificationAttempts: 0,
      revocationNotificationError: null,
      revocationNotificationSentAt: null,
      updatedAt: new Date(),
      user: {
        id: "user-1",
        email: "student@example.com",
        fullName: "Student Name",
        role: "GRANTEE",
      },
    };

    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-auth-id" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-id", role: "SK_OFFICIAL" });
    mocks.notificationFindUnique.mockImplementation(async () => ({
      revocationNotificationStatus: grantee.revocationNotificationStatus,
    }));
    mocks.notificationUpdateMany.mockImplementation(async ({ where, data }: {
      where: {
        id: string;
        status: string;
        OR?: Array<Record<string, unknown>>;
        revocationNotificationStatus?: string;
      };
      data: Record<string, unknown>;
    }) => {
      if (where.id !== grantee.id || where.status !== "REVOKED") return { count: 0 };
      if (where.OR) {
        const canClaim =
          grantee.revocationNotificationStatus === "PENDING" ||
          grantee.revocationNotificationStatus === "FAILED";
        if (!canClaim) return { count: 0 };
      } else if (where.revocationNotificationStatus !== grantee.revocationNotificationStatus) {
        return { count: 0 };
      }
      applyUpdate(data);
      return { count: 1 };
    });
    mocks.transaction.mockImplementation(async (callback) => callback(createTransactionClient()));
    mocks.sendEmail.mockResolvedValue(undefined);
    mocks.refreshView.mockResolvedValue(undefined);
    mocks.storeProof.mockResolvedValue({
      path: "grantee-1/proof-incident.pdf",
      fileName: "incident.pdf",
      proofType: "Barangay Incident Report",
      hash: "a".repeat(64),
      mimeType: "application/pdf",
    });
    mocks.removeProof.mockResolvedValue(undefined);
  });

  it("revokes, audits, notifies, and refreshes the archive", async () => {
    const response = await revoke();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      success: true,
      revocationStatus: "REVOKED",
      notificationStatus: "SENT",
      archiveRefreshStatus: "REFRESHED",
    });

    expect(grantee).toMatchObject({
      status: "REVOKED",
      revocationReason: validReasonLabel,
      revocationNotes: additionalNotes,
      revocationNotificationStatus: "SENT",
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
    expect(mocks.refreshView).toHaveBeenCalledOnce();
    expect(mocks.revalidatePath.mock.calls.map(([path]) => path)).toEqual([
      "/",
      "/admin",
      "/admin/grantees",
      "/admin/skeap-waitlist",
      "/programs/skeap",
    ]);
  });

  it("persists an explicit permanent disqualification", async () => {
    const response = await revoke(validReason, additionalNotes, true);

    expect(response.status).toBe(200);
    expect(grantee.isPermanentlyDisqualified).toBe(true);
  });

  it("rejects human-readable reason labels instead of enum keys", async () => {
    const response = await revoke(validReasonLabel);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Select a valid reason for revocation.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects a missing or too-short revocation reason", async () => {
    const response = await revoke(" ");
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Select a valid reason for revocation.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("requires an incident summary and proof file for unbecoming-acts revocations", async () => {
    const missingSummary = await PATCH(createProofRequest(" "), {
      params: Promise.resolve({ id: "grantee-1" }),
    });
    expect(missingSummary.status).toBe(400);
    expect((await missingSummary.json()).error).toBe("Incident summary and case details are required.");

    const missingProof = await revoke("UNBECOMING_ACTS", "Incident details", false, "Barangay Incident Report");
    expect(missingProof.status).toBe(400);
    expect((await missingProof.json()).error).toBe("A valid supporting proof document is required.");
    expect(mocks.storeProof).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejects missing, invalid, or underspecified proof types", async () => {
    for (const proofType of ["", "Others", "Other: ab", "Unknown Document"]) {
      const response = await PATCH(createProofRequest(undefined, proofType), {
        params: Promise.resolve({ id: "grantee-1" }),
      });

      expect(response.status).toBe(400);
      expect((await response.json()).error).toContain("Select a valid supporting proof document type.");
    }

    expect(mocks.storeProof).not.toHaveBeenCalled();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("stores proof metadata in the grantee record and audit log", async () => {
    const response = await PATCH(createProofRequest(), {
      params: Promise.resolve({ id: "grantee-1" }),
    });

    expect(response.status).toBe(200);
    expect(grantee).toMatchObject({
      revocationProofPath: "grantee-1/proof-incident.pdf",
      revocationProofFileName: "incident.pdf",
      revocationProofType: "Barangay Incident Report",
      revocationProofHash: "a".repeat(64),
      revocationProofMimeType: "application/pdf",
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({
          revocationProofType: "Barangay Incident Report",
          revocationProofFileName: "incident.pdf",
          revocationProofHash: "a".repeat(64),
        }),
      }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      reason: "Committed acts unbecoming of a student",
      additionalNotes: "Incident on 2026-01-02; report BR-42",
    }));
  });

  it("stores and audits a specified Other proof type", async () => {
    const proofType = "Other: Sworn Affidavit";
    mocks.storeProof.mockResolvedValueOnce({
      path: "grantee-1/proof-incident.pdf",
      fileName: "incident.pdf",
      proofType,
      hash: "a".repeat(64),
      mimeType: "application/pdf",
    });

    const response = await PATCH(createProofRequest(undefined, proofType), {
      params: Promise.resolve({ id: "grantee-1" }),
    });

    expect(response.status).toBe(200);
    expect(mocks.storeProof).toHaveBeenCalledWith(expect.anything(), "grantee-1", proofType);
    expect(grantee.revocationProofType).toBe(proofType);
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        metadata: expect.objectContaining({ revocationProofType: proofType }),
      }),
    );
  });

  it("returns the database error when the status transaction fails", async () => {
    const databaseError = Object.assign(new Error("missing revocation column"), { code: "P2022" });
    mocks.transaction.mockRejectedValueOnce(databaseError);

    const response = await revoke();
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toBe("missing revocation column");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.refreshView).not.toHaveBeenCalled();
  });

  it("removes the uploaded proof if the database transaction fails", async () => {
    const databaseError = new Error("Database update failed");
    mocks.transaction.mockRejectedValueOnce(databaseError);

    const response = await PATCH(createProofRequest(), {
      params: Promise.resolve({ id: "grantee-1" }),
    });

    expect(response.status).toBe(500);
    expect((await response.json()).error).toBe("Database update failed");
    expect(mocks.removeProof).toHaveBeenCalledWith("grantee-1/proof-incident.pdf");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("saves the revocation after email failure and retries without duplicating the audit", async () => {
    mocks.sendEmail
      .mockRejectedValueOnce(new Error("SMTP unavailable"))
      .mockResolvedValueOnce(undefined);

    const firstResponse = await revoke();
    const firstPayload = await firstResponse.json();
    expect(firstResponse.status).toBe(502);
    expect(firstPayload).toMatchObject({
      success: false,
      revocationStatus: "REVOKED",
      notificationStatus: "FAILED",
    });
    expect(grantee.status).toBe("REVOKED");

    const retryResponse = await revoke();
    const retryPayload = await retryResponse.json();
    expect(retryResponse.status).toBe(200);
    expect(retryPayload.notificationStatus).toBe("SENT");
    expect(grantee.revocationNotificationStatus).toBe("SENT");
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
    expect(mocks.sendEmail).toHaveBeenCalledTimes(2);
  });

  it("treats a duplicate successful request as idempotent", async () => {
    const firstResponse = await revoke();
    expect(firstResponse.status).toBe(200);
    const retryResponse = await revoke();
    const retryPayload = await retryResponse.json();

    expect(retryResponse.status).toBe(200);
    expect(retryPayload.notificationStatus).toBe("SENT");
    expect(grantee.status).toBe("REVOKED");
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });

  it("reports archive refresh failure without implying the revocation failed", async () => {
    mocks.refreshView.mockRejectedValueOnce(new Error("view refresh failed"));

    const response = await revoke();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload).toMatchObject({
      success: false,
      revocationStatus: "REVOKED",
      notificationStatus: "SENT",
      archiveRefreshStatus: "FAILED",
    });
    expect(grantee.status).toBe("REVOKED");
    expect(mocks.writeAuditLog).toHaveBeenCalledOnce();
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });
});
