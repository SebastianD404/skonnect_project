import { describe, expect, it } from "vitest";
import {
  getAccountingSubmissionState,
  isAccountingSubmissionSubmitted,
} from "@/lib/accounting-submission";

describe("accounting submission status", () => {
  it.each(["REJECTED", "RETURNED_FOR_EDIT"])("%s requires resubmission", (status) => {
    expect(isAccountingSubmissionSubmitted(status)).toBe(false);
  });

  it.each(["PENDING", "APPROVED", "WAITLISTED", "REMOVED"])("%s counts as submitted", (status) => {
    expect(isAccountingSubmissionSubmitted(status)).toBe(true);
  });

  it("treats a missing status as not submitted", () => {
    expect(isAccountingSubmissionSubmitted(null)).toBe(false);
  });

  it("uses a display state consistent with the submitted filter", () => {
    expect(getAccountingSubmissionState("REJECTED")).toBe("Not submitted");
    expect(getAccountingSubmissionState("APPROVED")).toBe("Approved");
    expect(getAccountingSubmissionState("PENDING")).toBe("Pending review");
  });
});
