import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { findMany: mocks.findMany },
  },
}));

import { GET } from "@/app/api/my/notifications/route";

describe("age-out notification navigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-id" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "member-id" });
    mocks.findMany.mockResolvedValue([{
      sourceKey: "kk-age-out:registration-id",
      message: "KK age-limit update: Your KK youth profile has been archived.",
      isRead: false,
      createdAt: new Date("2026-11-17T00:00:00.000Z"),
    }]);
  });

  it("links age-out notifications to the member-facing KK status page", async () => {
    const response = await GET();
    const body = await response.json();

    expect(body.notifications[0]).toMatchObject({
      id: "kk-age-out:registration-id",
      href: "/programs/kk-profiling/status",
    });
  });
});
