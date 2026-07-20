export interface OcrWorkerResult {
  success: boolean;
  isValid: boolean;
  matchedKeywords: string[];
  text: string;
  error?: string;
}

export function parseOcrWorkerOutput(rawOutput: string): OcrWorkerResult {
  try {
    const parsed = JSON.parse(rawOutput) as Partial<OcrWorkerResult>;

    return {
      success: parsed.success ?? false,
      isValid: parsed.isValid ?? false,
      matchedKeywords: Array.isArray(parsed.matchedKeywords) ? parsed.matchedKeywords : [],
      text: typeof parsed.text === "string" ? parsed.text : "",
      error: typeof parsed.error === "string" ? parsed.error : undefined,
    };
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
