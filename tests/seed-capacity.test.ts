import { describe, expect, it } from "vitest";
import { generateDemoRecords } from "../prisma/seed";

describe("SKEAP demo seed capacity", () => {
  it.each([0, 1, 55])("creates requested application counts and respects %i available slots", (availableSlots) => {
    const records = generateDemoRecords(availableSlots);
    const activeScholarCount = records.filter((record) => record.cohort === "ACTIVE_SCHOLAR").length;
    const waitlistedCount = records.filter((record) => record.cohort === "WAITLISTED").length;
    const pendingSkeapCount = records.filter((record) => record.cohort === "PENDING_APPLICATION").length;
    const pendingKkCount = records.filter((record) => record.cohort === "KK_PENDING_APPLICATION").length;

    expect(records).toHaveLength(920 + availableSlots);
    expect(activeScholarCount).toBe(availableSlots);
    expect(waitlistedCount).toBe(50);
    expect(pendingSkeapCount).toBe(30);
    expect(pendingKkCount).toBe(40);
  });

  it("avoids emails reserved for preserved synthetic users", () => {
    const reservedEmails = new Set(["demo-youth-0001@demo.skonnect.invalid"]);
    const records = generateDemoRecords(0, reservedEmails);

    expect(records.some(({ email }) => reservedEmails.has(email))).toBe(false);
    expect(records).toHaveLength(920);
  });
});
