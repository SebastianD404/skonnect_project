import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runBackup: vi.fn(),
  getAdmin: vi.fn(),
}));

vi.mock("@/lib/backup/snapshot", () => ({
  runScheduledBackupIdempotent: mocks.runBackup,
}));
vi.mock("@/lib/system-backup-auth", () => ({
  getSystemBackupAdmin: mocks.getAdmin,
}));

import { GET, POST } from "@/app/api/cron/daily-backup/route";
import { NextResponse } from "next/server";

describe("/api/cron/daily-backup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("CRON_SECRET", "test-cron-secret");
    mocks.runBackup.mockResolvedValue({
      ok: true,
      skipped: false,
      record: { id: "backup-1", fileName: "scheduled.json" },
    });
    mocks.getAdmin.mockResolvedValue({ admin: { id: "admin-1" } });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts a valid cron bearer token and returns the scheduled backup record", async () => {
    const response = await GET(
      new Request("https://example.test/api/cron/daily-backup", {
        headers: { authorization: "Bearer test-cron-secret" },
      }),
    );
    if (!response) throw new Error("Cron route did not return a response.");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      skipped: false,
      message: "Today's scheduled backup completed.",
      record: { id: "backup-1", fileName: "scheduled.json" },
    });
    expect(mocks.getAdmin).not.toHaveBeenCalled();
    expect(mocks.runBackup).toHaveBeenCalledWith("System Cron");
  });

  it("allows an authenticated system administrator to run now", async () => {
    const response = await POST(
      new Request("https://example.test/api/cron/daily-backup", { method: "POST" }),
    );
    if (!response) throw new Error("Cron route did not return a response.");

    expect(response.status).toBe(200);
    expect(mocks.getAdmin).toHaveBeenCalledOnce();
    expect(mocks.runBackup).toHaveBeenCalledWith("System Cron");
  });

  it("rejects requests without a cron secret or administrator session", async () => {
    mocks.getAdmin.mockResolvedValue({
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    });

    const response = await POST(
      new Request("https://example.test/api/cron/daily-backup", { method: "POST" }),
    );
    if (!response) throw new Error("Cron route did not return a response.");

    expect(response.status).toBe(401);
    expect(mocks.runBackup).not.toHaveBeenCalled();
  });
});
