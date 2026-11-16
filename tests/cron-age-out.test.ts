import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  sweepAgedOut: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findFirst: mocks.findFirst },
  },
}));

vi.mock("@/lib/archiveAgedOutMembers", () => ({
  sweepAgedOutKkProfiles: mocks.sweepAgedOut,
}));

import { GET } from "@/app/api/cron/age-out-kk-members/route";

describe("age-out cron route", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-cron-secret";
    mocks.findFirst.mockResolvedValue({ id: "official-id" });
    mocks.sweepAgedOut.mockResolvedValue({ archivedCount: 2, closedApplicationCount: 1 });
  });

  it("rejects requests without the configured cron authorization", async () => {
    const response = await GET(new Request("http://localhost/api/cron/age-out-kk-members"));

    expect(response.status).toBe(401);
    expect(mocks.sweepAgedOut).not.toHaveBeenCalled();
  });

  it("runs the age-out archive with an audit actor for an authorized request", async () => {
    const response = await GET(new Request("http://localhost/api/cron/age-out-kk-members", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(200);
    expect(mocks.sweepAgedOut).toHaveBeenCalledWith("official-id", "scheduled");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      archivedCount: 2,
      closedApplicationCount: 1,
    });
  });

  it("reports a configuration error when no audit actor exists", async () => {
    mocks.findFirst.mockResolvedValue(null);

    const response = await GET(new Request("http://localhost/api/cron/age-out-kk-members", {
      headers: { authorization: "Bearer test-cron-secret" },
    }));

    expect(response.status).toBe(503);
    expect(mocks.sweepAgedOut).not.toHaveBeenCalled();
  });

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
  });
});
