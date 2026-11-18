import { describe, expect, it } from "vitest";
import { isGranteeDueForGraduation } from "../lib/grantee-due-for-graduation";

const baseGrantee = {
  status: "ACTIVE",
  journeyStart: "college-1",
  journeyEnd: "college-4",
  currentStepSemester: "2025-2026 First Semester",
  finalJourneySemester: "2025-2026 Second Semester",
};

describe("isGranteeDueForGraduation", () => {
  it("returns true when the active journey step is the final roadmap semester", () => {
    expect(isGranteeDueForGraduation({
      ...baseGrantee,
      currentStepSemester: baseGrantee.finalJourneySemester,
    }, new Date("2025-08-15T00:00:00.000Z"))).toBe(true);
  });

  it("returns true for an active scholar after the final roadmap semester has passed", () => {
    expect(isGranteeDueForGraduation(baseGrantee, new Date("2027-02-15T00:00:00.000Z"))).toBe(true);
  });

  it("returns true when the current academic term reaches the final roadmap semester", () => {
    expect(isGranteeDueForGraduation(baseGrantee, new Date("2026-02-15T00:00:00.000Z"))).toBe(true);
  });

  it("does not mark a scholar due before the final term or after graduation", () => {
    expect(isGranteeDueForGraduation(baseGrantee, new Date("2025-08-15T00:00:00.000Z"))).toBe(false);
    expect(isGranteeDueForGraduation({
      ...baseGrantee,
      status: "GRADUATED",
    }, new Date("2027-02-15T00:00:00.000Z"))).toBe(false);
  });

  it("does not treat a past final term as due while the scholar is probationary", () => {
    expect(isGranteeDueForGraduation({
      ...baseGrantee,
      status: "PROBATIONARY",
    }, new Date("2027-02-15T00:00:00.000Z"))).toBe(false);
  });
});
