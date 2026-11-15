import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $queryRaw: mocks.queryRaw },
}));

import { getApprovedKkProfileCount } from "@/lib/approved-kk-profile-count";

describe("approved KK profile count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("counts unique identities with an approved KK profiling registration", async () => {
    mocks.queryRaw.mockResolvedValue([{ count: 943 }]);

    await expect(getApprovedKkProfileCount()).resolves.toBe(943);

    const query = (mocks.queryRaw.mock.calls[0][0] as TemplateStringsArray).join("");
    expect(query).toContain('registration."reviewStatus" = \'Approved\'');
    expect(query).toContain("identity_rank = 1");
    expect(query).toContain('public."kk_profiling_registrations"');
  });

  it("returns zero when there are no approved profiles", async () => {
    mocks.queryRaw.mockResolvedValue([]);

    await expect(getApprovedKkProfileCount()).resolves.toBe(0);
  });
});
