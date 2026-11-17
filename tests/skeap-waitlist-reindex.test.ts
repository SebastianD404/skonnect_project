import { describe, expect, it, vi } from "vitest";
import { reindexSkeapWaitlist } from "@/lib/skeap-waitlist";

describe("SKEAP waitlist reindexing", () => {
  it("recalculates the cycle positions with one database statement", async () => {
    const executeRaw = vi.fn().mockResolvedValue(0);
    const transaction = { $executeRaw: executeRaw } as never;

    await reindexSkeapWaitlist(transaction, "2026-2027");

    expect(executeRaw).toHaveBeenCalledTimes(1);
    const [query] = executeRaw.mock.calls[0];
    expect(query.join("")).toContain('ROW_NUMBER() OVER (ORDER BY "submittedAt" ASC, "id" ASC)');
    expect(query.join("")).toContain('"status" = \'WAITLISTED\'');
  });
});
