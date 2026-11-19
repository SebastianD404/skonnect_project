import { describe, expect, it } from "vitest";
import {
  evaluateDocumentOcr,
  getCompactIdErrorMessage,
} from "@/app/components/DocumentOCRValidationExample";

describe("document OCR strategies", () => {
  it("accepts files for fields that do not require OCR", () => {
    expect(evaluateDocumentOcr("none", "any content")).toEqual({ isValid: true, error: null });
  });

  it("requires the full residency OCR validator to approve the document", () => {
    expect(evaluateDocumentOcr("residency", "Resident of PICO", false)).toEqual({
      isValid: false,
      error: "This doesn't appear to be a Certificate of Residency issued by Barangay Pico. Please upload the correct document.",
    });
    expect(evaluateDocumentOcr("residency", "Certificate of Residency, Barangay Pico", true)).toEqual({
      isValid: true,
      error: null,
    });
  });

  it("checks birth certificate keywords case-insensitively", () => {
    expect(evaluateDocumentOcr("birth-certificate", "Civil Registry")).toEqual({ isValid: true, error: null });
    expect(evaluateDocumentOcr("birth-certificate", "Certificate of Live Record")).toEqual({
      isValid: false,
      error: "This doesn't look like a valid certificate. Please check your file and try uploading again.",
    });
  });

  it("uses the requested feedback for rejected compact ID uploads", () => {
    expect(getCompactIdErrorMessage("front-id", "UNRECOGNIZED_DOCUMENT")).toBe(
      "We couldn't confirm this is the correct side of a valid ID. Please upload a clear image of the correct ID side.",
    );
    expect(getCompactIdErrorMessage("back-id", "WRONG_DOCUMENT_SIDE")).toBe(
      "We couldn't confirm this is the correct side of a valid ID. Please upload a clear image of the correct ID side.",
    );
    expect(getCompactIdErrorMessage("front-id", "SCANNER_UNAVAILABLE")).toBe(
      "We couldn't check this ID automatically. Please try uploading a clear image again; it may still need manual verification.",
    );
    expect(getCompactIdErrorMessage("validIdFront", "LOW_CONFIDENCE")).toBe(
      "We couldn't clearly read this ID. Please re-upload a clear, well-lit image.",
    );
  });
});
