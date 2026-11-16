import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  findUser: vi.fn(),
  findRegistration: vi.fn(),
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
    user: { findUnique: mocks.findUser },
    profilingRegistration: { findFirst: mocks.findRegistration },
  },
}));

import { GET } from "@/app/api/my/kk-profile/route";

describe("GET /api/my/kk-profile age-out status", () => {
  const archivedAt = new Date("2026-11-17T00:00:00.000Z");
  const birthDate = new Date("1990-01-01T00:00:00.000Z");

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-id" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "member-id" });
    mocks.findUser.mockResolvedValue({
      id: "member-id",
      fullName: "Aldrin Jay Acosta",
      email: "member@example.com",
      phoneNumber: null,
      kkProfile: {
        id: "kk-profile-id",
        middleName: null,
        fullName: "Aldrin Jay Acosta",
        purok: "Purok 1",
        addressLine: "Barangay Pico",
        barangay: "Pico",
        birthDate,
        placeOfBirth: null,
        contactNumber: "09171234567",
        email: "member@example.com",
        isVerified: false,
      },
    });
  });

  it("returns an archived member's page notice even though the KK profile is no longer verified", async () => {
    mocks.findRegistration
      .mockResolvedValueOnce({
        id: "registration-id",
        fullName: "Aldrin Jay Acosta",
        reviewStatus: "Archived",
        birthDate,
        submittedAt: new Date("2024-01-01T00:00:00.000Z"),
      })
      .mockResolvedValueOnce({ archivedAt });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      hasVerifiedKkProfile: false,
      requiresKkProfiling: false,
      profile: {
        status: "Archived",
        ageOutNotice: { archivedAt: archivedAt.toISOString() },
        registration: { reviewStatus: "Archived" },
      },
    });
  });

  it("continues to require profiling for ordinary unverified profiles", async () => {
    mocks.findRegistration
      .mockResolvedValueOnce({
        id: "registration-id",
        fullName: "Aldrin Jay Acosta",
        reviewStatus: "Pending",
        birthDate,
      })
      .mockResolvedValueOnce(null);

    const response = await GET();
    const body = await response.json();

    expect(body).toMatchObject({
      profile: null,
      hasVerifiedKkProfile: false,
      requiresKkProfiling: true,
    });
  });
});
