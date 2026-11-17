import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  count: vi.fn(),
  findUniqueSetting: vi.fn(),
  capacityCount: vi.fn(),
  maxSlots: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    skeapApplication: { findMany: mocks.findMany, count: mocks.count },
    systemSetting: { findUnique: mocks.findUniqueSetting },
  },
}));

vi.mock("@/lib/skeap-capacity", () => ({
  getSkeapCapacityCount: mocks.capacityCount,
  getSkeapMaxSlots: mocks.maxSlots,
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
    mocks.count.mockResolvedValue(0);
    mocks.capacityCount.mockResolvedValue(52);
    mocks.maxSlots.mockResolvedValue(55);
  });

  it("assigns visible queue positions when stored positions are missing", async () => {
    const snapshot = await getSkeapWaitlistSnapshot();

    expect(snapshot.applications.map(({ waitlistPosition }) => waitlistPosition)).toEqual([1, 2]);
    expect(snapshot.offeredCount).toBe(0);
    expect(snapshot.openUnclaimedCount).toBe(2);
  });
});
