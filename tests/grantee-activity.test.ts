import { describe, expect, it } from "vitest";
import { buildGranteeActivity } from "@/lib/grantee-activity";

describe("buildGranteeActivity", () => {
  it("shows grantee receipt confirmation but not the admin's disbursement action", () => {
    const activities = buildGranteeActivity([], {
      id: "payout-1",
      semester: "2026-2027 First Semester",
      amount: 5000,
      claimedAt: new Date("2026-11-12T10:00:00.000Z"),
    });

    expect(activities).toEqual([{
      id: "payout-confirmed:payout-1",
      label: "2026-2027 First Semester payout · receipt confirmed",
      date: new Date("2026-11-12T10:00:00.000Z"),
      kind: "confirmed",
      detail: "₱5,000",
    }]);
  });

  it("does not include a payout that was disbursed by an admin but not confirmed by the grantee", () => {
    expect(buildGranteeActivity([], {
      id: "payout-1",
      semester: "2026-2027 First Semester",
      amount: 5000,
      claimedAt: null,
    })).toEqual([]);
  });

  it("sorts submission updates and receipt confirmations newest first", () => {
    const activities = buildGranteeActivity(
      [{
        id: "submission-1",
        semester: "First Semester",
        status: "APPROVED",
        submittedAt: new Date("2026-11-01T10:00:00.000Z"),
        reviewedAt: new Date("2026-11-10T10:00:00.000Z"),
      }],
      {
        id: "payout-1",
        semester: "First Semester",
        amount: 5000,
        claimedAt: new Date("2026-11-12T10:00:00.000Z"),
      },
    );

    expect(activities.map((activity) => activity.id)).toEqual([
      "payout-confirmed:payout-1",
      "submission:submission-1",
    ]);
    expect(activities[1].date).toEqual(new Date("2026-11-10T10:00:00.000Z"));
  });
});
