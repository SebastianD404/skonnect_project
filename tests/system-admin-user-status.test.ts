import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  transaction: vi.fn(),
  writeAuditLog: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
    },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
}));

vi.mock("@/lib/audit/logger", () => ({
  writeAuditLog: mocks.writeAuditLog,
}));

import { PATCH } from "@/app/api/system-admin/users/[id]/route";

describe("system-admin user status updates", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "auth-admin" } },
    });
    mocks.ensureProfile.mockResolvedValue({
      id: "admin-profile",
      role: "SUPER_ADMIN",
    });
  });

  it("rejects deactivation of a SUPER_ADMIN before updating or auditing", async () => {
    mocks.findUnique.mockResolvedValue({
      id: "target-profile",
      fullName: "System Admin",
      email: "admin@example.com",
      phoneNumber: null,
      role: "SUPER_ADMIN",
      isActive: true,
    });
    const request = new NextRequest("http://localhost/api/system-admin/users/target-profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: false }),
    });

    const response = await PATCH(request, {
      params: Promise.resolve({ id: "target-profile" }),
    });
    if (!response) throw new Error("PATCH did not return a response.");

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "SUPER_ADMIN accounts cannot be deactivated.",
    });
    expect(mocks.transaction).not.toHaveBeenCalled();
    expect(mocks.writeAuditLog).not.toHaveBeenCalled();
  });
});
