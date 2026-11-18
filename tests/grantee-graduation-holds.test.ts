import { describe, expect, it, vi } from "vitest";
import {
  getGranteeGraduationHolds,
  type GraduationHoldClient,
} from "@/lib/grantee-graduation-holds";

function createClient(payout: { id: string } | null, complianceCount: number) {
  return {
    accountingPayout: {
      findFirst: vi.fn().mockResolvedValue(payout),
    },
    submission: {
      count: vi.fn().mockResolvedValue(complianceCount),
    },
  } as unknown as GraduationHoldClient;
}

describe("getGranteeGraduationHolds", () => {
  it("reports unconfirmed payouts and pending compliance submissions", async () => {
    const holds = await getGranteeGraduationHolds(
      createClient({ id: "payout-1" }, 2),
      "grantee-1",
    );

    expect(holds).toEqual({
      pendingPayoutHold: true,
      pendingComplianceCount: 2,
    });
  });

  it("reports a clear status when no blocking records exist", async () => {
    const holds = await getGranteeGraduationHolds(createClient(null, 0), "grantee-1");

    expect(holds).toEqual({
      pendingPayoutHold: false,
      pendingComplianceCount: 0,
    });
  });
});
