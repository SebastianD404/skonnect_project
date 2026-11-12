import { describe, expect, it, vi } from "vitest";
import { getSkeapCapacityCount, getSkeapMaxSlots, setSkeapMaxSlots } from "@/lib/skeap-capacity";

describe("SKEAP scholarship capacity", () => {
  it("counts unique users across approved applications and active grantees", async () => {
    const client = {
      grantee: {
        findMany: vi.fn().mockResolvedValue([{ userId: "youth-1" }, { userId: "youth-2" }]),
      },
      skeapApplication: {
        findMany: vi.fn().mockResolvedValue([{ userId: "youth-2" }, { userId: "youth-3" }]),
      },
    } as unknown as NonNullable<Parameters<typeof getSkeapCapacityCount>[0]>;

    await expect(getSkeapCapacityCount(client)).resolves.toBe(3);
    expect(client.skeapApplication.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { user: { grantee: { is: null } } },
            { user: { grantee: { is: { status: { in: ["ACTIVE", "PROBATIONARY"] } } } } },
          ],
        }),
      })
    );
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
