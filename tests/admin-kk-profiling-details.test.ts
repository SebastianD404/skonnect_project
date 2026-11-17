import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  findRegistration: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));
vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    profilingRegistration: { findUnique: mocks.findRegistration },
  },
}));

import { GET } from "@/app/api/admin/kk-profiling/[id]/route";

describe("admin KK profiling details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: "SK_OFFICIAL" });
    mocks.findRegistration.mockResolvedValue({
      id: "registration-1",
      fullName: "Example Member",
      user: {
        id: "member-1",
        kkProfile: {
          fullName: "Example Member",
          purok: "Purok 1",
          barangay: "Pico",
          birthDate: new Date("2000-01-01"),
          placeOfBirth: "Benguet",
          contactNumber: "09123456789",
          sex: "FEMALE",
          email: "member@example.test",
        },
      },
    });
  });

  it("returns KK profile details without including linked SKEAP family data", async () => {
    const request = new NextRequest("http://localhost/api/admin/kk-profiling/registration-1");
    const response = await GET(request, { params: Promise.resolve({ id: "registration-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.kkProfile).toMatchObject({
      fullName: "Example Member",
      purok: "Purok 1",
      barangay: "Pico",
    });
    expect(data.kkProfile).not.toHaveProperty("guardianOrEmergencyName");
    expect(data).not.toHaveProperty("familyBackground");
    expect(data.user).toBeUndefined();
    expect(mocks.findRegistration).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "registration-1" },
      include: {
        user: {
          select: {
            kkProfile: {
              select: {
                fullName: true,
                purok: true,
                barangay: true,
                birthDate: true,
                placeOfBirth: true,
                contactNumber: true,
                sex: true,
                email: true,
              },
            },
          },
        },
      },
    }));
  });
});
