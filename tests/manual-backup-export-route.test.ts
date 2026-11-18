import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  createSnapshot: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/system-backup-auth", () => ({
  getSystemBackupAdmin: mocks.getAdmin,
}));
vi.mock("@/lib/backup/snapshot", () => ({
  createSystemBackupSnapshot: mocks.createSnapshot,
}));
vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { POST } from "@/app/api/admin/backups/export/route";

describe("manual backup export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdmin.mockResolvedValue({ admin: { id: "admin-1" } });
    mocks.createSnapshot.mockResolvedValue({
      fileName: "skonnect-backup-2026-11-18-200000.json",
      jsonString: "{\"data\":{}}",
      log: {
        id: "backup-1",
        trigger: "MANUAL",
        fileSizeBytes: 12,
        checksumSha256: "checksum",
        storagePath: "manual/2026-11-18/skonnect-backup-2026-11-18-200000.json",
        recordCounts: { users: 1 },
      },
    });
    mocks.writeAuditLog.mockResolvedValue(undefined);
  });

  it("creates a stored manual snapshot, audits it, and downloads the JSON", async () => {
    const response = await POST();
    if (!response) throw new Error("Manual export route did not return a response.");

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(
      "skonnect-backup-2026-11-18-200000.json",
    );
    expect(await response.text()).toBe("{\"data\":{}}");
    expect(mocks.createSnapshot).toHaveBeenCalledWith({
      type: "MANUAL",
      createdBy: "Super Admin",
      createdById: "admin-1",
    });
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        action: "SYSTEM_BACKUP_CREATED",
        actorId: "admin-1",
        targetTable: "backup_logs",
        targetId: "backup-1",
      }),
    );
  });
});
