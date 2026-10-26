import { describe, expect, it } from "vitest";
import { hasExplicitBackIdSideEvidence, parseOcrWorkerOutput } from "../lib/ocrWorker";

describe("OCR worker output parsing", () => {
  it("only identifies clear back-side ID evidence", () => {
    expect(hasExplicitBackIdSideEvidence("Barcode QR Code Restrictions")).toBe(true);
    expect(hasExplicitBackIdSideEvidence("Certificate issued by the Office of the Registrar")).toBe(false);
    expect(hasExplicitBackIdSideEvidence("Emergency contact information")).toBe(false);
  });

  it("parses a successful validation payload", () => {
    const payload = JSON.stringify({
      success: true,
      isValid: true,
      matchedKeywords: ["Philippines", "Name"],
      text: "Philippines Name",
    });

    expect(parseOcrWorkerOutput(payload)).toEqual({
      success: true,
      isValid: true,
      matchedKeywords: ["Philippines", "Name"],
      text: "Philippines Name",
    });
  });

  it("falls back to a failed payload when the worker emits invalid JSON", () => {
    expect(parseOcrWorkerOutput("not-json")).toEqual({
      success: false,
      isValid: false,
      matchedKeywords: [],
      text: "",
      error: "OCR worker returned invalid JSON.",
    });
  });
});
