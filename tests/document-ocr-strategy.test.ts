import { describe, expect, it } from "vitest";
import { evaluateDocumentOcr } from "@/app/components/DocumentOCRValidationExample";

describe("document OCR strategies", () => {
  it("rejects photo OCR text above 4 words or 20 non-whitespace characters", () => {
    const fourWords = "one two three four";
    const fiveWords = "one two three four five";
    const twentyCharacters = "12345678901234567890";
    const twentyOneCharacters = "123456789012345678901";

    expect(evaluateDocumentOcr("photo", fourWords)).toEqual({ isValid: true, error: null });
    expect(evaluateDocumentOcr("photo", twentyCharacters)).toEqual({ isValid: true, error: null });
    expect(evaluateDocumentOcr("photo", fiveWords)).toEqual({
      isValid: false,
      error: "Please upload a clear 2x2 portrait photo of your face. Avoid uploading documents or certificates here.",
    });
    expect(evaluateDocumentOcr("photo", twentyOneCharacters)).toEqual({
      isValid: false,
      error: "Please upload a clear 2x2 portrait photo of your face. Avoid uploading documents or certificates here.",
    });
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
