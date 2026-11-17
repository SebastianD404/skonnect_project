import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ prisma: {} }));

vi.mock("@/lib/broadcast-email", () => ({
  createGmailTransporter: vi.fn(() => ({})),
  sendTransactionalEmail: mocks.sendEmail,
}));

vi.mock("@/lib/semester", () => ({ getAcademicYearDateRange: vi.fn() }));
vi.mock("@/lib/skeap-capacity", () => ({ lockSkeapCapacity: vi.fn() }));

import {
  buildCustomWaitlistOfferEmailTemplate,
  formatWaitlistOfferDeadline,
  getDueWaitlistOfferReminderOffsets,
  getWaitlistOfferExpiresAt,
  sendWaitlistSlotOfferEmail,
} from "@/lib/skeap-waitlist-offers";

describe("SKEAP waitlist offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://skonnect.example");
    mocks.sendEmail.mockResolvedValue(undefined);
  });

  it("sets the default deadline to 5:00 PM Manila time on the final calendar day", () => {
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

  it("creates an escaped email from the final custom message", () => {
    const message = "Dear Applicant,\n\nPresent your original / CTC documents at Barangay Pico Hall.";
    const deadline = new Date("2026-11-24T09:00:00.000Z");
    const template = buildCustomWaitlistOfferEmailTemplate({
      message,
      dashboardUrl: "https://skonnect.example/youth-dashboard?x=1&y=2",
      queuePosition: 1,
      deadline,
    });

    expect(template.text).toContain(message);
    expect(template.text).toContain("Queue Position: #1");
    expect(template.text).toContain("Compliance Deadline: Nov 24, 2026, 5:00 PM PHT");
    expect(template.text).toContain("Location: Barangay Pico Hall, La Trinidad, Benguet");
    expect(template.text).toContain("Documents: Original / Certified True Copy (CTC) Requirements");
    expect(template.text).toContain("https://skonnect.example/youth-dashboard?x=1&y=2");
    expect(template.html).toContain("SKonnect <span style=\"color:#9fe4eb;\">·</span> Barangay Pico");
    expect(template.html).toContain("SKEAP SCHOLARSHIP NOTICE");
    expect(template.html).toContain("Scholarship Slot Available");
    expect(template.html).toContain("background:#f8fafc");
    expect(template.html).toContain("Verification Details");
    expect(template.html).toContain("Nov 24, 2026, 5:00 PM PHT");
    expect(template.html).toContain("font-size:14px;line-height:1.6");
    expect(template.html).toContain("View Application in SKonnect");
    expect(template.html.match(/Sangguniang Kabataan of Barangay Pico/g)).toHaveLength(1);
    expect(template.html).not.toContain("&nbsp;");
    expect(template.html).toContain("Present your original / CTC documents");
    expect(template.html).toContain("https://skonnect.example/youth-dashboard?x=1&amp;y=2");
    expect(template.html).not.toContain("automated notice");
  });

  it("keeps the default message sign-off in the footer only once", () => {
    const template = buildCustomWaitlistOfferEmailTemplate({
      message: "Dear Applicant,\n\nYour SKEAP slot is available.\n\nSangguniang Kabataan of Barangay Pico",
      dashboardUrl: "https://skonnect.example/youth-dashboard",
      queuePosition: 2,
      deadline: new Date("2026-11-24T09:00:00.000Z"),
    });

    expect(template.text.match(/Sangguniang Kabataan of Barangay Pico/g)).toHaveLength(1);
    expect(template.html.match(/Sangguniang Kabataan of Barangay Pico/g)).toHaveLength(1);
  });

  it("sends the final edited message with an offer-specific idempotency key", async () => {
    const sentAt = new Date("2026-11-17T09:00:00.000Z");
    const deadline = new Date("2026-11-24T09:00:00.000Z");
    const message = "Custom SKEAP offer message";

    await sendWaitlistSlotOfferEmail({
      applicationId: "application-1",
      email: "applicant@example.com",
      message,
      sentAt,
      queuePosition: 3,
      deadline,
    });

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      {},
      "applicant@example.com",
      "A SKEAP scholarship slot is available",
      expect.stringContaining(message),
      `waitlist-offer-application-1-${sentAt.toISOString()}`,
      expect.stringContaining(message),
    );
  });

  it("sends reminders at 48 and 24 hours remaining, without reminders after expiry", () => {
    const expiresAt = new Date("2026-11-24T09:00:00.000Z");

    expect(
      getDueWaitlistOfferReminderOffsets(expiresAt, new Date("2026-11-22T08:00:00.000Z")),
    ).toEqual([]);
    expect(
      getDueWaitlistOfferReminderOffsets(expiresAt, new Date("2026-11-22T09:00:00.000Z")),
    ).toEqual([48]);
    expect(
      getDueWaitlistOfferReminderOffsets(expiresAt, new Date("2026-11-23T09:00:00.000Z")),
    ).toEqual([48, 24]);
    expect(getDueWaitlistOfferReminderOffsets(expiresAt, expiresAt)).toEqual([]);
  });
});
