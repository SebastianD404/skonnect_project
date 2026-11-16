import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  auditCount: vi.fn(),
  auditFindMany: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      count: mocks.auditCount,
      findMany: mocks.auditFindMany,
    },
  },
}));

import { GET } from "@/app/api/system-admin/audit/route";

describe("system admin audit unread count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: "SUPER_ADMIN" });
    mocks.auditCount.mockResolvedValue(3);
  });

  it("serves unread count from the registered audit route", async () => {
    const request = new NextRequest(
      "http://localhost/api/system-admin/audit?view=unread-count&since=2026-11-17T00%3A00%3A00.000Z",
    );

    const response = await GET(request);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ count: 3 });
    expect(mocks.auditCount).toHaveBeenCalledWith({
      where: {
        action: { contains: "ROLE", mode: "insensitive" },
        createdAt: { gt: new Date("2026-11-17T00:00:00.000Z") },
      },
    });
    expect(mocks.auditFindMany).not.toHaveBeenCalled();
  });

  it("rejects malformed last-viewed timestamps", async () => {
    const request = new NextRequest(
      "http://localhost/api/system-admin/audit?view=unread-count&since=not-a-date",
    );

    const response = await GET(request);

    expect(response.status).toBe(400);
    expect(mocks.auditCount).not.toHaveBeenCalled();
  });
});
