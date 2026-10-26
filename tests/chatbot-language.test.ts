import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLanguage } from "@/lib/chatbot/language";
import { generateAnswer } from "@/lib/chatbot/gemini";
import {
  SKEAP_APPLICATION_REQUIREMENT_CHUNKS,
  SKEAP_DOCUMENT_NAMES_SYSTEM_DIRECTIVE,
  formatSkeapRequirementsAnswer,
  isSkeapRequirementsListQuery,
} from "@/lib/chatbot/skeap-requirements";

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

describe("multilingual SKEAP requirements", () => {
  it.each([
    { question: "What are the SKEAP requirements?" },
    { question: "Ano ang mga requirements ng SKEAP?" },
    { question: "Ania dagiti kasapulan para iti SKEAP?" },
  ])("recognizes direct requirements questions: $question", ({ question }) => {
    expect(isSkeapRequirementsListQuery(question)).toBe(true);
  });

  it("does not treat where-to-get questions as requests for the requirements list", () => {
    expect(isSkeapRequirementsListQuery("Where can I get the SKEAP requirements?")).toBe(false);
    expect(isSkeapRequirementsListQuery("Saan kukunin ang requirements?")).toBe(false);
  });

  it.each(["ENGLISH", "FILIPINO", "ILOCANO"] as const)(
    "returns the exact English official document names for %s",
    (language) => {
      const answer = formatSkeapRequirementsAnswer(language);
      expect(answer).toContain("Application Form");
      expect(answer).toContain('1 piece 2"x2" latest I.D. picture');
      expect(answer).toContain("Original and Photocopy of Birth Certificate");
      expect(answer).toContain("Certificate of Low-income of Parents or Guardian");
      expect(answer).toContain("Certificate of Residency");
      expect(answer).toContain("Certificate of Enrollment");
      expect(answer).toContain("Grades issued by the school registrar");
      expect(answer).toContain("report card or form 138");
      expect(answer).not.toContain("Katibayan ng Kapanganakan");
      expect(answer).not.toContain("Katibayan ng Paninirahan");
    }
  );

  it("keeps the official SKEAP document names in English", () => {
    expect(SKEAP_DOCUMENT_NAMES_SYSTEM_DIRECTIVE).toBe(
      "CRITICAL RULE: When answering queries in Filipino or Ilocano, NEVER translate the names of official SKEAP requirements. Always use the exact English document names (e.g., 'Application Form', 'Birth Certificate', 'Certificate of Residency', 'Form 138'). Do not use localized terms like 'Katibayan ng Kapanganakan' or 'Katibayan ng Paninirahan'."
    );
    expect(SKEAP_APPLICATION_REQUIREMENT_CHUNKS.map((chunk) => chunk.metadata)).toEqual([
      { category: "skeap_application_requirements", language: "ENGLISH" },
      { category: "skeap_application_requirements", language: "FILIPINO" },
      { category: "skeap_application_requirements", language: "ILOCANO" },
    ]);
    for (const chunk of SKEAP_APPLICATION_REQUIREMENT_CHUNKS) {
      expect(chunk.content).toContain('2. 1 piece 2"x2" latest I.D. picture');
      expect(chunk.content).toContain("3. Original and Photocopy of Birth Certificate");
      expect(chunk.content).toContain("8. Certified true copy of his/her report card or form 138 for High School students");
    }
    expect(SKEAP_APPLICATION_REQUIREMENT_CHUNKS[0].content).toContain(
      "To apply for the SKEAP, all applicants shall be required to submit the following documents for verification, as well as for the records of the Barangay:"
    );
    expect(SKEAP_APPLICATION_REQUIREMENT_CHUNKS[1].content).toContain(
      "Para maka-apply sa SKEAP, ang lahat ng aplikante ay kinakailangang magsumite ng mga sumusunod na dokumento para sa beripikasyon at para sa rekord ng Barangay:"
    );
    expect(SKEAP_APPLICATION_REQUIREMENT_CHUNKS[2].content).toContain(
      "Tapno maka-apply iti SKEAP, amin nga aplikante ket masapul nga isubmitar dagiti sumaganad a dokumento para iti beripikasyon ken para iti rekord ti Barangay:"
    );
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
