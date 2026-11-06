import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  signInWithPassword: vi.fn(),
  signOut: vi.fn(),
  ensureProfile: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
    },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithPassword: mocks.signInWithPassword,
      signOut: mocks.signOut,
    },
  })),
}));

vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
  getRoleHomePath: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
}));

import { login } from "@/app/actions/auth";

describe("login with a deactivated account", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the deactivated-account error and clears the authenticated session", async () => {
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "inactive@example.com" } },
      error: null,
    });
    mocks.findUnique.mockResolvedValue({ isActive: false });
    mocks.signOut.mockResolvedValue({ error: null });

    const formData = new FormData();
    formData.set("email", "inactive@example.com");
    formData.set("password", "correct-password");

    await expect(login(null, formData)).resolves.toEqual({
      error: "ACCOUNT_DEACTIVATED",
    });
    expect(mocks.signOut).toHaveBeenCalledOnce();
    expect(mocks.ensureProfile).not.toHaveBeenCalled();
  });
});
