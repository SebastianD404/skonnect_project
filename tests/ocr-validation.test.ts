import { describe, expect, it } from "vitest";
import { validateRecognizedText } from "@/lib/ocrValidation";
import {
  isKKProfilingManualReview,
  KK_PROFILING_MANUAL_REVIEW_NOTE,
} from "@/lib/kk-profiling-review";

describe("browser OCR document validation", () => {
  it("recognizes a readable front ID and checks its name", () => {
    const result = validateRecognizedText(
      "front_id",
      "REPUBLIC OF THE PHILIPPINES IDENTITY CARD NAME MARIA SANTOS STUDENT",
      { firstName: "Maria", lastName: "Santos" },
    );

    expect(result.status).toBe("success");
    expect(result.isValid).toBe(true);
    expect(result.nameMatched).toBe(true);
  });

  it("uses the non-blaming message when OCR returns too little text", () => {
    const result = validateRecognizedText("front_id", "ID");

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("LOW_CONFIDENCE");
    expect(result.message).toBe(
      "We couldn't clearly read the text. Please ensure good lighting and try again.",
    );
  });

  it("flags a readable but mismatched document for correction", () => {
    const result = validateRecognizedText(
      "front_id",
      "CERTIFICATE OF RESIDENCY FOR BARANGAY PICO RESIDENT",
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
  });
});

describe("KK profiling manual review marker", () => {
  it("recognizes the explicit scanner-failure review note", () => {
    expect(isKKProfilingManualReview(KK_PROFILING_MANUAL_REVIEW_NOTE)).toBe(true);
    expect(isKKProfilingManualReview(null)).toBe(false);
  });
});
