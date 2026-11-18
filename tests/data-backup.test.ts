import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  deleteMany: vi.fn(),
  removeScheduledBackupFiles: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    backupLog: {
      findMany: mocks.findMany,
      deleteMany: mocks.deleteMany,
    },
  },
}));
vi.mock("@/lib/audit/logger", () => ({ writeAuditLog: vi.fn() }));
vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshKkProfilingApplicationsAdminView: vi.fn(),
  refreshSkeapApplicationsAdminView: vi.fn(),
}));
vi.mock("@/lib/data-backup-storage", () => ({
  persistScheduledBackup: vi.fn(),
  removeScheduledBackupFiles: mocks.removeScheduledBackupFiles,
}));

import {
  backupTableNames,
  parseAndVerifyBackupSnapshot,
  pruneAutomatedBackupHistory,
} from "@/lib/data-backup";

function createSnapshot() {
  const data: Record<string, unknown[]> = Object.fromEntries(
    backupTableNames.map((table) => [table, []]),
  );
  data.users = [{ id: "profile-1", email: "youth@example.com" }];
  const recordCounts = Object.fromEntries(
    backupTableNames.map((table) => [table, data[table].length]),
  );
  const meta = {
    app: "SKonnect",
    barangay: "Barangay Pico, La Trinidad, Benguet",
    version: "1.0",
    createdAt: "2026-11-16T05:00:00.000Z",
    trigger: "MANUAL",
    recordCounts,
  };
  const checksumSha256 = createHash("sha256")
    .update(JSON.stringify({ meta, data }))
    .digest("hex");
  return { meta, data, checksumSha256 };
}

describe("backup snapshot verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("verifies the checksum and table counts of a supported snapshot", () => {
    const snapshot = createSnapshot();

    expect(parseAndVerifyBackupSnapshot(JSON.stringify(snapshot))).toMatchObject({
      checksumSha256: snapshot.checksumSha256,
      meta: { recordCounts: { users: 1 } },
      data: { users: [{ id: "profile-1", email: "youth@example.com" }] },
    });
  });

  it("rejects a snapshot whose contents changed after its checksum was generated", () => {
    const snapshot = createSnapshot();
    (snapshot.data.users[0] as Record<string, unknown>).email = "modified@example.com";

    expect(() => parseAndVerifyBackupSnapshot(JSON.stringify(snapshot))).toThrow(
      "Backup file failed SHA-256 integrity verification and may be corrupted or modified.",
    );
  });

  it("rejects table counts that do not match the snapshot records", () => {
    const snapshot = createSnapshot();
    snapshot.meta.recordCounts.users = 2;
    snapshot.checksumSha256 = createHash("sha256")
      .update(JSON.stringify({ meta: snapshot.meta, data: snapshot.data }))
      .digest("hex");

    expect(() => parseAndVerifyBackupSnapshot(JSON.stringify(snapshot))).toThrow(
      "Backup file record counts do not match users.",
    );
  });

  it("rejects snapshots with missing required table arrays", () => {
    const snapshot = createSnapshot();
    delete (snapshot.data as Record<string, unknown>).users;

    expect(() => parseAndVerifyBackupSnapshot(JSON.stringify(snapshot))).toThrow(
      "Backup file has an invalid users record list.",
    );
  });

  it("removes old completed automated snapshots before deleting their history rows", async () => {
    mocks.findMany.mockResolvedValue([
      {
        id: "old-completed",
        fileName: "backup-old.json",
        storagePath: "scheduled/backup-old.json",
      },
    ]);

    await expect(pruneAutomatedBackupHistory()).resolves.toBe(1);

    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "COMPLETED" }),
        orderBy: { createdAt: "desc" },
        skip: 30,
      }),
    );
    expect(mocks.removeScheduledBackupFiles).toHaveBeenCalledWith([
      "scheduled/backup-old.json",
    ]);
    expect(mocks.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["old-completed"] } },
    });
  });
});
