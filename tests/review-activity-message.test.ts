import { describe, expect, it } from "vitest";
import { formatReviewActivityMessage } from "@/lib/review-activity-message";

describe("review activity message formatting", () => {
  it("replaces legacy uploaded file paths and removes duplicate consecutive lines", () => {
    expect(
      formatReviewActivityMessage(
        "Applicant submitted a SKEAP application.\nApplicant submitted a SKEAP application.\n\nUploaded files:\n/api/private-documents/skeap/file.pdf\nhttps://skonnect.example/api/private-documents/skeap/photo.jpg",
      ),
    ).toBe(
      "Applicant submitted a SKEAP application.\n\nSupporting documents attached.",
    );
  });

  it("deduplicates only consecutive identical lines", () => {
    expect(formatReviewActivityMessage("First line\nFirst line\nSecond line\nFirst line")).toBe(
      "First line\nSecond line\nFirst line",
    );
  });
});
