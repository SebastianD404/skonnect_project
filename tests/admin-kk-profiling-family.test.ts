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

describe("admin KK profiling family details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: "SK_OFFICIAL" });
    mocks.findRegistration.mockResolvedValue({
      id: "registration-1",
      fullName: "Example Member",
      user: {
        id: "member-1",
        kkProfile: { guardianOrEmergencyName: "Example Guardian" },
        skeapApplications: [{
          id: "skeap-1",
          status: "REJECTED",
          fathersName: "Example Father",
          totalFamilyMonthlyIncome: "25000",
        }],
      },
    });
  });

  it("hydrates the latest linked SKEAP family record regardless of status", async () => {
    const request = new NextRequest("http://localhost/api/admin/kk-profiling/registration-1");
    const response = await GET(request, { params: Promise.resolve({ id: "registration-1" }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.familyBackground).toEqual({
      kkProfile: { guardianOrEmergencyName: "Example Guardian" },
      skeapApplication: expect.objectContaining({
        status: "REJECTED",
        fathersName: "Example Father",
      }),
    });
    expect(data.user).toBeUndefined();
    expect(mocks.findRegistration).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "registration-1" },
      include: {
        user: {
          include: {
            kkProfile: true,
            skeapApplications: expect.objectContaining({
              take: 1,
              orderBy: [{ submittedAt: "desc" }, { updatedAt: "desc" }],
            }),
          },
        },
      },
    }));
    const query = mocks.findRegistration.mock.calls[0][0];
    expect(query.include.user.include.skeapApplications.where).toBeUndefined();
  });
});
