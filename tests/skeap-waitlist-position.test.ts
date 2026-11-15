import { describe, expect, it, vi } from "vitest";
import { getWaitlistQueuePosition } from "@/lib/skeap-applications";

function createClient(
  applications: Array<{ id: string; waitlistFinalPosition: number | null }>,
  closedTotal = 0,
) {
  const findMany = vi.fn().mockResolvedValue(applications);
  const findUnique = vi.fn().mockResolvedValue(closedTotal ? { value: closedTotal } : null);
  return {
    client: {
      skeapApplication: { findMany },
      systemSetting: { findUnique },
    } as never,
    findMany,
  };
}

describe("SKEAP waitlist queue position", () => {
  it("uses deterministic cycle ordering and shifts positions when an earlier applicant leaves", async () => {
    const firstSnapshot = createClient([
      { id: "earlier", waitlistFinalPosition: null },
      { id: "applicant", waitlistFinalPosition: null },
    ]);
    await expect(
      getWaitlistQueuePosition("applicant", "2026-2027", firstSnapshot.client),
    ).resolves.toEqual({ position: 2, totalWaitlisted: 2 });
    expect(firstSnapshot.findMany).toHaveBeenCalledWith({
      where: {
        status: "WAITLISTED",
        submittedAt: {
          gte: new Date(2026, 7, 1),
          lt: new Date(2027, 7, 1),
        },
      },
      orderBy: [{ submittedAt: "asc" }, { id: "asc" }],
      select: { id: true, waitlistFinalPosition: true },
    });

    const afterPromotion = createClient([
      { id: "applicant", waitlistFinalPosition: null },
    ]);
    await expect(
      getWaitlistQueuePosition("applicant", "2026-2027", afterPromotion.client),
    ).resolves.toEqual({ position: 1, totalWaitlisted: 1 });
  });

  it("preserves each applicant's frozen rank and the original queue size after closure", async () => {
    const { client } = createClient([
      { id: "applicant", waitlistFinalPosition: 3 },
    ], 4);

    await expect(
      getWaitlistQueuePosition("applicant", "2026-2027", client),
    ).resolves.toEqual({ position: 3, totalWaitlisted: 4 });
  });
});
