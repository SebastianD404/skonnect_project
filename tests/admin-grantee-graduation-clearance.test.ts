import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  transaction: vi.fn(),
  hasRetentionColumn: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/prisma", () => ({
  hasGranteeRetentionColumn: mocks.hasRetentionColumn,
  prisma: { $transaction: mocks.transaction },
}));

import { POST } from "@/app/api/admin/grantees/[id]/graduate/route";

describe("grantee graduation clearance gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-admin-1" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: "SK_OFFICIAL" });
  });

  it.each([
    [{ schoolClearanceVerified: true, skClearanceVerified: false }],
    [{ schoolClearanceVerified: false, skClearanceVerified: true }],
    [{ schoolClearanceVerified: false, skClearanceVerified: false }],
  ])("rejects graduation unless both clearance checks are true", async (body) => {
    const request = new NextRequest("http://localhost/api/admin/grantees/grantee-1/graduate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });

    const response = await POST(request, { params: Promise.resolve({ id: "grantee-1" }) });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Both school and SK Office clearance checks are required before graduation.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
