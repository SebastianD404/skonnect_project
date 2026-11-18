import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  listBuckets: vi.fn(),
  createBucket: vi.fn(),
  updateBucket: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import { persistScheduledBackup, SYSTEM_BACKUP_BUCKET } from "@/lib/data-backup-storage";

describe("persistScheduledBackup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createAdminClient.mockReturnValue({
      storage: {
        listBuckets: mocks.listBuckets,
        createBucket: mocks.createBucket,
        updateBucket: mocks.updateBucket,
        from: vi.fn(() => ({ upload: mocks.upload, remove: mocks.remove })),
      },
    });
    mocks.listBuckets
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ name: SYSTEM_BACKUP_BUCKET, public: false }],
        error: null,
      });
    mocks.createBucket.mockResolvedValue({ error: null });
    mocks.upload
      .mockResolvedValueOnce({
        error: { statusCode: "404", message: "Bucket not found" },
      })
      .mockResolvedValueOnce({ error: null });
  });

  it("creates a private bucket and retries when upload reports it missing", async () => {
    await expect(
      persistScheduledBackup("backup.json", "{\"ok\":true}"),
    ).resolves.toBe("scheduled/backup.json");

    expect(mocks.createBucket).toHaveBeenCalledWith(
      SYSTEM_BACKUP_BUCKET,
      expect.objectContaining({ public: false }),
    );
    expect(mocks.upload).toHaveBeenCalledTimes(2);
  });

  it("removes a set of valid scheduled snapshot paths", async () => {
    mocks.remove.mockResolvedValue({ error: null });
    const { removeScheduledBackupFiles } = await import("@/lib/data-backup-storage");

    await removeScheduledBackupFiles([
      "scheduled/old-a.json",
      "scheduled/old-a.json",
      "scheduled/old-b.json",
    ]);

    expect(mocks.remove).toHaveBeenCalledWith([
      "scheduled/old-a.json",
      "scheduled/old-b.json",
    ]);
  });

  it("rejects invalid storage paths before deletion", async () => {
    const { removeScheduledBackupFiles } = await import("@/lib/data-backup-storage");

    await expect(removeScheduledBackupFiles(["../private.json"])).rejects.toThrow(
      "Stored backup path is invalid.",
    );
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
