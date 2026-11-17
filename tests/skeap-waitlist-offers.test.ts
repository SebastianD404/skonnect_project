import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  activeCount: vi.fn(),
  maxSlots: vi.fn(),
  sendEmail: vi.fn(),
  updateMany: vi.fn(),
  notificationUpsert: vi.fn(),
  applicationCount: vi.fn(),
  applicationFindMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("@/lib/broadcast-email", () => ({
  createGmailTransporter: vi.fn(() => ({})),
  sendTransactionalEmail: mocks.sendEmail,
}));

vi.mock("@/lib/semester", () => ({
  getAcademicYearDateRange: () => ({
    start: new Date("2026-08-01T00:00:00.000Z"),
    end: new Date("2027-08-01T00:00:00.000Z"),
  }),
}));

vi.mock("@/lib/skeap-capacity", () => ({
  getSkeapCapacityCount: mocks.activeCount,
  getSkeapMaxSlots: mocks.maxSlots,
  lockSkeapCapacity: vi.fn(),
}));

vi.mock("@/lib/skeap-waitlist", () => ({
  reindexSkeapWaitlist: vi.fn(),
}));

vi.mock("@/lib/skeap-waitlist-cycle", () => ({
  getSkeapWaitlistCycle: () => "2026-2027",
  getSkeapWaitlistCycleState: vi.fn(async () => ({ isClosed: false })),
}));

import {
  buildWaitlistOfferEmailTemplate,
  dispatchWaitlistSlotOffers,
  getDueWaitlistOfferReminderOffsets,
  formatWaitlistOfferDeadline,
  getWaitlistOfferExpiresAt,
} from "@/lib/skeap-waitlist-offers";

describe("SKEAP waitlist offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://skonnect.example");
    const tx = {
      systemSetting: { findUnique: vi.fn().mockResolvedValue({ value: 7 }) },
      skeapApplication: {
        count: mocks.applicationCount.mockResolvedValue(0),
        findMany: mocks.applicationFindMany.mockResolvedValue([
          {
            id: "first",
            userId: "user-1",
            applicantName: "First Applicant",
            emailAddress: "first@example.com",
            waitlistPosition: 1,
            user: { fullName: "First Applicant", email: "first@example.com" },
          },
          {
            id: "second",
            userId: "user-2",
            applicantName: "Second Applicant",
            emailAddress: "second@example.com",
            waitlistPosition: 2,
            user: { fullName: "Second Applicant", email: "second@example.com" },
          },
        ]),
        updateMany: mocks.updateMany.mockResolvedValue({ count: 1 }),
      },
      notification: { upsert: mocks.notificationUpsert.mockResolvedValue({}) },
    };
    mocks.transaction.mockImplementation(async (callback) => callback(tx));
    mocks.activeCount.mockResolvedValue(8);
    mocks.maxSlots.mockResolvedValue(10);
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it("offers only the available slots to eligible applicants in FIFO order", async () => {
    const now = new Date("2026-11-17T09:00:00.000Z");
    const result = await dispatchWaitlistSlotOffers(now);

    expect(result).toMatchObject({
      offeredCount: 2,
      availableSlots: 2,
      activeGranteesCount: 8,
      activeUnexpiredOffersCount: 0,
      waitlistOfferDays: 7,
      emailSent: 2,
    });
    expect(mocks.applicationFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
        take: 2,
      }),
    );
    expect(mocks.updateMany).toHaveBeenCalledTimes(2);
    expect(mocks.notificationUpsert).toHaveBeenCalledTimes(2);
    expect(mocks.sendEmail.mock.calls[0]?.[3]).toContain("On or before November 24, 2026 (7 days)");
    expect(mocks.sendEmail.mock.calls[0]?.[3]).toContain("8:00 AM – 5:00 PM (Monday – Friday)");
    expect(mocks.sendEmail.mock.calls[0]?.[5]).toContain("SCHOLARSHIP SLOT OFFER · QUEUE #1");
    expect(mocks.notificationUpsert.mock.calls[0]?.[0].create.message).toContain(
      "during office hours: 8:00 AM – 5:00 PM (Monday – Friday), within 7 days, on or before November 24, 2026",
    );
  });

  it("sets the deadline to 5:00 PM Manila time on the final calendar day", () => {
    const offeredAt = new Date("2026-11-17T09:00:00.000Z");
    const offeredInTheMorning = new Date("2026-11-17T02:00:00.000Z");

    expect(getWaitlistOfferExpiresAt(offeredAt, 7)).toEqual(
      new Date("2026-11-24T09:00:00.000Z"),
    );
    expect(getWaitlistOfferExpiresAt(offeredInTheMorning, 7)).toEqual(
      new Date("2026-11-24T09:00:00.000Z"),
    );
    expect(formatWaitlistOfferDeadline(getWaitlistOfferExpiresAt(offeredInTheMorning, 7)))
      .toBe("November 24, 2026");
  });

  it("builds a responsive offer email with a plain-text fallback and no generic status footer", () => {
    const template = buildWaitlistOfferEmailTemplate({
      applicantName: "Mara Santos",
      queuePosition: 4,
      waitlistOfferDays: 7,
      expiresAt: new Date("2026-11-24T09:00:00.000Z"),
      dashboardUrl: "https://skonnect.example/youth-dashboard",
    });

    expect(template.text).toContain("Hello Mara,");
    expect(template.text).toContain("Queue #4");
    expect(template.text).toContain("Barangay Ordinance No. 1 - 2022");
    expect(template.text).toContain("Registrar-Issued Grades");
    expect(template.text).toContain("https://skonnect.example/youth-dashboard");
    expect(template.html).toContain("max-width:600px");
    expect(template.html).toContain("SCHOLARSHIP SLOT OFFER · QUEUE #4");
    expect(template.html).toContain("View Application in SKonnect →");
    expect(template.html).toContain("This is an automated notice from SKonnect");
    expect(template.html).not.toContain("Your scholarship record has been updated");
    expect(template.html).not.toContain("11:59 AM");
  });

  it("sends reminders at 48 and 24 hours remaining, without reminders after expiry", () => {
    const expiresAt = new Date("2026-11-24T09:00:00.000Z");

    expect(
      getDueWaitlistOfferReminderOffsets(
        expiresAt,
        new Date("2026-11-22T08:00:00.000Z"),
      ),
    ).toEqual([]);
    expect(
      getDueWaitlistOfferReminderOffsets(
        expiresAt,
        new Date("2026-11-22T09:00:00.000Z"),
      ),
    ).toEqual([48]);
    expect(
      getDueWaitlistOfferReminderOffsets(
        expiresAt,
        new Date("2026-11-23T09:00:00.000Z"),
      ),
    ).toEqual([48, 24]);
    expect(
      getDueWaitlistOfferReminderOffsets(expiresAt, expiresAt),
    ).toEqual([]);
  });
});
