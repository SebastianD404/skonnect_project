import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  countApprovedProfiles: vi.fn(),
  countActiveGrantees: vi.fn(),
}));

vi.mock("@/lib/approved-kk-profile-count", () => ({
  getApprovedKkProfileCount: mocks.countApprovedProfiles,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    grantee: { count: mocks.countActiveGrantees },
  },
}));

import { GET } from "@/app/api/homepage-metrics/route";

describe("homepage metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.countApprovedProfiles.mockResolvedValue(943);
    mocks.countActiveGrantees.mockResolvedValue(54);
  });

  it("uses the approved KK profile count shown on the admin dashboard", async () => {
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ approvedKkProfileCount: 943, activeScholarCount: 54 });
    expect(mocks.countApprovedProfiles).toHaveBeenCalledOnce();
  });
});
