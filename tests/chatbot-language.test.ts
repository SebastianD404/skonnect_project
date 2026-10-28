import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLanguage } from "@/lib/chatbot/language";
import { generateAnswer } from "@/lib/chatbot/gemini";
import {
  SKEAP_APPLICATION_REQUIREMENT_CHUNKS,
  SKEAP_DOCUMENT_NAMES_SYSTEM_DIRECTIVE,
  formatSkeapRequirementsAnswer,
  isSkeapRequirementsListQuery,
} from "@/lib/chatbot/skeap-requirements";
import {
  formatSubmissionScheduleAnswer,
  getSubmissionScheduleIntent,
  isSchedulePolicyQuestion,
  type LiveSubmissionSchedules,
} from "@/lib/chatbot/submission-schedule";
import { formatFacilityHoursAnswer, isFacilityHoursQuestion } from "@/lib/chatbot/facility-info";
import { formatSkeapGrantAmountAnswer, isSkeapGrantAmountQuestion } from "@/lib/chatbot/grant-info";
import { formatDualScholarshipAnswer, isDualScholarshipQuestion } from "@/lib/chatbot/eligibility-info";
import { formatPayoutProxyAnswer, isPayoutProxyQuestion } from "@/lib/chatbot/payout-claiming";

const liveSubmissionSchedules: LiveSubmissionSchedules = {
  skeap: { isOpen: true, startDate: null, endDate: null },
  kkProfiling: { isOpen: true, startDate: null, endDate: null },
  academicTerm: {
    status: "UPCOMING",
    semester: "First Semester",
    opensAt: "2026-11-01T00:00:00.000Z",
    closesAt: "2026-11-15T00:00:00.000Z",
  },
};

describe("detectLanguage", () => {
  it("detects the suggested Ilocano household question", () => {
    expect(detectLanguage("Manu ti mabalin a scholar ti maysa a balay?")).toBe("ILOCANO");
  });

  it("distinguishes Ilocano eligibility questions from Filipino", () => {
    expect(detectLanguage("Sinu dagiti pwedeng mag-apply?")).toBe("ILOCANO");
  });

  it("recognizes Ilocano scholarship overlap wording", () => {
    expect(detectLanguage("Mabalin kadi nga agapply iti SKEAP no adda dadduma a scholarship?")).toBe("ILOCANO");
  });

  it("detects the Ilocano proxy payout question language", () => {
    expect(detectLanguage("Mabalin ba nga han nga siyak ti mapan agala ti payout ko")).toBe("ILOCANO");
  });

  it("detects Filipino questions", () => {
    expect(detectLanguage("Sino ang pwedeng mag-apply?")).toBe("FILIPINO");
  });

  it("detects the example Ilocano submission question", () => {
    expect(detectLanguage("Nganu nga aglukat ti submission para iti SKEAP?")).toBe("ILOCANO");
  });

  it("detects the example Filipino submission question", () => {
    expect(detectLanguage("Kailan magbubukas ang submission?")).toBe("FILIPINO");
  });

  it("keeps English questions classified as English", () => {
    expect(detectLanguage("Can I submit my requirements at Pico Hall?")).toBe("ENGLISH");
  });
});

