import { describe, expect, it } from "vitest";
import { evaluateDocumentOcr } from "@/app/components/DocumentOCRValidationExample";

describe("document OCR strategies", () => {
  it("accepts files for fields that do not require OCR", () => {
    expect(evaluateDocumentOcr("none", "any content")).toEqual({ isValid: true, error: null });
  });

  it("checks residency keywords case-insensitively", () => {
    expect(evaluateDocumentOcr("residency", "Resident of PICO")).toEqual({ isValid: true, error: null });
    expect(evaluateDocumentOcr("residency", "La Trinidad resident")).toEqual({
      isValid: false,
      error: "This doesn't look like a valid certificate. Please check your file and try uploading again.",
    });
  });

  it("checks birth certificate keywords case-insensitively", () => {
    expect(evaluateDocumentOcr("birth-certificate", "Civil Registry")).toEqual({ isValid: true, error: null });
    expect(evaluateDocumentOcr("birth-certificate", "Certificate of Live Record")).toEqual({
      isValid: false,
      error: "This doesn't look like a valid certificate. Please check your file and try uploading again.",
    });
  });
});
