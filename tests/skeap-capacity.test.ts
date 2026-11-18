import { describe, expect, it, vi } from "vitest";
import {
  ACTIVE_GRANTEE_WHERE,
  getSkeapCapacityCount,
  getSkeapCapacitySnapshot,
  getSkeapMaxSlots,
  setSkeapMaxSlots,
} from "@/lib/skeap-capacity";

describe("SKEAP scholarship capacity", () => {
  it("counts only active grantee records attached to active users", async () => {
    const count = vi.fn().mockResolvedValue(53);
    const client = {
      grantee: {
        count,
      },
    } as unknown as NonNullable<Parameters<typeof getSkeapCapacityCount>[0]>;

    await expect(getSkeapCapacityCount(client)).resolves.toBe(53);
    expect(count).toHaveBeenCalledWith({ where: ACTIVE_GRANTEE_WHERE });
    expect(ACTIVE_GRANTEE_WHERE).toEqual({
      status: "ACTIVE",
      user: { is: { isActive: true } },
    });
  });

  it("returns one normalized capacity snapshot", async () => {
    const client = {
      grantee: { count: vi.fn().mockResolvedValue(53) },
      systemSetting: { findUnique: vi.fn().mockResolvedValue({ value: 55 }) },
    } as unknown as Parameters<typeof getSkeapCapacitySnapshot>[0];

    await expect(getSkeapCapacitySnapshot(client)).resolves.toEqual({
      activeCount: 53,
      maxSlots: 55,
      availableSlots: 2,
      isFull: false,
    });
  });

  it("runs capacity queries sequentially on a transaction client", async () => {
    let activeQueries = 0;
    let maxConcurrentQueries = 0;
    const trackQuery = async <T>(result: T) => {
      activeQueries += 1;
      maxConcurrentQueries = Math.max(maxConcurrentQueries, activeQueries);
      await Promise.resolve();
      activeQueries -= 1;
      return result;
    };
    const client = {
      grantee: { count: vi.fn(() => trackQuery(53)) },
      systemSetting: { findUnique: vi.fn(() => trackQuery({ value: 55 })) },
    } as unknown as Parameters<typeof getSkeapCapacitySnapshot>[0];

    await getSkeapCapacitySnapshot(client);

    expect(maxConcurrentQueries).toBe(1);
  });

  it("caps configured capacity at 55 even when an older setting is higher", async () => {
    const client = {
      systemSetting: {
        findUnique: vi.fn().mockResolvedValue({ value: 62 }),
      },
    } as unknown as Parameters<typeof getSkeapMaxSlots>[0];

    await expect(getSkeapMaxSlots(client)).resolves.toBe(55);
  });

  it("rejects attempts to configure more than 55 slots", async () => {
    await expect(setSkeapMaxSlots(56)).rejects.toThrow("between 1 and 55");
  });
});
