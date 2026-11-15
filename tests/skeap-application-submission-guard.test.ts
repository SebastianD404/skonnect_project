import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  findCurrentIdentity: vi.fn(),
  findInquiry: vi.fn(),
  findCycleApplication: vi.fn(),
  findPriorRevocation: vi.fn(),
  getPermanentRecords: vi.fn(),
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
    user: { findUnique: mocks.findCurrentIdentity },
    inquiry: { findFirst: mocks.findInquiry },
    grantee: { findFirst: mocks.findPriorRevocation },
    $queryRaw: mocks.findCycleApplication,
  },
}));

vi.mock("@/lib/skeap-permanent-disqualification-records", () => ({
  getPermanentlyDisqualifiedSkeapRecords: mocks.getPermanentRecords,
}));

import { GET, POST } from "@/app/api/skeap/applications/route";

describe("SKEAP application submission revocation guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "user-1", kkStatus: "APPROVED" });
    mocks.findCurrentIdentity.mockResolvedValue(null);
    mocks.findInquiry.mockResolvedValue(null);
    mocks.findPriorRevocation.mockResolvedValue(null);
    mocks.findCycleApplication.mockResolvedValue([]);
    mocks.getPermanentRecords.mockResolvedValue([]);
  });

  it.each([
    { status: "APPROVED", expectedFiles: {} },
    {
      status: "RETURNED_FOR_EDIT",
      expectedFiles: {
        incomeCertificate: {
          url: "https://example.com/income.pdf",
          name: "income.pdf",
        },
      },
    },
  ])("returns only eligible current-cycle uploads for a $status application", async ({ status, expectedFiles }) => {
    mocks.findCycleApplication.mockResolvedValue([{
      status,
      uploadedFiles: {
        incomeCertificate: {
          url: "https://example.com/income.pdf",
          name: "income.pdf",
          adminRemark: "Internal reviewer note",
        },
        birthCertificate: { url: "https://example.com/birth.pdf" },
      },
    }]);
    mocks.findPriorRevocation.mockResolvedValue({ id: "revoked-1" });

    const response = await GET();
    const result = await response.json();

    expect(response.status).toBe(200);
    expect(result.initialUploadedFiles).toEqual(expectedFiles);
    expect(result.hasPriorRevocation).toBe(true);
  });

  it.each([
    {
      label: "explicit disqualification",
      record: { isPermanentlyDisqualified: true, reason: "Low GWA" },
    },
    {
      label: "legacy revocation reason",
      record: { isPermanentlyDisqualified: false, reason: "Acts unbecoming of a student" },
    },
  ])("returns 403 for $label", async ({ record }) => {
    mocks.getPermanentRecords.mockResolvedValue([{
      id: "revoked-1",
      userId: "user-1",
      kkProfileId: "old-profile",
      identityFingerprint: null,
      fullName: "Jane Applicant",
      revokedAt: null,
      firstName: "Jane",
      middleName: "A",
      lastName: "Applicant",
      dateOfBirth: new Date("2008-07-14T00:00:00.000Z"),
      ...record,
    }]);

    const response = await POST(new NextRequest("http://localhost/api/skeap/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    }));

    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      eligible: false,
      reason: "PERMANENTLY_DISQUALIFIED",
      error: "You are permanently ineligible to reapply for SKEAP due to a prior conduct or disciplinary revocation.",
    });
  });
});
