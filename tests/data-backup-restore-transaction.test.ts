import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const createDelegate = () => ({
    findMany: vi.fn(),
    createMany: vi.fn(),
    update: vi.fn(),
  });
  const models = {
    user: createDelegate(),
    kKProfile: createDelegate(),
    profilingRegistration: createDelegate(),
    skeapApplication: createDelegate(),
    grantee: createDelegate(),
    submission: createDelegate(),
    accountingPayout: createDelegate(),
    inquiry: createDelegate(),
    announcement: createDelegate(),
    notification: createDelegate(),
    notificationLog: createDelegate(),
    adminNotification: createDelegate(),
    granteeMessage: createDelegate(),
    registrations: createDelegate(),
    systemSetting: createDelegate(),
    adminSettings: createDelegate(),
    academicTermSchedule: createDelegate(),
    semester: createDelegate(),
    reminderSetting: createDelegate(),
    messageTemplate: createDelegate(),
  };
  return {
    transaction: vi.fn(),
    models,
    transactionBatchSizes: [] as number[],
    writeAuditLog: vi.fn(),
    refreshKkView: vi.fn(),
    refreshSkeapView: vi.fn(),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    ...mocks.models,
    $transaction: mocks.transaction,
  },
}));
vi.mock("@/lib/audit/logger", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshKkProfilingApplicationsAdminView: mocks.refreshKkView,
  refreshSkeapApplicationsAdminView: mocks.refreshSkeapView,
}));
vi.mock("@/lib/data-backup-storage", () => ({ persistScheduledBackup: vi.fn() }));

import {
  backupTableNames,
  verifyAndRestoreBackupSnapshot,
} from "@/lib/data-backup";

function createSnapshot(dataOverrides: Record<string, unknown[]> = {}) {
  const data = Object.fromEntries(
    backupTableNames.map((table) => [table, dataOverrides[table] ?? []]),
  );
  const meta = {
    app: "SKonnect",
    barangay: "Barangay Pico, La Trinidad, Benguet",
    version: "1.0",
    createdAt: "2026-11-18T01:00:00.000Z",
    trigger: "MANUAL",
    recordCounts: Object.fromEntries(
      backupTableNames.map((table) => [table, data[table].length]),
    ),
  };
  const checksumSha256 = createHash("sha256")
    .update(JSON.stringify({ meta, data }))
    .digest("hex");
  return JSON.stringify({ meta, data, checksumSha256 });
}

describe("backup restore batches", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.transactionBatchSizes.length = 0;
    for (const model of Object.values(mocks.models)) {
      model.findMany.mockResolvedValue([]);
      model.createMany.mockResolvedValue({ count: 0 });
      model.update.mockResolvedValue({});
    }
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => {
      mocks.transactionBatchSizes.push(operations.length);
      return Promise.all(operations);
    });
    mocks.writeAuditLog.mockResolvedValue(undefined);
    mocks.refreshKkView.mockResolvedValue(undefined);
    mocks.refreshSkeapView.mockResolvedValue(undefined);
  });

  it("loads existing users once, matches normalized emails, preserves privileged accounts, and remaps references", async () => {
    mocks.models.user.findMany.mockResolvedValue([
      {
        id: "existing-admin",
        email: "ADMIN@example.test",
        role: "SUPER_ADMIN",
      },
      {
        id: "existing-sk-admin",
        email: "skadmin@example.test",
        role: "SK_ADMIN",
      },
    ]);

    await verifyAndRestoreBackupSnapshot({
      rawContent: createSnapshot({
        users: [{
          id: "snapshot-user",
          authId: "snapshot-auth",
          email: "admin@example.test",
          fullName: "Protected Admin",
          role: "YOUTH",
          isActive: false,
        }, {
          id: "existing-sk-admin",
          authId: "existing-sk-auth",
          email: "skadmin@example.test",
          fullName: "Protected SK Admin",
          role: "YOUTH",
          isActive: false,
        }],
        profilingRegistrations: [{
          id: "registration-1",
          userId: "snapshot-user",
          fullName: "Protected Admin",
        }],
      }),
      actorId: "different-admin",
    });

    expect(mocks.models.user.findMany).toHaveBeenCalledTimes(1);
    expect(mocks.models.user.findMany).toHaveBeenCalledWith({
      select: { id: true, email: true, role: true },
    });
    for (const id of ["existing-admin", "existing-sk-admin"]) {
      expect(mocks.models.user.update).toHaveBeenCalledWith(expect.objectContaining({
        where: { id },
        data: expect.not.objectContaining({
          role: expect.anything(),
          isActive: expect.anything(),
        }),
      }));
    }
    expect(mocks.models.profilingRegistration.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ userId: "existing-admin" })],
      skipDuplicates: true,
    });
  });

  it("creates users before profiles and links them after both batches", async () => {
    const events: string[] = [];
    mocks.models.user.createMany.mockImplementation(async () => {
      events.push("users");
      return { count: 1 };
    });
    mocks.models.kKProfile.createMany.mockImplementation(async () => {
      events.push("profiles");
      return { count: 1 };
    });
    mocks.transaction.mockImplementation(async (operations: Promise<unknown>[]) => {
      events.push("link");
      return Promise.all(operations);
    });

    await verifyAndRestoreBackupSnapshot({
      rawContent: createSnapshot({
        users: [{
          id: "user-1",
          authId: "auth-1",
          email: "member@example.test",
          fullName: "Example Member",
          role: "YOUTH",
          kkProfileId: "profile-1",
        }],
        kkProfiles: [{
          id: "profile-1",
          firstName: "Example",
          lastName: "Member",
          fullName: "Example Member",
          purok: "Purok 1",
          addressLine: "Example address",
          birthDate: "2000-01-01T00:00:00.000Z",
          contactNumber: "09123456789",
          email: "member@example.test",
        }],
      }),
      actorId: "admin-1",
    });

    expect(mocks.models.user.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ id: "user-1", kkProfileId: null })],
      skipDuplicates: true,
    });
    expect(mocks.models.kKProfile.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ id: "profile-1" })],
      skipDuplicates: true,
    });
    expect(events).toEqual(["users", "profiles", "link"]);
  });

  it("uses 200-operation array transactions for existing records", async () => {
    const rows = Array.from({ length: 405 }, (_, index) => ({
      id: `registration-${index}`,
      fullName: `Member ${index}`,
    }));
    mocks.models.profilingRegistration.findMany.mockResolvedValue(
      rows.map(({ id }) => ({ id })),
    );

    const result = await verifyAndRestoreBackupSnapshot({
      rawContent: createSnapshot({ profilingRegistrations: rows }),
      actorId: "admin-1",
    });

    expect(mocks.models.profilingRegistration.createMany).not.toHaveBeenCalled();
    expect(mocks.transactionBatchSizes).toEqual([200, 200, 5]);
    expect(result.restoredCounts.profilingRegistrations).toBe(405);
  });

  it("rejects malformed or conflicting user email matches before writing users", async () => {
    await expect(verifyAndRestoreBackupSnapshot({
      rawContent: createSnapshot({
        users: [{ id: "bad-user", email: "not-an-email" }],
      }),
      actorId: "admin-1",
    })).rejects.toThrow("Backup user has an invalid email address.");
    expect(mocks.models.user.createMany).not.toHaveBeenCalled();
  });
});
