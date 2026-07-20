import { describe, expect, it } from "vitest";
import { parseOcrWorkerOutput } from "../lib/ocrWorker";

describe("OCR worker output parsing", () => {
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
