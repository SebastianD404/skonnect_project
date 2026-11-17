import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  notificationFindMany: vi.fn(),
  count: vi.fn(),
  findUniqueSetting: vi.fn(),
  capacitySnapshot: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    skeapApplication: { findMany: mocks.findMany, count: mocks.count },
    notification: { findMany: mocks.notificationFindMany },
    systemSetting: { findUnique: mocks.findUniqueSetting },
  },
}));

vi.mock("@/lib/skeap-capacity", () => ({
  getSkeapCapacitySnapshot: mocks.capacitySnapshot,
}));

import { getSkeapWaitlistSnapshot } from "@/lib/skeap-waitlist";

describe("SKEAP waitlist positions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findMany.mockResolvedValue([
      {
        id: "first",
        waitlistPosition: 1,
        waitlistOfferStatus: "NONE",
        waitlistOfferedAt: null,
        waitlistOfferExpiresAt: null,
        physicalDocumentsConfirmed: true,
        submittedAt: new Date("2026-10-01T00:00:00.000Z"),
        applicantName: "First Applicant",
        emailAddress: "first@example.com",
        contactNumber: null,
        school: "Example University",
        educationLevel: "College",
        currentCourse: "Course A",
        yearLevel: "1st Year",
        user: { fullName: null, email: "first@example.com" },
      },
      {
        id: "second",
        waitlistPosition: null,
        waitlistOfferStatus: "NONE",
        waitlistOfferedAt: null,
        waitlistOfferExpiresAt: null,
        physicalDocumentsConfirmed: false,
        submittedAt: new Date("2026-10-02T00:00:00.000Z"),
        applicantName: "Second Applicant",
        emailAddress: "second@example.com",
        contactNumber: null,
        school: "Example University",
        educationLevel: "College",
        currentCourse: "Course B",
        yearLevel: "2nd Year",
        user: { fullName: null, email: "second@example.com" },
      },
    ]);
    mocks.findUniqueSetting.mockResolvedValue(null);
    mocks.notificationFindMany.mockResolvedValue([]);
    mocks.count.mockResolvedValue(0);
    mocks.capacitySnapshot.mockResolvedValue({
      activeCount: 52,
      maxSlots: 55,
      availableSlots: 3,
      isFull: false,
    });
  });

  it("assigns visible queue positions when stored positions are missing", async () => {
    const snapshot = await getSkeapWaitlistSnapshot();

    expect(snapshot.applications.map(({ waitlistPosition }) => waitlistPosition)).toEqual([1, 2]);
    expect(snapshot.offeredCount).toBe(0);
    expect(snapshot.openSlotCount).toBe(3);
  });

  it("includes the saved manual notice and counts active offers", async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const sourceKey = `skeap-waitlist-offer:offered:${expiresAt.toISOString()}`;
    mocks.findMany.mockResolvedValue([
      {
        id: "offered",
        userId: "user-1",
        waitlistPosition: 1,
        waitlistOfferStatus: "OFFERED",
        waitlistOfferedAt: new Date(),
        waitlistOfferExpiresAt: expiresAt,
        physicalDocumentsConfirmed: false,
        submittedAt: new Date("2026-10-01T00:00:00.000Z"),
        applicantName: "Offered Applicant",
        emailAddress: "offered@example.com",
        contactNumber: null,
        school: "Example University",
        educationLevel: "College",
        currentCourse: "Course A",
        yearLevel: "1st Year",
        user: { fullName: null, email: "offered@example.com" },
      },
    ]);
    mocks.count.mockResolvedValue(1);
    mocks.notificationFindMany.mockResolvedValue([
      { userId: "user-1", sourceKey, message: "Please bring your original documents." },
    ]);

    const snapshot = await getSkeapWaitlistSnapshot();

    expect(snapshot.applications[0]).toMatchObject({
      waitlistOfferStatus: "OFFERED",
      waitlistOfferExpiresAt: expiresAt.toISOString(),
      waitlistOfferMessage: "Please bring your original documents.",
    });
    expect(snapshot.offeredCount).toBe(1);
    expect(snapshot.openSlotCount).toBe(2);
    expect(mocks.notificationFindMany).toHaveBeenCalledWith({
      where: {
        OR: [{ userId: "user-1", sourceKey }],
      },
      select: { userId: true, sourceKey: true, message: true },
    });
  });

  it("re-queues legacy offers without a manual notice and frees their slot", async () => {
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    mocks.findMany.mockResolvedValue([
      {
        id: "legacy-offer",
        userId: "user-legacy",
        waitlistPosition: 1,
        waitlistOfferStatus: "OFFERED",
        waitlistOfferedAt: new Date(),
        waitlistOfferExpiresAt: expiresAt,
        physicalDocumentsConfirmed: false,
        submittedAt: new Date("2026-10-01T00:00:00.000Z"),
        applicantName: "Legacy Applicant",
        emailAddress: "legacy@example.com",
        contactNumber: null,
        school: "Example University",
        educationLevel: "College",
        currentCourse: "Course A",
        yearLevel: "1st Year",
        user: { fullName: null, email: "legacy@example.com" },
      },
    ]);

    const snapshot = await getSkeapWaitlistSnapshot();

    expect(snapshot.applications[0]).toMatchObject({
      waitlistOfferStatus: "NONE",
      waitlistOfferedAt: null,
      waitlistOfferExpiresAt: null,
      waitlistOfferMessage: null,
    });
    expect(snapshot.offeredCount).toBe(0);
    expect(snapshot.openSlotCount).toBe(3);
  });

  it("retains an expired manual offer and its reserved slot for official review", async () => {
    const expiresAt = new Date(Date.now() - 60 * 60 * 1000);
    const sourceKey = `skeap-waitlist-offer:expired:${expiresAt.toISOString()}`;
    mocks.findMany.mockResolvedValue([
      {
        id: "expired",
        userId: "user-expired",
        waitlistPosition: 1,
        waitlistOfferStatus: "EXPIRED",
        waitlistOfferedAt: new Date(expiresAt.getTime() - 7 * 24 * 60 * 60 * 1000),
        waitlistOfferExpiresAt: expiresAt,
        physicalDocumentsConfirmed: false,
        submittedAt: new Date("2026-10-01T00:00:00.000Z"),
        applicantName: "Expired Applicant",
        emailAddress: "expired@example.com",
        contactNumber: null,
        school: "Example University",
        educationLevel: "College",
        currentCourse: "Course A",
        yearLevel: "1st Year",
        user: { fullName: null, email: "expired@example.com" },
      },
    ]);
    mocks.notificationFindMany.mockResolvedValue([
      { userId: "user-expired", sourceKey, message: "Bring your CTC documents." },
    ]);

    const snapshot = await getSkeapWaitlistSnapshot();

    expect(snapshot.applications[0]).toMatchObject({
      waitlistOfferStatus: "OFFERED",
      waitlistOfferExpiresAt: expiresAt.toISOString(),
      waitlistOfferMessage: "Bring your CTC documents.",
    });
    expect(snapshot.offeredCount).toBe(1);
    expect(snapshot.openSlotCount).toBe(2);
  });
});
