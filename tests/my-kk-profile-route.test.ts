import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  ensureProfile: vi.fn(),
  userFindUnique: vi.fn(),
  registrationFindFirst: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}));

vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique },
    profilingRegistration: { findFirst: mocks.registrationFindFirst },
  },
}));

import { GET } from "@/app/api/my/kk-profile/route";

describe("GET /api/my/kk-profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "auth-user-1" } },
          error: null,
        }),
      },
    });
    mocks.ensureProfile.mockResolvedValue({ id: "user-1" });
    mocks.registrationFindFirst.mockResolvedValue(null);
  });

  it("returns HTTP 200 with a null profile for a new authenticated user", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "user-1",
      fullName: "New Youth",
      email: "youth@example.com",
      phoneNumber: null,
      kkProfile: null,
    });

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      profile: null,
      hasVerifiedKkProfile: false,
      requiresKkProfiling: true,
    });
  });

  it.each(["Pending", "Returned"])(
    "returns %s registration details even without a KKProfile row",
    async (reviewStatus) => {
      const registration = {
        id: "registration-1",
        middleName: "A.",
        fullName: "Returned Applicant",
        address: "Purok 2, Pico, La Trinidad, Benguet",
        sex: "Female",
        age: 19,
        birthDate: new Date("2007-01-10T00:00:00.000Z"),
        email: "returned@example.com",
        facebook: "",
        contactNumber: "09123456789",
        civilStatus: "Single",
        youthClassification: "In school",
        youthAgeGroup: "19-24",
        workStatus: "Student",
        educationalBackground: "College",
        registeredSKVoter: "Yes",
        votedLastSK: "Yes",
        registeredNationalVoter: "Yes",
        attendedKKAssembly: "No",
        assemblyTimes: null,
        noAssemblyReason: "No assembly attended",
        reviewStatus,
        reviewNotes: "Please upload a clearer ID.",
        withdrawnAt: null,
        withdrawalReason: null,
        submittedAt: new Date("2026-11-16T00:00:00.000Z"),
        idDocumentType: "Valid ID + Certificate of Residency",
        idFrontFileUrl: "front-url",
        idBackFileUrl: "back-url",
        idSingleFileUrl: "residency-url",
        photoFileUrl: "photo-url",
        birthCertificateFileUrl: "birth-url",
      };
      mocks.userFindUnique.mockResolvedValue({
        id: "user-1",
        fullName: "Returned Applicant",
        email: "returned@example.com",
        phoneNumber: "09123456789",
        kkProfile: null,
      });
      mocks.registrationFindFirst.mockImplementation(
        async (args: { where: { archivedReason?: unknown } }) =>
          args.where.archivedReason ? null : registration,
      );

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toMatchObject({
        profile: {
          fullName: "Returned Applicant",
          status: reviewStatus,
          reviewNotes: "Please upload a clearer ID.",
          registration: {
            id: "registration-1",
            reviewStatus,
            idBackFileUrl: "back-url",
          },
        },
        hasVerifiedKkProfile: false,
        requiresKkProfiling: true,
      });
    },
  );
});
