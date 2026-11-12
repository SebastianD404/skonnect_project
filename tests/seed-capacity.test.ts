import { describe, expect, it } from "vitest";
import { generateDemoRecords } from "../prisma/seed";

describe("SKEAP demo seed capacity", () => {
  it.each([0, 1, 55])("keeps 1,000 records and respects %i available slots", (availableSlots) => {
    const records = generateDemoRecords(availableSlots);
    const activeScholarCount = records.filter((record) => record.cohort === "ACTIVE_SCHOLAR").length;
    const waitlistedCount = records.filter((record) => record.cohort === "WAITLISTED").length;

    expect(records).toHaveLength(1000);
    expect(activeScholarCount).toBe(availableSlots);
    expect(activeScholarCount + waitlistedCount).toBe(100);
  });
});
