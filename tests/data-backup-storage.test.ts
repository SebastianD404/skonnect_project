import { beforeEach, describe, expect, it, vi } from "vitest";
import { gunzipSync, gzipSync } from "node:zlib";

const mocks = vi.hoisted(() => ({
  createAdminClient: vi.fn(),
  listBuckets: vi.fn(),
  createBucket: vi.fn(),
  updateBucket: vi.fn(),
  upload: vi.fn(),
  remove: vi.fn(),
  createSignedUrl: vi.fn(),
  download: vi.fn(),
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: mocks.createAdminClient,
}));

import {
  createSystemBackupSignedUrl,
  persistScheduledBackup,
  persistSystemBackup,
  SYSTEM_BACKUP_BUCKET,
} from "@/lib/data-backup-storage";

describe("system backup storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.from.mockImplementation(() => ({
      upload: mocks.upload,
      remove: mocks.remove,
      createSignedUrl: mocks.createSignedUrl,
      download: mocks.download,
    }));
    mocks.createAdminClient.mockReturnValue({
      storage: {
        listBuckets: mocks.listBuckets,
        createBucket: mocks.createBucket,
        updateBucket: mocks.updateBucket,
        from: mocks.from,
      },
    });
    mocks.listBuckets
      .mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({
        data: [{ name: SYSTEM_BACKUP_BUCKET, public: false }],
        error: null,
      });
    mocks.createBucket.mockResolvedValue({ error: null });
    mocks.updateBucket.mockResolvedValue({ error: null });
    mocks.upload
      .mockResolvedValueOnce({
        error: { statusCode: "404", message: "Bucket not found" },
      })
      .mockResolvedValueOnce({ error: null });
  });

  it("creates a private bucket and retries when upload reports it missing", async () => {
    await expect(
      persistScheduledBackup("backup.json", "{\"ok\":true}"),
    ).resolves.toBe("scheduled/backup.json.gz");

    expect(mocks.createBucket).toHaveBeenCalledWith(
      SYSTEM_BACKUP_BUCKET,
      expect.objectContaining({ public: false, fileSizeLimit: 52428800 }),
    );
    expect(mocks.upload).toHaveBeenCalledTimes(2);
    expect(mocks.upload).toHaveBeenLastCalledWith(
      "scheduled/backup.json.gz",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/gzip" }),
    );
    expect(gunzipSync(mocks.upload.mock.calls[1][1]).toString("utf8")).toBe("{\"ok\":true}");
    expect(mocks.updateBucket).toHaveBeenCalledWith(
      SYSTEM_BACKUP_BUCKET,
      expect.objectContaining({ public: false, fileSizeLimit: 52428800 }),
    );
  });

  it("stores manual backups in a PHT-date folder", async () => {
    mocks.upload.mockResolvedValue({ error: null });
    mocks.listBuckets.mockResolvedValue({
      data: [{ name: SYSTEM_BACKUP_BUCKET, public: false }],
      error: null,
    });

    await expect(
      persistSystemBackup("MANUAL", "2026-11-18", "backup.json", "{\"ok\":true}"),
    ).resolves.toBe("manual/2026-11-18/backup.json.gz");
    expect(mocks.upload).toHaveBeenCalledWith(
      "manual/2026-11-18/backup.json.gz",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "application/gzip" }),
    );
    expect(mocks.updateBucket).toHaveBeenCalledWith(
      SYSTEM_BACKUP_BUCKET,
      expect.objectContaining({ public: false, fileSizeLimit: 52428800 }),
    );
  });

  it("creates a 60-second signed download URL for a stored backup", async () => {
    mocks.listBuckets.mockResolvedValue({
      data: [{ name: SYSTEM_BACKUP_BUCKET, public: false }],
      error: null,
    });
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example.test/signed" },
      error: null,
    });

    await expect(
      createSystemBackupSignedUrl(
        "scheduled/2026-11-18/backup.json",
        "backup.json",
      ),
    ).resolves.toBe("https://storage.example.test/signed");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      "scheduled/2026-11-18/backup.json",
      60,
      { download: "backup.json" },
    );
  });

  it("accepts legacy scheduled backup paths", async () => {
    mocks.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example.test/legacy" },
      error: null,
    });

    await expect(
      createSystemBackupSignedUrl("scheduled/legacy-backup.json", "legacy-backup.json"),
    ).resolves.toBe("https://storage.example.test/legacy");
  });

  it("decompresses gzip snapshots and returns existing JSON snapshots unchanged", async () => {
    const { downloadScheduledBackup } = await import("@/lib/data-backup-storage");
    const json = "{\"ok\":true}";
    mocks.download
      .mockResolvedValueOnce({
        data: new Blob([gzipSync(Buffer.from(json, "utf8"))]),
        error: null,
      })
      .mockResolvedValueOnce({
        data: new Blob([json]),
        error: null,
      });

    await expect(
      downloadScheduledBackup("backup.json.gz", "scheduled/backup.json.gz"),
    ).resolves.toEqual(Buffer.from(json, "utf8"));
    await expect(
      downloadScheduledBackup("legacy.json", "scheduled/legacy.json"),
    ).resolves.toEqual(Buffer.from(json, "utf8"));
  });

  it("removes a set of valid scheduled snapshot paths", async () => {
    mocks.remove.mockResolvedValue({ error: null });
    const { removeScheduledBackupFiles } = await import("@/lib/data-backup-storage");

    await removeScheduledBackupFiles([
      "scheduled/old-a.json",
      "scheduled/old-a.json.gz",
      "scheduled/old-b.json",
    ]);

    expect(mocks.remove).toHaveBeenCalledWith([
      "scheduled/old-a.json",
      "scheduled/old-a.json.gz",
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
