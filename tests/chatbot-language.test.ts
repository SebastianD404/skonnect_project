import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLanguage } from "@/lib/chatbot/language";
import { generateAnswer } from "@/lib/chatbot/gemini";

describe("detectLanguage", () => {
  it("detects the suggested Ilocano household question", () => {
    expect(detectLanguage("Manu ti mabalin a scholar ti maysa a balay?")).toBe("ILOCANO");
  });

  it("distinguishes Ilocano eligibility questions from Filipino", () => {
    expect(detectLanguage("Sinu dagiti pwedeng mag-apply?")).toBe("ILOCANO");
  });

  it("detects Filipino questions", () => {
    expect(detectLanguage("Sino ang pwedeng mag-apply?")).toBe("FILIPINO");
  });

  it("keeps English questions classified as English", () => {
    expect(detectLanguage("Can I submit my requirements at Pico Hall?")).toBe("ENGLISH");
  });
});

describe("SKEAP eligibility fallback", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not require current enrollment to apply", async () => {
    vi.stubEnv("GOOGLE_GEMINI_API_KEY", "");

    const answer = await generateAnswer({
      systemInstruction: "",
      context: "",
      history: [],
      question: "Can I apply if I am not currently enrolled?",
    });

    expect(answer).toContain("regardless of current enrollment status or timing");
    expect(answer).not.toContain("if they are enrolled");
  });
});
