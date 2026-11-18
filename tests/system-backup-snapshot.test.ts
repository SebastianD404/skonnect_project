import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  generate: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({
  prisma: { backupLog: { findFirst: mocks.findFirst } },
}));
vi.mock("@/lib/data-backup", () => ({
  generateSystemBackupSnapshot: mocks.generate,
}));

import { runScheduledBackupIdempotent } from "@/lib/backup/snapshot";

describe("scheduled backup idempotency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns today's completed scheduled backup without generating another", async () => {
    const record = {
      id: "backup-1",
      fileName: "skonnect-backup-2026-11-18-200000.json",
      trigger: "SCHEDULED",
      createdAt: new Date("2026-11-18T12:00:00.000Z"),
    };
    mocks.findFirst.mockResolvedValue(record);

    await expect(runScheduledBackupIdempotent()).resolves.toEqual({
      ok: true,
      skipped: true,
      record,
    });
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trigger: "SCHEDULED",
          status: "COMPLETED",
          createdAt: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }),
        }),
      }),
    );
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("creates a scheduled snapshot when today's completed run is absent", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const log = { id: "backup-2", trigger: "SCHEDULED" };
    mocks.generate.mockResolvedValue({ log, fileName: "backup.json", jsonString: "{}" });

    await expect(runScheduledBackupIdempotent()).resolves.toEqual({
      ok: true,
      skipped: false,
      record: log,
    });
    expect(mocks.generate).toHaveBeenCalledWith({
      actorId: null,
      trigger: "SCHEDULED",
      createdByLabel: "System Cron",
    });
  });
});
