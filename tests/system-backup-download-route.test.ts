import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getAdmin: vi.fn(),
  findUnique: vi.fn(),
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/system-backup-auth", () => ({
  getSystemBackupAdmin: mocks.getAdmin,
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { backupLog: { findUnique: mocks.findUnique } },
}));
vi.mock("@/lib/data-backup-storage", () => ({
  createSystemBackupSignedUrl: mocks.createSignedUrl,
}));

import { GET } from "@/app/api/system-admin/backup/[id]/download/route";

describe("system backup signed download route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAdmin.mockResolvedValue({ admin: { id: "admin-1" } });
    mocks.findUnique.mockResolvedValue({
      fileName: "skonnect-backup-2026-11-18-200000.json",
      status: "COMPLETED",
      storagePath: "scheduled/2026-11-18/skonnect-backup-2026-11-18-200000.json",
    });
    mocks.createSignedUrl.mockResolvedValue("https://storage.example.test/signed-file");
  });

  it("redirects authorized admins to a signed stored backup download", async () => {
    const response = await GET(
      new Request("https://example.test/api/system-admin/backup/backup-1/download"),
      { params: Promise.resolve({ id: "backup-1" }) },
    );
    if (!response) throw new Error("Backup download route did not return a response.");

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://storage.example.test/signed-file");
    expect(mocks.createSignedUrl).toHaveBeenCalledWith(
      "scheduled/2026-11-18/skonnect-backup-2026-11-18-200000.json",
      "skonnect-backup-2026-11-18-200000.json",
    );
  });
});
