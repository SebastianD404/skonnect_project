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

  it("uses short, side-specific feedback for compact ID uploads", () => {
    expect(getCompactIdErrorMessage("front-id", "UNRECOGNIZED_DOCUMENT")).toBe(
      "Please upload the front of a valid ID.",
    );
    expect(getCompactIdErrorMessage("back-id", "WRONG_DOCUMENT_SIDE")).toBe(
      "Please upload the back of your ID.",
    );
    expect(getCompactIdErrorMessage("front-id", "SCANNER_UNAVAILABLE")).toBe(
      "This ID could not be checked. It will be reviewed manually.",
    );
  });
});
