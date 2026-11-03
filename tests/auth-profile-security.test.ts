import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userFindFirst: vi.fn(),
  userCreate: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.userFindUnique,
      findFirst: mocks.userFindFirst,
      create: mocks.userCreate,
      update: mocks.userUpdate,
    },
  },
}));

import { ensureProfile } from "@/lib/auth";

describe("ensureProfile security", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not resolve inactive profiles", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "profile-1", isActive: false });

    await expect(
      ensureProfile({ id: "auth-1", email: "official@example.com" }),
    ).resolves.toBeNull();
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });

  it("does not link a new auth identity to an existing profile by email", async () => {
    mocks.userFindUnique.mockResolvedValue(null);
    mocks.userFindFirst.mockResolvedValue({ id: "existing-profile" });

    await expect(
      ensureProfile({ id: "attacker-auth", email: "official@example.com" }),
    ).resolves.toBeNull();
    expect(mocks.userUpdate).not.toHaveBeenCalled();
    expect(mocks.userCreate).not.toHaveBeenCalled();
  });
});
