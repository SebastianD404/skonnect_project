import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  lockCapacity: vi.fn(),
  capacityCount: vi.fn(),
  maxSlots: vi.fn(),
  reindexWaitlist: vi.fn(),
  sendEmail: vi.fn(),
  logAuditEvent: vi.fn(),
  revalidatePath: vi.fn(),
  findPriorAgeOut: vi.fn(),
  findApplication: vi.fn(),
  findGrantee: vi.fn(),
  updateApplication: vi.fn(),
  updateInquiry: vi.fn(),
  updateUser: vi.fn(),
  upsertGrantee: vi.fn(),
  refreshAdminView: vi.fn(),
  sweepAgedOut: vi.fn(),
  sweepClosedCycles: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    skeapApplication: { findUnique: mocks.findPriorAgeOut },
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: mocks.getUser },
  })),
}));

vi.mock("@/lib/auth", () => ({
  ensureProfile: mocks.ensureProfile,
}));

vi.mock("@/lib/audit/logger", () => ({
  logAuditEvent: mocks.logAuditEvent,
}));

vi.mock("@/lib/broadcast-email", () => ({
  createGmailTransporter: vi.fn(() => ({})),
  sendBroadcastEmail: mocks.sendEmail,
}));

vi.mock("@/lib/grantee-profile", () => ({
  GRANTEE_PLACEHOLDER_SCHOOL: "Unknown",
  GRANTEE_PLACEHOLDER_YEAR_LEVEL: "Unknown",
}));

vi.mock("@/lib/skeap-capacity", () => ({
  DEFAULT_SKEAP_MAX_SLOTS: 55,
  getSkeapCapacityCount: mocks.capacityCount,
  getSkeapMaxSlots: mocks.maxSlots,
  lockSkeapCapacity: mocks.lockCapacity,
}));

vi.mock("@/lib/skeap-school", () => ({
  normalizeSkeapSchoolName: (school: string) => school,
}));

vi.mock("@/lib/grantee-archive-view", () => ({
  refreshInactiveGranteesView: vi.fn(),
}));

vi.mock("@/lib/skeap-waitlist", () => ({
  reindexSkeapWaitlist: mocks.reindexWaitlist,
}));

vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshSkeapApplicationsAdminView: mocks.refreshAdminView,
}));

vi.mock("@/lib/skeap-applications", () => ({
  sweepAgedOutWaitlistApplicants: mocks.sweepAgedOut,
  sweepClosedSkeapWaitlistCycles: mocks.sweepClosedCycles,
}));

vi.mock("@/lib/skeap-age", () => ({
  getExactAge: (birthDate?: Date | null) => {
    if (!birthDate) return null;
    const now = new Date();
    let age = now.getUTCFullYear() - birthDate.getUTCFullYear();
    if (
      now.getUTCMonth() < birthDate.getUTCMonth() ||
      (now.getUTCMonth() === birthDate.getUTCMonth() &&
        now.getUTCDate() < birthDate.getUTCDate())
    ) {
      age -= 1;
    }
    return age;
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import { POST } from "@/app/api/admin/applications/[id]/promote/route";

function createRequest(confirmPhysicalVerification: boolean) {
  return new NextRequest("http://localhost/api/admin/applications/application-1/promote", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ confirmPhysicalVerification }),
  });
}

function createTransactionClient() {
  return {
    $queryRaw: vi.fn(),
    systemSetting: { findUnique: vi.fn() },
    skeapApplication: {
      findUnique: mocks.findApplication,
      update: mocks.updateApplication,
    },
    grantee: {
      findUnique: mocks.findGrantee,
      upsert: mocks.upsertGrantee,
    },
    inquiry: { update: mocks.updateInquiry },
    user: { update: mocks.updateUser },
  };
}

describe("SKEAP waitlist promotion", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-1", email: "admin@example.com" } } });
    mocks.ensureProfile.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      role: "SK_OFFICIAL",
    });
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "WAITLISTED",
      submittedAt: new Date(),
      dateOfBirth: new Date("2000-01-01T00:00:00.000Z"),
      physicalDocumentsConfirmed: false,
      userId: "user-1",
      applicantName: "Sample Applicant",
      user: { email: "applicant@example.com", kkProfile: { birthDate: new Date("2000-01-01T00:00:00.000Z") } },
      school: "Example University",
      currentCourse: "Computer Science",
      yearLevel: "1st Year",
      inquiry: { id: "inquiry-1" },
    });
    mocks.findGrantee.mockResolvedValue(null);
    mocks.capacityCount.mockResolvedValue(10);
    mocks.maxSlots.mockResolvedValue(55);
    mocks.sendEmail.mockResolvedValue(true);
    mocks.findPriorAgeOut.mockResolvedValue(null);
    mocks.sweepAgedOut.mockResolvedValue({ removedCount: 0, removedApplicants: [] });
    mocks.sweepClosedCycles.mockResolvedValue({ closedCount: 0 });
    mocks.transaction.mockImplementation(async (callback) => callback(createTransactionClient()));
  });

  it("does not promote when physical verification was not confirmed", async () => {
    const response = await POST(createRequest(false), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Promotion endpoint did not return a response.");
    expect(response.status).toBe(400);
    expect(mocks.updateApplication).not.toHaveBeenCalled();
    expect(mocks.updateUser).not.toHaveBeenCalled();
    expect(mocks.upsertGrantee).not.toHaveBeenCalled();
  });

  it("confirms documents and promotes the applicant in the transaction", async () => {
    const response = await POST(createRequest(true), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Promotion endpoint did not return a response.");
    expect(response.status).toBe(200);
    expect(mocks.updateApplication).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: {
        status: "APPROVED",
        waitlistPosition: null,
        physicalDocumentsConfirmed: true,
      },
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "GRANTEE" },
    });
    expect(mocks.upsertGrantee).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ status: "ACTIVE" }),
      update: expect.objectContaining({ status: "ACTIVE" }),
    }));
    expect(mocks.reindexWaitlist).toHaveBeenCalled();
  });

  it("removes an applicant who exceeds the age limit instead of promoting them", async () => {
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "WAITLISTED",
      submittedAt: new Date(),
      dateOfBirth: new Date("1990-01-01T00:00:00.000Z"),
      physicalDocumentsConfirmed: true,
      userId: "user-1",
      applicantName: "Sample Applicant",
      user: { email: "applicant@example.com", kkProfile: { birthDate: new Date("1990-01-01T00:00:00.000Z") } },
      school: "Example University",
      currentCourse: "Computer Science",
      yearLevel: "1st Year",
      inquiry: { id: "inquiry-1" },
    });

    const response = await POST(createRequest(true), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Promotion endpoint did not return a response.");
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Applicant has exceeded the maximum eligible age and was automatically removed from the waitlist.",
    });
    expect(mocks.updateApplication).not.toHaveBeenCalled();
    expect(mocks.sweepAgedOut).toHaveBeenCalledTimes(2);
  });
});
