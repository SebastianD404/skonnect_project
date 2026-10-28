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

  it("rejects a low-income certificate even if it mentions residency and eight months", () => {
    const result = validateRecognizedText(
      "certificate",
      "CERTIFICATE OF LOW-INCOME OF PARENTS OR GUARDIAN. Applicant is a resident of Barangay Pico for 8 months.",
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
  });

  it("requires residency-specific wording and the eight-month requirement", () => {
    const genericCertificate = validateRecognizedText(
      "certificate",
      "CERTIFICATE OF GOOD MORAL CHARACTER. Applicant completed the program 8 months ago.",
    );
    const residencyCertificate = validateRecognizedText(
      "certificate",
      "CERTIFICATE OF RESIDENCY. This certifies that Maria Santos is a resident of Barangay Pico and has lived here for 8 months.",
      { firstName: "Maria", lastName: "Santos" },
    );

    expect(genericCertificate.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
    expect(residencyCertificate.status).toBe("success");
    expect(residencyCertificate.isValid).toBe(true);
  });
});

describe("KK profiling manual review marker", () => {
  it("recognizes the explicit scanner-failure review note", () => {
    expect(isKKProfilingManualReview(KK_PROFILING_MANUAL_REVIEW_NOTE)).toBe(true);
    expect(isKKProfilingManualReview(null)).toBe(false);
  });
});
