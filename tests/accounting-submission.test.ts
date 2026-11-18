import { describe, expect, it } from "vitest";
import {
  getAccountingSubmissionState,
  isAccountingSubmissionSubmitted,
} from "@/lib/accounting-submission";

describe("accounting submission status", () => {
  it.each(["PENDING", "RESUBMITTED", "AWAITING_PHYSICAL_CTC", "FOR_PHYSICAL_CTC", "RETURNED", "RETURNED_FOR_EDIT"])(
    "%s counts as a submitted status",
    (status) => {
      expect(isAccountingSubmissionSubmitted(status)).toBe(true);
    },
  );

  it.each([
    ["APPROVED", "Approved"],
    ["FOR_PHYSICAL_CTC", "For Physical CTC"],
    ["AWAITING_PHYSICAL_CTC", "For Physical CTC"],
    ["PENDING", "Pending Review"],
    ["RESUBMITTED", "Pending Review"],
    ["RETURNED", "Returned"],
    ["RETURNED_FOR_EDIT", "Returned"],
  ])("maps %s to %s", (status, label) => {
    expect(getAccountingSubmissionState(status)).toBe(label);
  });

  it.each(["DRAFT", "WITHDRAWN", "REMOVED"])("%s is not an active submission", (status) => {
    expect(isAccountingSubmissionSubmitted(status)).toBe(false);
  });

  it("treats a missing status as not submitted", () => {
    expect(isAccountingSubmissionSubmitted(null)).toBe(false);
  });

  it("accepts already formatted states for the accounting page", () => {
    expect(getAccountingSubmissionState("Pending Review")).toBe("Pending Review");
    expect(getAccountingSubmissionState("For Physical CTC")).toBe("For Physical CTC");
    expect(getAccountingSubmissionState("Not submitted")).toBe("Not submitted");
  });
});
