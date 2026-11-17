import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  lockCapacity: vi.fn(),
  capacitySnapshot: vi.fn(),
  reindexWaitlist: vi.fn(),
  getWaitlistSnapshot: vi.fn(),
  sendEmail: vi.fn(),
  notifyRequirements: vi.fn(),
  logAuditEvent: vi.fn(),
  revalidatePath: vi.fn(),
  findPriorAgeOut: vi.fn(),
  findApplication: vi.fn(),
  findOtherOffers: vi.fn(),
  findOfferNotifications: vi.fn(),
  findGrantee: vi.fn(),
  updateApplication: vi.fn(),
  updateInquiry: vi.fn(),
  updateUser: vi.fn(),
  upsertGrantee: vi.fn(),
  upsertPayout: vi.fn(),
  findPayout: vi.fn(),
  findAcademicSchedules: vi.fn(),
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

vi.mock("@/lib/grantee-notifications", () => ({
  notifyGranteesToUploadRequirements: mocks.notifyRequirements,
}));

vi.mock("@/lib/grantee-profile", () => ({
  GRANTEE_PLACEHOLDER_SCHOOL: "Unknown",
  GRANTEE_PLACEHOLDER_YEAR_LEVEL: "Unknown",
}));

vi.mock("@/lib/skeap-payout", () => ({
  getSkeapGrantAmount: () => 5000,
}));

