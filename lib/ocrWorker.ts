export interface OcrWorkerResult {
  success: boolean;
  isValid: boolean;
  matchedKeywords: string[];
  text: string;
  documentSide?: "front" | "back" | "unknown";
  error?: string;
}

export function hasExplicitBackIdSideEvidence(text: string) {
  return /\b(barcode|qr\s*(?:code)?|magnetic\s+stripe|stripe\s+code|restrictions?|endorsements?|organ\s+don(?:or|ation))\b/i.test(text);
}

export function parseOcrWorkerOutput(rawOutput: string): OcrWorkerResult {
  try {
    const parsed = JSON.parse(rawOutput) as Partial<OcrWorkerResult>;

    const result: OcrWorkerResult = {
      success: parsed.success ?? false,
      isValid: parsed.isValid ?? false,
      matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [],
      text: typeof parsed.text === "string" ? parsed.text : "",
    };

    if (parsed.documentSide === "front" || parsed.documentSide === "back" || parsed.documentSide === "unknown") {
      result.documentSide = parsed.documentSide;
    }
    if (typeof parsed.error === "string") {
      result.error = parsed.error;
    }

    return result;
  } catch {
    return {
      success: false,
      isValid: false,
      matchedKeywords: [],
      text: "",
      error: "OCR worker returned invalid JSON.",
    };
  }
}
