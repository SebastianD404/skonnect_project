import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  parseSnapshot: vi.fn(),
  restoreSnapshot: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/data-backup", () => ({
  BackupSnapshotValidationError: class BackupSnapshotValidationError extends Error {},
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
    });
  });

  it("denies SK Officials access to snapshot verification and restore", async () => {
    mocks.ensureProfile.mockResolvedValueOnce({ id: "official-profile", role: "SK_OFFICIAL" });

    const response = await postRestore(makeRequest("verify"));

    expect(response.status).toBe(403);
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
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      restoredCounts: { users: 1 },
    });
  });
});
