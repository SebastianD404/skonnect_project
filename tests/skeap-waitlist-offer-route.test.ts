import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  getUser: vi.fn(),
  ensureProfile: vi.fn(),
  lockCapacity: vi.fn(),
  capacitySnapshot: vi.fn(),
  cycleState: vi.fn(),
  findApplication: vi.fn(),
  findActiveOffers: vi.fn(),
  findManualOfferNotifications: vi.fn(),
  findCurrentOfferNotifications: vi.fn(),
  updateApplication: vi.fn(),
  notificationUpsert: vi.fn(),
  writeAuditLog: vi.fn(),
  sendEmail: vi.fn(),
  refreshAdminView: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mocks.getUser } })),
}));

vi.mock("@/lib/auth", () => ({ ensureProfile: mocks.ensureProfile }));
vi.mock("@/lib/audit/logger", () => ({ writeAuditLog: mocks.writeAuditLog }));
vi.mock("@/lib/skeap-capacity", () => ({
  getSkeapCapacitySnapshot: mocks.capacitySnapshot,
  lockSkeapCapacity: mocks.lockCapacity,
}));
vi.mock("@/lib/skeap-waitlist", () => ({ reindexSkeapWaitlist: vi.fn() }));
vi.mock("@/lib/skeap-waitlist-cycle", () => ({
  getSkeapWaitlistCycle: () => "2026-2027",
  getSkeapWaitlistCycleState: mocks.cycleState,
}));
vi.mock("@/lib/semester", () => ({
  getAcademicYearDateRange: () => ({
    start: new Date("2026-08-01T00:00:00.000Z"),
    end: new Date("2027-08-01T00:00:00.000Z"),
  }),
}));
vi.mock("@/lib/skeap-waitlist-offers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/skeap-waitlist-offers")>();
  return { ...actual, sendWaitlistSlotOfferEmail: mocks.sendEmail };
});
vi.mock("@/lib/application-admin-view-refresh", () => ({
  refreshSkeapApplicationsAdminView: mocks.refreshAdminView,
}));

import { POST } from "@/app/api/admin/skeap-applications/waitlist/[id]/offer/route";

const message = "Present your original / CTC documents at Barangay Pico Hall by the deadline.";

function createRequest(
  deadline: string | null = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
) {
  return new NextRequest("http://localhost/api/admin/skeap-applications/waitlist/application-1/offer", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(deadline ? { deadline, message } : { message }),
  });
}

function createTransactionClient() {
  return {
    skeapApplication: {
      findUnique: mocks.findApplication,
      findMany: mocks.findActiveOffers,
      update: mocks.updateApplication,
    },
    notification: {
      findMany: vi.fn()
        .mockImplementationOnce(mocks.findCurrentOfferNotifications)
        .mockImplementationOnce(mocks.findManualOfferNotifications),
      upsert: mocks.notificationUpsert,
    },
  };
}

