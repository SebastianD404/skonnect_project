import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  findFirst: vi.fn(),
  getLiveBackupRecordCounts: vi.fn(),
  getSystemBackupAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    backupLog: {
      findMany: mocks.findMany,
      findFirst: mocks.findFirst,
    },
  },
}));
vi.mock("@/lib/data-backup", () => ({
  getLiveBackupRecordCounts: mocks.getLiveBackupRecordCounts,
}));
vi.mock("@/lib/system-backup-auth", () => ({
  getSystemBackupAdmin: mocks.getSystemBackupAdmin,
}));

import { GET } from "@/app/api/admin/backups/route";

describe("/api/admin/backups", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-18T12:15:00.000Z"));
    mocks.getSystemBackupAdmin.mockResolvedValue({ admin: { id: "admin-1" } });
    mocks.findMany.mockResolvedValue([]);
    mocks.findFirst.mockResolvedValue(null);
    mocks.getLiveBackupRecordCounts.mockResolvedValue({ users: 3839 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns protected counts when backup history query fails on missing database columns", async () => {
    mocks.findMany.mockRejectedValueOnce(new Error("P2022: column does not exist"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.error).toBe("Unable to load backup history.");
    expect(body.recentBackups).toEqual([]);
    expect(body.liveRecordCounts).toEqual({ users: 3839 });
    expect(body.schedulerStatus).toBe("UNKNOWN");
  });

  it("returns failed cron error details when protected record count queries fail", async () => {
    mocks.findMany
      .mockResolvedValueOnce([{
        id: "backup-1",
        fileName: "scheduled.json",
        trigger: "SCHEDULED",
        status: "FAILED",
        recordCounts: { users: 3839 },
        fileSizeBytes: 120,
        checksumSha256: "checksum",
        createdAt: new Date("2026-11-17T16:00:00.000Z"),
        createdBy: null,
        errorMessage: "Supabase storage upload failed",
      }])
      .mockResolvedValueOnce([{ status: "FAILED", createdAt: new Date("2026-11-17T16:00:00.000Z") }]);
    mocks.getLiveBackupRecordCounts.mockRejectedValue(new Error("count query unavailable"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.error).toBe("Unable to load protected record counts.");
    expect(body.recentBackups).toHaveLength(1);
    expect(body.recentBackups[0].errorMessage).toBe("Supabase storage upload failed");
    expect(body.liveRecordCounts).toBeNull();
    expect(body.schedulerStatus).toBe("MISSED");
    expect(mocks.findMany).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ take: 30, orderBy: { createdAt: "desc" } }),
    );
  });

  it("marks the scheduled backup due after 12:00 AM PHT", async () => {
    vi.setSystemTime(new Date("2026-11-18T16:01:00.000Z"));

    const response = await GET();
    const body = await response.json();

    expect(body.schedulerStatus).toBe("MISSED");
    expect(body.currentPhtHour).toBe(0);
    expect(body.currentPhtMinute).toBe(1);
  });
});