describe("submission schedule intent", () => {
  it("routes temporal questions about requirements to SKEAP schedule handling", () => {
    expect(getSubmissionScheduleIntent("When will the submission for requirements open?")).toBe("ACADEMIC");
  });

  it("recognizes Filipino and Ilocano submission timing questions", () => {
    expect(getSubmissionScheduleIntent("Kailan magbubukas ang submission?")).toBe("SKEAP");
    expect(getSubmissionScheduleIntent("Nganu nga aglukat ti submission para iti SKEAP?")).toBe("SKEAP");
    expect(getSubmissionScheduleIntent("Hanggang kailan bukas ang submission ng requirements?")).toBe("ACADEMIC");
    expect(getSubmissionScheduleIntent("Ania ti petsa ti panagipasa kadagiti dokumento?")).toBe("ACADEMIC");
  });

  it("routes semester-grade timing questions to the academic schedule", () => {
    expect(getSubmissionScheduleIntent("When is the deadline to submit grades?")).toBe("ACADEMIC");
  });

  it.each([
    "What happens if I miss the SKEAP deadline?",
    "Ano ang mangyayari kapag inabutan ako ng deadline ng requirements?",
    "Ano ang mangyayari kung hindi nakapasa sa deadline ng requirements?",
  ])("keeps deadline consequence questions on the policy/RAG path: %s", (question) => {
    expect(isSchedulePolicyQuestion(question)).toBe(true);
    expect(getSubmissionScheduleIntent(question)).toBe(null);
  });

  it("does not classify a strict deadline question as a policy question", () => {
    expect(isSchedulePolicyQuestion("Kailan ang deadline ng requirements?")).toBe(false);
    expect(getSubmissionScheduleIntent("Kailan ang deadline ng requirements?")).toBe("ACADEMIC");
  });

  it("answers SKEAP timing questions without listing static requirements", () => {
    expect(formatSubmissionScheduleAnswer("SKEAP", "ENGLISH", liveSubmissionSchedules)).toBe(
      "SKEAP submissions are currently being accepted. No separate opening or closing dates have been set."
    );
    expect(formatSubmissionScheduleAnswer("SKEAP", "FILIPINO", liveSubmissionSchedules)).toBe(
      "Tumatanggap na ngayon ng mga submission para sa SKEAP. Wala pang itinakdang hiwalay na petsa ng pagbubukas o pagsasara."
    );
    expect(formatSubmissionScheduleAnswer("SKEAP", "ILOCANO", liveSubmissionSchedules)).toBe(
      "Agtarima ita ti SKEAP kadagiti ipasa. Awan pay ti naisangsangayan a petsa ti panaglukat wenno panagserra."
    );
  });

  it("answers with the live academic submission window dates", () => {
    const answer = formatSubmissionScheduleAnswer("ACADEMIC", "ENGLISH", liveSubmissionSchedules);
    expect(answer).toContain("First Semester");
    expect(answer).toContain("opens on");
    expect(answer).toContain("closes on");
  });

  it("uses the active term and deadline in the Tagalog answer", () => {
    const schedules: LiveSubmissionSchedules = {
      ...liveSubmissionSchedules,
      academicTerm: {
        ...liveSubmissionSchedules.academicTerm,
        status: "OPEN",
      },
    };
    const answer = formatSubmissionScheduleAnswer("ACADEMIC", "FILIPINO", schedules);
    expect(answer).toContain("Bukas na ang submission para sa First Semester");
    expect(answer).toContain("magsasara sa");
    expect(answer).not.toContain("Wala pang itinakdang hiwalay na petsa");
  });
});

describe("Barangay Hall operating hours", () => {
  it.each([
    "What time does Barangay Hall open?",
    "Ano ang oras ng Barangay Hall?",
    "Ania nga oras ti Barangay Hall aglukat?",
  ])("recognizes facility hours questions: %s", (question) => {
    expect(isFacilityHoursQuestion(question)).toBe(true);
  });

  it("does not mistake submission opening questions for facility hour queries", () => {
    expect(isFacilityHoursQuestion("When does SKEAP submission open?")).toBe(false);
  });

  it("returns the exact facility schedule in English, Filipino, and Ilocano", () => {
    expect(formatFacilityHoursAnswer("ENGLISH")).toBe(
      "The Barangay Hall is open from Monday to Friday, 8:00 AM to 5:00 PM, except on holidays."
    );
    expect(formatFacilityHoursAnswer("FILIPINO")).toBe(
      "Bukas ang Barangay Hall mula Lunes hanggang Biyernes, 8:00 AM hanggang 5:00 PM, maliban tuwing holidays."
    );
    expect(formatFacilityHoursAnswer("ILOCANO")).toBe(
      "Sii-lukat ti Barangay Hall manipud Lunes aginggana Biyernes, 8:00 AM aginggana 5:00 PM, malaksid kadagiti holidays."
    );
  });
});