describe("SKEAP manual waitlist slot offer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
    mocks.ensureProfile.mockResolvedValue({ id: "admin-1", role: "SK_OFFICIAL" });
    mocks.cycleState.mockResolvedValue({ isClosed: false });
    mocks.capacitySnapshot.mockResolvedValue({ availableSlots: 1 });
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "WAITLISTED",
      submittedAt: new Date("2026-10-01T00:00:00.000Z"),
      applicantName: "Sample Applicant",
      emailAddress: "applicant@example.com",
      userId: "user-1",
      waitlistOfferStatus: "NONE",
      waitlistOfferedAt: null,
      waitlistOfferExpiresAt: null,
      waitlistPosition: 1,
      user: { fullName: "Sample Applicant", email: "applicant@example.com" },
    });
    mocks.findActiveOffers.mockResolvedValue([]);
    mocks.findManualOfferNotifications.mockResolvedValue([]);
    mocks.findCurrentOfferNotifications.mockResolvedValue([]);
    mocks.updateApplication.mockResolvedValue({});
    mocks.notificationUpsert.mockResolvedValue({});
    mocks.writeAuditLog.mockResolvedValue({});
    mocks.sendEmail.mockResolvedValue(undefined);
    mocks.refreshAdminView.mockResolvedValue(undefined);
    mocks.transaction.mockImplementation(async (callback) => callback(createTransactionClient()));
  });

  it("records the custom offer, notification, audit log, and email", async () => {
    const deadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const response = await POST(createRequest(deadline.toISOString()), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Offer endpoint did not return a response.");
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      emailSent: true,
      deadline: deadline.toISOString(),
      application: {
        waitlistOfferStatus: "OFFERED",
        waitlistOfferedAt: expect.any(String),
        waitlistOfferExpiresAt: deadline.toISOString(),
        waitlistOfferMessage: message,
      },
    });
    expect(mocks.updateApplication).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: expect.objectContaining({
        waitlistOfferStatus: "OFFERED",
        waitlistOfferExpiresAt: deadline,
        waitlistOfferReminderSentAt: null,
      }),
    });
    expect(mocks.notificationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ message }),
      update: expect.objectContaining({ message, isRead: false }),
    }));
    expect(mocks.writeAuditLog).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "SKEAP_WAITLIST_SLOT_OFFERED",
      actorId: "admin-1",
      targetId: "application-1",
      afterData: expect.objectContaining({ message }),
    }));
    expect(mocks.sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      applicationId: "application-1",
      email: "applicant@example.com",
      message,
      queuePosition: 1,
      deadline,
    }));
  });

  it("defaults the deadline to 5:00 PM PHT seven days ahead when omitted", async () => {
    const response = await POST(createRequest(null), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Offer endpoint did not return a response.");
    expect(response.status).toBe(200);
    const body = await response.json();
    const deadline = new Date(body.deadline);
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Manila",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(deadline);
    expect(parts.find((part) => part.type === "hour")?.value).toBe("17");
    expect(parts.find((part) => part.type === "minute")?.value).toBe("00");
    expect(deadline.getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a new offer when there is no open slot", async () => {
    mocks.capacitySnapshot.mockResolvedValue({ availableSlots: 0 });

    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Offer endpoint did not return a response.");
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "No open SKEAP slots are available to offer." });
    expect(mocks.updateApplication).not.toHaveBeenCalled();
    expect(mocks.notificationUpsert).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it("sends a fresh manual notice for an active offer without reserving another slot", async () => {
    const activeDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "WAITLISTED",
      submittedAt: new Date("2026-10-01T00:00:00.000Z"),
      applicantName: "Sample Applicant",
      emailAddress: "applicant@example.com",
      userId: "user-1",
      waitlistOfferStatus: "OFFERED",
      waitlistOfferedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      waitlistOfferExpiresAt: activeDeadline,
      waitlistPosition: 1,
      user: { fullName: "Sample Applicant", email: "applicant@example.com" },
    });
    mocks.findCurrentOfferNotifications.mockResolvedValue([{ message }]);
    mocks.capacitySnapshot.mockResolvedValue({ availableSlots: 0 });
    const renewedDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const response = await POST(createRequest(renewedDeadline.toISOString()), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Offer endpoint did not return a response.");
    expect(response.status).toBe(200);
    expect(mocks.capacitySnapshot).not.toHaveBeenCalled();
    expect(mocks.updateApplication).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: expect.objectContaining({
        waitlistOfferStatus: "OFFERED",
        waitlistOfferExpiresAt: renewedDeadline,
      }),
    });
    expect(mocks.notificationUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ message }),
    }));
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("renews an overdue manual offer without reserving a second slot", async () => {
    const expiredDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000);
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "WAITLISTED",
      submittedAt: new Date("2026-10-01T00:00:00.000Z"),
      applicantName: "Sample Applicant",
      emailAddress: "applicant@example.com",
      userId: "user-1",
      waitlistOfferStatus: "EXPIRED",
      waitlistOfferedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
      waitlistOfferExpiresAt: expiredDeadline,
      waitlistPosition: 1,
      user: { fullName: "Sample Applicant", email: "applicant@example.com" },
    });
    mocks.findCurrentOfferNotifications.mockResolvedValue([{ message }]);
    mocks.capacitySnapshot.mockResolvedValue({ availableSlots: 0 });
    const renewedDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const response = await POST(createRequest(renewedDeadline.toISOString()), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Offer endpoint did not return a response.");
    expect(response.status).toBe(200);
    expect(mocks.capacitySnapshot).not.toHaveBeenCalled();
    expect(mocks.updateApplication).toHaveBeenCalledWith({
      where: { id: "application-1" },
      data: expect.objectContaining({
        waitlistOfferStatus: "OFFERED",
        waitlistOfferExpiresAt: renewedDeadline,
      }),
    });
  });

  it("does not treat an unnotified legacy offer as an active manual offer", async () => {
    const activeDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mocks.findApplication.mockResolvedValue({
      id: "application-1",
      status: "WAITLISTED",
      submittedAt: new Date("2026-10-01T00:00:00.000Z"),
      applicantName: "Sample Applicant",
      emailAddress: "applicant@example.com",
      userId: "user-1",
      waitlistOfferStatus: "OFFERED",
      waitlistOfferedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      waitlistOfferExpiresAt: activeDeadline,
      waitlistPosition: 1,
      user: { fullName: "Sample Applicant", email: "applicant@example.com" },
    });
    mocks.findCurrentOfferNotifications.mockResolvedValue([]);
    mocks.findActiveOffers.mockResolvedValue([
      { id: "application-1", userId: "user-1", waitlistOfferExpiresAt: activeDeadline },
    ]);
    mocks.capacitySnapshot.mockResolvedValue({ availableSlots: 0 });

    const response = await POST(createRequest(), {
      params: Promise.resolve({ id: "application-1" }),
    });

    if (!response) throw new Error("Offer endpoint did not return a response.");
    expect(response.status).toBe(409);
    expect(mocks.updateApplication).not.toHaveBeenCalled();
    expect(mocks.notificationUpsert).not.toHaveBeenCalled();
  });

  it("rejects non-ISO or past deadlines", async () => {
    const invalid = await POST(createRequest("tomorrow"), {
      params: Promise.resolve({ id: "application-1" }),
    });
    if (!invalid) throw new Error("Offer endpoint did not return a response.");
    expect(invalid.status).toBe(400);

    const past = await POST(createRequest("2020-01-01T00:00:00.000Z"), {
      params: Promise.resolve({ id: "application-1" }),
    });
    if (!past) throw new Error("Offer endpoint did not return a response.");
    expect(past.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