vi.mock("@/lib/skeap-capacity", () => ({
  DEFAULT_SKEAP_MAX_SLOTS: 55,
  getSkeapCapacitySnapshot: mocks.capacitySnapshot,
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
  getSkeapWaitlistSnapshot: mocks.getWaitlistSnapshot,
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
      findMany: mocks.findOtherOffers,
      update: mocks.updateApplication,
    },
    notification: { findMany: mocks.findOfferNotifications },
    grantee: {
      findUnique: mocks.findGrantee,
      upsert: mocks.upsertGrantee,
    },
    accountingPayout: {
      findUnique: mocks.findPayout,
      upsert: mocks.upsertPayout,
    },
    academicTermSchedule: { findMany: mocks.findAcademicSchedules },
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
      waitlistOfferStatus: "OFFERED",
      waitlistOfferExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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
    mocks.upsertGrantee.mockResolvedValue({
      id: "grantee-1",
      entryAcademicYear: "2026-2027",
      entrySemester: "Second Semester",
    });
    mocks.upsertPayout.mockResolvedValue({ id: "payout-1" });
    mocks.findPayout.mockResolvedValue(null);
    mocks.findAcademicSchedules.mockResolvedValue([
      {
        id: "active-term",
        semester: "2026-2027 Second Semester",
        opensAt: new Date(Date.now() - 60_000),
        closesAt: new Date(Date.now() + 60_000),
      },
    ]);
    mocks.capacitySnapshot.mockResolvedValue({
      activeCount: 10,
      maxSlots: 55,
      availableSlots: 45,
      isFull: false,
    });
    mocks.getWaitlistSnapshot.mockResolvedValue({
      activeCount: 11,
      maxSlots: 55,
      offeredCount: 1,
      openSlotCount: 0,
    });
    mocks.sendEmail.mockResolvedValue(true);
    mocks.notifyRequirements.mockResolvedValue({ notified: 1, emailSent: 1, skipped: 0, errors: [] });
    mocks.findPriorAgeOut.mockResolvedValue(null);
    mocks.findOtherOffers.mockResolvedValue([]);
    mocks.findOfferNotifications.mockResolvedValue([{ message: "Please present your CTC documents." }]);
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

  it("does not admit an applicant without an active slot offer", async () => {
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "WAITLISTED",
      submittedAt: new Date(),
      waitlistOfferStatus: "NONE",
      waitlistOfferExpiresAt: null,
      dateOfBirth: new Date("2000-01-01T00:00:00.000Z"),
      physicalDocumentsConfirmed: true,
      userId: "user-1",
      applicantName: "Sample Applicant",
      user: { email: "applicant@example.com", kkProfile: { birthDate: new Date("2000-01-01T00:00:00.000Z") } },
      school: "Example University",
      currentCourse: "Computer Science",
      yearLevel: "1st Year",
      inquiry: { id: "inquiry-1" },
    });

    const response = await POST(createRequest(true), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Promotion endpoint did not return a response.");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Applicant must have an active slot offer before admission.",
    });
    expect(mocks.updateApplication).not.toHaveBeenCalled();
  });

  it("confirms documents and promotes the applicant in the transaction", async () => {
    const response = await POST(createRequest(true), {
      params: Promise.resolve({ id: "application-1" }),
    });
    if (!response) throw new Error("Promotion endpoint did not return a response.");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      activeCount: 11,
      maxSlots: 55,
      offeredCount: 1,
      openSlotCount: 0,
    });
    expect(mocks.getWaitlistSnapshot).toHaveBeenCalledTimes(1);
    expect(mocks.updateApplication).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: {
        status: "APPROVED",
        waitlistPosition: null,
        waitlistOfferStatus: "NONE",
        waitlistOfferedAt: null,
        waitlistOfferExpiresAt: null,
        waitlistOfferReminderSentAt: null,
        physicalDocumentsConfirmed: true,
      },
    });
    expect(mocks.updateUser).toHaveBeenCalledWith({
      where: { id: "user-1" },
      data: { role: "GRANTEE" },
    });
    expect(mocks.upsertGrantee).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        status: "ACTIVE",
        entryAcademicYear: "2026-2027",
        entrySemester: "Second Semester",
      }),
      update: expect.objectContaining({ status: "ACTIVE" }),
    }));
    expect(mocks.upsertPayout).toHaveBeenCalledWith({
      where: { granteeId: "grantee-1" },
      create: {
        granteeId: "grantee-1",
        amount: 5000,
        semester: "2026-2027 Second Semester",
        status: "NOT_YET_FILED",
      },
      update: {},
    });
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.anything(),
      "user-1",
      "applicant@example.com",
      "Your SKEAP scholarship application was approved",
      expect.stringContaining("2026-2027 Second Semester"),
    );
    expect(mocks.notifyRequirements).toHaveBeenCalledWith({
      targetUserIds: ["user-1"],
      schoolYear: "2026-2027",
      semester: "Second Semester",
      trigger: "GRANTEE_APPROVED",
    });
    expect(mocks.reindexWaitlist).toHaveBeenCalled();
  });

  it("allows an overdue manual offer to be promoted after physical verification", async () => {
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "WAITLISTED",
      submittedAt: new Date(),
      waitlistOfferStatus: "EXPIRED",
      waitlistOfferExpiresAt: new Date(Date.now() - 60 * 60 * 1000),
      dateOfBirth: new Date("2000-01-01T00:00:00.000Z"),
      physicalDocumentsConfirmed: true,
      userId: "user-1",
      applicantName: "Sample Applicant",
      user: {
        email: "applicant@example.com",
        kkProfile: { birthDate: new Date("2000-01-01T00:00:00.000Z") },
      },
      school: "Example University",
      currentCourse: "Computer Science",
      yearLevel: "1st Year",
      inquiry: { id: "inquiry-1" },
    });

    const response = await POST(createRequest(true), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Promotion endpoint did not return a response.");
    expect(response.status).toBe(200);
    expect(mocks.updateApplication).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "application-1" },
      data: expect.objectContaining({ status: "APPROVED" }),
    }));
  });

  it("corrects an unfiled payout to the grantee's persisted entry semester", async () => {
    mocks.findPayout.mockResolvedValue({
      status: "PENDING",
      disbursedAt: null,
    });

    await POST(createRequest(true), {
      params: Promise.resolve({ id: "application-1" }),
    });

    expect(mocks.upsertPayout).toHaveBeenCalledWith({
      where: { granteeId: "grantee-1" },
      create: {
        granteeId: "grantee-1",
        amount: 5000,
        semester: "2026-2027 Second Semester",
        status: "NOT_YET_FILED",
      },
      update: {
        amount: 5000,
        semester: "2026-2027 Second Semester",
        status: "NOT_YET_FILED",
      },
    });
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
