import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  parseSnapshot: vi.fn(),
  restoreSnapshot: vi.fn(),
  ValidationError: class BackupSnapshotValidationError extends Error {
    code: string;
    constructor(message: string, code = "INVALID_SCHEMA") {
      super(message);
      this.code = code;
    }
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/data-backup", () => ({
  BackupSnapshotValidationError: mocks.ValidationError,
  BackupRestoreCommittedError: class BackupRestoreCommittedError extends Error {},
  parseAndVerifyBackupSnapshot: mocks.parseSnapshot,
  verifyAndRestoreBackupSnapshot: mocks.restoreSnapshot,
}));

import { POST } from "@/app/api/admin/backups/restore/route";

function makeRequest(intent: string, confirmation?: string) {
  const formData = new FormData();
  formData.set("file", new File(['{"snapshot":true}'], "backup.json", { type: "application/json" }));
  formData.set("intent", intent);
  if (confirmation) formData.set("confirmation", confirmation);
  return new Request("http://localhost/api/admin/backups/restore", {
    method: "POST",
    body: formData,
  });
}

async function postRestore(request: Request) {
  const response = await POST(request);
  if (!response) throw new Error("Restore route did not return a response.");
  return response;
}

describe("admin backup restore authorization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "supabase-user" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "system-admin-profile", role: "SUPER_ADMIN" });
    mocks.parseSnapshot.mockReturnValue({
      checksumSha256: "a".repeat(64),
      meta: { recordCounts: { users: 1 } },
    });
    mocks.restoreSnapshot.mockResolvedValue({
      checksumSha256: "a".repeat(64),
      restoredCounts: { users: 1 },
      summary: { created: 1, updated: 0, skipped: 0 },
    });
  });

  it("denies SK Officials with the system-backup authorization error", async () => {
    mocks.ensureProfile.mockResolvedValueOnce({ id: "official-profile", role: "SK_OFFICIAL" });

    const response = await postRestore(makeRequest("verify"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Only System Administrators can access system backups and recovery.",
    });
    expect(mocks.parseSnapshot).not.toHaveBeenCalled();
    expect(mocks.restoreSnapshot).not.toHaveBeenCalled();
  });

  it("allows a System Admin to verify a snapshot without restoring it", async () => {
    const response = await postRestore(makeRequest("verify"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      checksumVerified: true,
      recordCounts: { users: 1 },
    });
    expect(mocks.parseSnapshot).toHaveBeenCalledWith('{"snapshot":true}');
    expect(mocks.restoreSnapshot).not.toHaveBeenCalled();
  });

  it("requires the exact RESTORE confirmation before executing a restore", async () => {
    const response = await postRestore(makeRequest("restore", "restore"));

    expect(response.status).toBe(400);
    expect(mocks.restoreSnapshot).not.toHaveBeenCalled();
  });

  it("passes the verified upload and internal admin profile id into restore", async () => {
    const response = await postRestore(makeRequest("restore", "RESTORE"));

    expect(response.status).toBe(200);
    expect(mocks.restoreSnapshot).toHaveBeenCalledWith({
      rawContent: '{"snapshot":true}',
      actorId: "system-admin-profile",
    });
    await expect(response.json()).resolves.toEqual({
      ok: true,
      summary: { created: 1, updated: 0, skipped: 0 },
    });
  });

  it("reports checksum verification failures separately from restore failures", async () => {
    mocks.parseSnapshot.mockImplementationOnce(() => {
      throw new mocks.ValidationError(
        "Backup file failed SHA-256 integrity verification.",
        "CHECKSUM_MISMATCH",
      );
    });

    const response = await postRestore(makeRequest("verify"));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Backup file failed SHA-256 integrity verification.",
      code: "CHECKSUM_MISMATCH",
    });
  });

  it("returns a clean Prisma code and summary for database restore failures", async () => {
    mocks.restoreSnapshot.mockRejectedValue(Object.assign(
      new Error("Unique constraint failed"),
      { code: "P2002", meta: { modelName: "User", target: ["email"] } },
    ));

    const response = await postRestore(makeRequest("restore", "RESTORE"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toMatchObject({
      code: "PRISMA_P2002",
      error: "Database restore failed (P2002, User): A unique constraint conflicts with an existing record (email).",
    });
  });

  it("strips Prisma invocation paths and code frames from transaction timeout errors", async () => {
    const rawError = Object.assign(
      new Error("Invalid `tx.user.update()` invocation in C:\\app\\lib\\data-backup.ts:123:45\n\n  120 await prisma.$transaction([\n  121   tx.user.update(...)\nTransaction already closed: query expired."),
      { code: "P2028", meta: { modelName: "User" } },
    );
    mocks.restoreSnapshot.mockRejectedValueOnce(rawError);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const response = await postRestore(makeRequest("restore", "RESTORE"));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "PRISMA_P2028",
      error: "Database restore failed (P2028): Transaction expired while syncing User records.",
    });
    expect(consoleError).toHaveBeenCalledWith(
      "System backup verification or restore failed:",
      expect.objectContaining({ error: rawError, stack: rawError.stack }),
    );
    consoleError.mockRestore();
  });

});
