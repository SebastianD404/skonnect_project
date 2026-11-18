import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  findUnique: vi.fn(),
  download: vi.fn(),
}));

vi.mock("@/lib/system-backup-auth", () => ({
  getSystemBackupAdmin: mocks.getAdmin,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { backupLog: { findUnique: mocks.findUnique } },
}));
vi.mock("@/lib/data-backup-storage", () => ({
  downloadSystemBackup: mocks.download,
}));

import { GET } from "@/app/api/system-admin/backup/[id]/download/route";

describe("system backup signed download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdmin.mockResolvedValue({ admin: { id: "admin-1" } });
    mocks.findUnique.mockResolvedValue({
      fileName: "skonnect-backup-2026-11-18-200000.json",
      status: "COMPLETED",
      storagePath: "scheduled/2026-11-18/skonnect-backup-2026-11-18-200000.json.gz",
    });
    mocks.download.mockResolvedValue(Buffer.from("{\"ok\":true}", "utf8"));
  });

  it("returns an uncompressed JSON attachment for authorized admins", async () => {
    const response = await GET(
      new Request("https://example.test/api/system-admin/backup/backup-1/download"),
      { params: Promise.resolve({ id: "backup-1" }) },
    );
    if (!response) throw new Error("Backup download route did not return a response.");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="skonnect-backup-2026-11-18-200000.json"',
    );
    expect(await response.text()).toBe("{\"ok\":true}");
    expect(mocks.download).toHaveBeenCalledWith(
      "scheduled/2026-11-18/skonnect-backup-2026-11-18-200000.json.gz",
    );
  });
});
