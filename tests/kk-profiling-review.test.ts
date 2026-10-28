import { describe, expect, it } from "vitest";
import { getKKProfilingReviewStatus } from "@/lib/kk-profiling-review";

describe("getKKProfilingReviewStatus", () => {
  it("uses the registration review status when available", () => {
    expect(getKKProfilingReviewStatus("Pending", true)).toBe("Pending");
    expect(getKKProfilingReviewStatus("Approved", false)).toBe("Approved");
  });

  it("falls back to the verified profile status when there is no registration", () => {
    expect(getKKProfilingReviewStatus(null, true)).toBe("Approved");
    expect(getKKProfilingReviewStatus(undefined, false)).toBe("Pending verification");
  });
});
