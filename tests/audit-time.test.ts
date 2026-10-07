import { describe, expect, it } from "vitest";
import { formatPhilippineTime } from "@/lib/audit/time";

describe("formatPhilippineTime", () => {
  it("uses a 12-hour clock with AM/PM in Philippine time", () => {
    expect(formatPhilippineTime("2026-10-07T11:52:13.000Z")).toBe("2026-10-07 7:52:13 PM PHT");
    expect(formatPhilippineTime("2026-10-07T00:05:04.000Z")).toBe("2026-10-07 8:05:04 AM PHT");
  });
});