describe("SKEAP grant amount", () => {
  it.each([
    "How much money does a SKEAP grantee receive?",
    "Magkano ang allowance ng SKEAP grantee?",
    "Manu ti maalak nga kwarta?",
    "Manu ti maalak nga kwarta ti SKEAP grantee?",
  ])("recognizes multilingual grant amount questions: %s", (question) => {
    expect(isSkeapGrantAmountQuestion(question)).toBe(true);
  });

  it("does not mistake unrelated financial questions for the SKEAP grant amount", () => {
    expect(isSkeapGrantAmountQuestion("How much is the bus fare?")).toBe(false);
  });

  it("returns the exact grant amount response in English, Filipino, and Ilocano", () => {
    expect(formatSkeapGrantAmountAnswer("ENGLISH")).toBe(
      "SKEAP grantees will receive a financial grant of ₱5,000."
    );
    expect(formatSkeapGrantAmountAnswer("FILIPINO")).toBe(
      "Makakatanggap ng ₱5,000 na grant ang mga aprubadong SKEAP grantees."
    );
    expect(formatSkeapGrantAmountAnswer("ILOCANO")).toBe(
      "Makaawat ti ₱5,000 a grant dagiti aprubado a SKEAP grantees."
    );
  });
});

describe("dual scholarship eligibility", () => {
  it.each([
    "Can I apply to SKEAP if I already have a different scholarship?",
    "Can I apply for SKEAP while receiving another scholarship?",
    "Pwede ba akong mag-apply sa SKEAP kung may iba na akong scholarship?",
    "Mabalin kadi nga agapply iti SKEAP no adda dadduma a scholarship?",
  ])("recognizes overlapping scholarship questions: %s", (question) => {
    expect(isDualScholarshipQuestion(question)).toBe(true);
  });

  it("does not mistake a general scholarship eligibility question for an overlap question", () => {
    expect(isDualScholarshipQuestion("Who can apply for SKEAP?")).toBe(false);
  });

  it("returns the specified eligibility policy in English, Filipino, and Ilocano", () => {
    expect(formatDualScholarshipAnswer("ENGLISH")).toBe(
      "Applying for SKEAP while already receiving another scholarship is generally not allowed."
    );
    expect(formatDualScholarshipAnswer("FILIPINO")).toBe(
      "Ang pag-apply sa SKEAP habang mayroon ka nang ibang scholarship ay karaniwang hindi pinapayagan."
    );
    expect(formatDualScholarshipAnswer("ILOCANO")).toBe(
      "Ti panag-apply iti SKEAP bayat nga adda pay sabali a scholarship-mo ket sapasap a saan a maipalubos."
    );
  });
});

describe("payout proxy claiming", () => {
  it.each([
    "Can someone else claim my payout?",
    "Can another person claim my scholarship payout on my behalf?",
    "Maaari bang ibang tao ang kumuha ng payout ko?",
    "Mabalin ba nga han nga siyak ti mapan agala ti payout ko?",
    "Maited kadi iti sabali ti payout ko?",
  ])("recognizes proxy payout questions: %s", (question) => {
    expect(isPayoutProxyQuestion(question)).toBe(true);
  });

  it("does not mistake an ordinary payout question for a proxy claim", () => {
    expect(isPayoutProxyQuestion("When can I claim my payout?")).toBe(false);
  });

  it("returns the specified payout requirements in English, Filipino, and Ilocano", () => {
    expect(formatPayoutProxyAnswer("ENGLISH")).toBe(
      "Yes, someone else can claim your payout on your behalf by presenting a formal Authorization Letter, a copy of your valid ID, and the authorized person's valid ID."
    );
    expect(formatPayoutProxyAnswer("FILIPINO")).toBe(
      "Oo, maaaring kunin ng ibang tao ang iyong payout sa pamamagitan ng pagdala ng pormal na Authorization Letter, kopya ng iyong valid ID, at valid ID ng taong kukuha."
    );
    expect(formatPayoutProxyAnswer("ILOCANO")).toBe(
      "Wen, mabalin nga agawat ti sabali para kenka babaen ti pannakaited ti pormal a surat ti autorisasion, kopia ti valid ID-mo, ken ti valid ID ti agala."
    );
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
