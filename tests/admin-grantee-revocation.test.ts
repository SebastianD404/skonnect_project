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
  getSkeapCapacityCount: vi.fn(),
  getSkeapMaxSlots: vi.fn(),
  lockSkeapCapacity: vi.fn(),
}));

vi.mock("@/lib/skeap-waitlist", () => ({
  reindexSkeapWaitlist: vi.fn(),
}));

vi.mock("@/lib/skeap-revocation-email", () => ({
  sendSkeapRevocationEmail: mocks.sendEmail,
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

function createRequest(reason = validReason, notes = additionalNotes) {
  return new NextRequest("http://localhost/api/admin/grantees/grantee-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "REVOKED", reason, additionalNotes: notes }),
  });
}

async function revoke(reason = validReason, notes = additionalNotes) {
  return PATCH(createRequest(reason, notes), {
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
  });

  it("rejects human-readable reason labels instead of enum keys", async () => {
    const response = await revoke(validReasonLabel);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error).toBe("Select a valid reason for revocation.");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("returns an explicit migration error when the database schema is behind", async () => {
    const databaseError = Object.assign(new Error("missing revocation column"), { code: "P2022" });
    mocks.transaction.mockRejectedValueOnce(databaseError);

    const response = await revoke();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.code).toBe("DATABASE_MIGRATION_REQUIRED");
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.refreshView).not.toHaveBeenCalled();
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
