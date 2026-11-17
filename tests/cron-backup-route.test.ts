import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  generate: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { backupLog: { findFirst: mocks.findFirst } },
}));
vi.mock("@/lib/data-backup", () => ({
  generateSystemBackupSnapshot: mocks.generate,
}));
vi.mock("@/lib/system-backup-auth", () => ({
  getSystemBackupAdmin: mocks.getAdmin,
}));

import { GET, POST } from "@/app/api/cron/backup/route";
import { NextResponse } from "next/server";

describe("/api/cron/backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    mocks.findFirst.mockResolvedValue(null);
    mocks.generate.mockResolvedValue({
      fileName: "backup.json",
      jsonString: "{}",
      log: {
        recordCounts: { users: 1 },
        fileSizeBytes: 2,
        checksumSha256: "abc",
        createdAt: new Date("2026-11-17T16:00:01.000Z"),
      },
    });
    mocks.getAdmin.mockResolvedValue({ admin: { id: "admin-1" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("authenticates scheduled GET requests and checks only automated backups for the PHT day", async () => {
    const response = await GET(
      new Request("https://example.test/api/cron/backup", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          trigger: { in: ["AUTOMATED", "SCHEDULED"] },
          status: "COMPLETED",
          createdAt: expect.objectContaining({ gte: expect.any(Date), lt: expect.any(Date) }),
        }),
      }),
    );
    expect(mocks.generate).toHaveBeenCalledWith({ actorId: null, trigger: "AUTOMATED" });
  });

  it("skips a duplicate scheduled run only after a completed automated backup", async () => {
    mocks.findFirst.mockResolvedValue({
      fileName: "already-backed-up.json",
      fileSizeBytes: 10,
      checksumSha256: "checksum",
      createdAt: new Date("2026-11-17T16:00:01.000Z"),
      recordCounts: { users: 1 },
    });

    const response = await GET(
      new Request("https://example.test/api/cron/backup", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, skipped: true });
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("allows a Super Admin POST to run the automated pipeline without cron deduplication", async () => {
    const response = await POST(new Request("https://example.test/api/cron/backup", { method: "POST" }));

    expect(response.status).toBe(200);
    expect(mocks.getAdmin).toHaveBeenCalledOnce();
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.generate).toHaveBeenCalledWith({ actorId: "admin-1", trigger: "AUTOMATED" });
  });

  it("rejects manual POST requests without a Super Admin session", async () => {
    mocks.getAdmin.mockResolvedValue({
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(new Request("https://example.test/api/cron/backup", { method: "POST" }));

    expect(response.status).toBe(401);
    expect(mocks.generate).not.toHaveBeenCalled();
  });

  it("returns the actual automated backup failure reason", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.generate.mockRejectedValue(new Error("Supabase bucket unavailable"));

    const response = await POST(new Request("https://example.test/api/cron/backup", { method: "POST" }));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: "Automated backup failed: Supabase bucket unavailable",
    });
    consoleError.mockRestore();
  });
});
