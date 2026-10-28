import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLanguage } from "@/lib/chatbot/language";
import { generateAnswer } from "@/lib/chatbot/gemini";
import {
  SKEAP_APPLICATION_REQUIREMENT_CHUNKS,
  SKEAP_DOCUMENT_NAMES_SYSTEM_DIRECTIVE,
  formatIncompleteRequirementsAnswer,
  formatSkeapRequirementsAnswer,
  isIncompleteRequirementsQuestion,
  isSkeapRequirementsListQuery,
} from "@/lib/chatbot/skeap-requirements";
import {
  formatSubmissionScheduleAnswer,
  getSubmissionScheduleIntent,
  isSchedulePolicyQuestion,
  type LiveSubmissionSchedules,
} from "@/lib/chatbot/submission-schedule";
import {
  formatFacilityHoursAnswer,
  formatPhysicalSubmissionLocationAnswer,
  isFacilityHoursQuestion,
  isPhysicalSubmissionLocationQuestion,
} from "@/lib/chatbot/facility-info";
import { formatSkeapGrantAmountAnswer, isSkeapGrantAmountQuestion } from "@/lib/chatbot/grant-info";
import {
  formatDualScholarshipAnswer,
  formatKkProfilingInfoAnswer,
  formatSkeapSlotLimitAnswer,
  formatSkeapSlotsFullAnswer,
  isDualScholarshipQuestion,
  isKkProfilingInfoQuestion,
  isSkeapSlotLimitQuestion,
  isSkeapSlotsFullQuestion,
} from "@/lib/chatbot/eligibility-info";
import {
  formatPayoutModeAnswer,
  formatMissingPayoutAnswer,
  formatPayoutProxyAnswer,
  isMissingPayoutQuestion,
  isPayoutModeQuestion,
  isPayoutProxyQuestion,
} from "@/lib/chatbot/payout-claiming";
import { formatDataPrivacyAnswer, isDataPrivacyQuestion } from "@/lib/chatbot/privacy-info";

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

  it("detects Filipino full-slot questions", () => {
    expect(detectLanguage("anong mangyayari kapag puno na ang slot at nagapply ako")).toBe("FILIPINO");
  });

  it("detects Filipino physical submission questions", () => {
    expect(detectLanguage("pwede ba magpasa ng requirements sa barangay hall")).toBe("FILIPINO");
  });

  it("detects Filipino standard payout claiming questions", () => {
    expect(detectLanguage("pano ko kukunin ang payout? saan?")).toBe("FILIPINO");
  });

  it("detects Ilocano standard payout claiming questions", () => {
    expect(detectLanguage("kasano ti agala ti payout? sadinno?")).toBe("ILOCANO");
  });

  it("detects Tagalog data privacy questions", () => {
    expect(detectLanguage("ligtas ba ang data ko sa SKonnect?")).toBe("FILIPINO");
  });

  it("detects Ilocano data privacy questions", () => {
    expect(detectLanguage("na-protektaran kadi ti impormasyonko?")).toBe("ILOCANO");
  });

  it("detects the Ilocano data privacy wording used in chat", () => {
    expect(detectLanguage("safe ngata dagitoy impormasyon ko ditoy")).toBe("ILOCANO");
  });

  it("detects Filipino incomplete requirements questions", () => {
    expect(detectLanguage("kulang ang requirements ko")).toBe("FILIPINO");
  });

  it("detects Ilocano incomplete requirements questions", () => {
    expect(detectLanguage("kurang ti requirements")).toBe("ILOCANO");
  });

  it("detects Ilocano requirements mistake questions", () => {
    expect(detectLanguage("kasano nu ada gayam ti kamali nga naipasak nga requirements")).toBe("ILOCANO");
  });

  it("detects Filipino KK Profiling questions", () => {
    expect(detectLanguage("ano ang KK profiling?")).toBe("FILIPINO");
  });

  it("detects Ilocano KK Profiling questions", () => {
    expect(detectLanguage("an-ania ti KK profiling?")).toBe("ILOCANO");
  });

  it("detects Ilocano SKEAP slot-limit questions", () => {
    expect(detectLanguage("ada ba ti limit nu manu ti skolar nga maala ti skeap")).toBe("ILOCANO");
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

describe("data privacy and system security", () => {
  it.each([
    "Is my personal information safe in SKonnect?",
    "Is my data secure?",
    "Are my application details private?",
    "Ligtas ba ang data ko?",
    "Ligtas ba ang personal na impormasyon ko sa SKonnect?",
    "Na-protektaran kadi ti impormasyonko?",
    "safe ngata dagitoy impormasyon ko ditoy",
  ])("recognizes data privacy questions: %s", (question) => {
    expect(isDataPrivacyQuestion(question)).toBe(true);
  });

  it.each([
    "Is SKonnect safe to use?",
    "What personal information do I need to submit?",
    "Is the application deadline private?",
  ])("does not mistake unrelated questions for data privacy questions: %s", (question) => {
    expect(isDataPrivacyQuestion(question)).toBe(false);
  });

  it("returns the specified privacy assurance in English, Filipino, and Ilocano", () => {
    expect(formatDataPrivacyAnswer("ENGLISH")).toBe(
      "Yes, your personal information is safe in SKonnect. All data collected is strictly protected in compliance with the Data Privacy Act of 2012 (RA 10173) and is accessible only to authorized Barangay Pico SK officials for official program processing."
    );
    expect(formatDataPrivacyAnswer("FILIPINO")).toBe(
      "Oo, ligtas ang iyong personal na impormasyon sa SKonnect. Ang lahat ng datos ay mahigpit na pinoprotektahan alinsunod sa Data Privacy Act of 2012 (RA 10173) at eksklusibong maa-access lamang ng mga awtorisadong opisyal ng SK ng Barangay Pico para sa opisyal na pagproseso."
    );
    expect(formatDataPrivacyAnswer("ILOCANO")).toBe(
      "Wen, natalged ti personal nga impormasyon mo ditoy SKonnect. Dagiti amin a datos ket sibubukel a naprotektaran babaen ti Data Privacy Act of 2012 (RA 10173) ken naitured laeng kadagiti autorisado nga opisyal ti SK ti Barangay Pico para iti opisial a pagproseso."
    );
  });
});

describe("physical requirements submission location", () => {
  it.each([
    "Can I pass my requirements at the Barangay Hall?",
    "Can I submit my documents in person at Barangay Pico Hall?",
    "Can I pass my requirements in the Barangay Hall?",
    "Pwede ba magpasa ng requirements sa Barangay Hall?",
    "Pwede ba magpasa sa Barangay Hall?",
    "Mabalin kadi isumiter dagiti requirements idjay Barangay Hall?",
    "Mabalin kadi isumiter idjay Barangay Hall?",
  ])("recognizes in-person submission location questions: %s", (question) => {
    expect(isPhysicalSubmissionLocationQuestion(question)).toBe(true);
  });

  it.each([
    "What are the SKEAP requirements?",
    "Can I submit my requirements online?",
    "What time does the Barangay Hall open?",
  ])("does not mistake other questions for physical submission location: %s", (question) => {
    expect(isPhysicalSubmissionLocationQuestion(question)).toBe(false);
  });

  it("returns the exact physical submission instructions in English, Filipino, and Ilocano", () => {
    expect(formatPhysicalSubmissionLocationAnswer("ENGLISH")).toBe(
      "Yes, you can submit your physical requirements in person at the Barangay Pico Hall during regular operating hours (Monday to Friday, 8:00 AM to 5:00 PM, except holidays)."
    );
    expect(formatPhysicalSubmissionLocationAnswer("FILIPINO")).toBe(
      "Oo, maaari mong ipasa ang iyong mga physical requirements nang personal sa Barangay Pico Hall tuwing oras ng opisina (Lunes hanggang Biyernes, 8:00 AM hanggang 5:00 PM, maliban kapag holiday)."
    );
    expect(formatPhysicalSubmissionLocationAnswer("ILOCANO")).toBe(
      "Wen, mabalinmo nga isumiter a mismo dagiti physical requirements-mo sadiay Barangay Pico Hall iti oras ti opisina (Lunes aginggana Biyernes, 8:00 AM aginggana 5:00 PM, malaksid kadagiti holiday)."
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

describe("SKEAP slot limit", () => {
  it.each([
    "What is the limit slot of the SKEAP?",
    "How many SKEAP scholarship slots are there?",
    "Ilan ang slots ng SKEAP?",
    "Pila ti slot ti SKEAP?",
    "Manu ti limit ti SKEAP?",
    "Ada ba ti limit nu manu ti skolar nga maala ti SKEAP?",
  ])("recognizes slot limit questions: %s", (question) => {
    expect(isSkeapSlotLimitQuestion(question)).toBe(true);
  });

  it.each([
    "What happens if the SKEAP slots are full?",
    "What happens when capacity is reached?",
    "Can I apply while receiving another scholarship?",
    "How much is the SKEAP grant?",
  ])("does not mistake other scholarship questions for slot limit: %s", (question) => {
    expect(isSkeapSlotLimitQuestion(question)).toBe(false);
  });

  it("returns the exact 55-slot limit in English, Filipino, and Ilocano", () => {
    expect(formatSkeapSlotLimitAnswer("ENGLISH")).toBe(
      "The SKEAP scholarship program has a limit of 55 slots per academic term."
    );
    expect(formatSkeapSlotLimitAnswer("FILIPINO")).toBe(
      "Mayroong limitasyon na 55 slots lamang para sa SKEAP scholarship bawat academic term."
    );
    expect(formatSkeapSlotLimitAnswer("ILOCANO")).toBe(
      "Adda limitasion a 55 a slots ti SKEAP scholarship iti tunggal academic term."
    );
  });
});

describe("KK Profiling information", () => {
  it.each([
    "What is KK Profiling?",
    "What is the purpose of KK Profiling?",
    "Why is KK Profiling required?",
    "Ano ang KK Profiling?",
    "Para saan ang KK Profiling?",
    "An-ania ti KK Profiling?",
    "Apay a masapul ti KK Profiling?",
  ])("recognizes KK Profiling information questions: %s", (question) => {
    expect(isKkProfilingInfoQuestion(question)).toBe(true);
  });

  it.each([
    "When is KK Profiling?",
    "Where can I register?",
    "What is SKEAP?",
  ])("does not mistake unrelated questions for KK Profiling information: %s", (question) => {
    expect(isKkProfilingInfoQuestion(question)).toBe(false);
  });

  it("returns the specified KK Profiling response in English, Filipino, and Ilocano", () => {
    expect(formatKkProfilingInfoAnswer("ENGLISH")).toBe(
      "KK Profiling (Katipunan ng Kabataan Profiling) is an official youth census conducted by the Sangguniang Kabataan to register all youth residents aged 15 to 30 in Barangay Pico. It collects demographic data to help the SK Council plan targeted youth programs, scholarships, and community projects."
    );
    expect(formatKkProfilingInfoAnswer("FILIPINO")).toBe(
      "Ang KK Profiling (Katipunan ng Kabataan Profiling) ay isang opisyal na oryentasyon at pagtatala ng mga kabataang may edad 15 hanggang 30 taong gulang sa Barangay Pico. Layunin nitong makakolekta ng datos upang makabuo ang SK Council ng mga angkop na programa, scholarship, at proyekto para sa kabataan."
    );
    expect(formatKkProfilingInfoAnswer("ILOCANO")).toBe(
      "Ti KK Profiling (Katipunan ng Kabataan Profiling) ket maysa nga opisial a panagparehistro ken panag-sensus kadagiti amin a Agtutubo (15 aginggana 30 ti tawen) ditoy Barangay Pico. Masapul daytoy tapno makakolekta ti datos a mausar ti SK Council a mangaramid kadagiti babassit ken dadakkel a programa, scholarship, ken proyekto para kadagiti agtutubo."
    );
  });
});

describe("SKEAP full slots and waitlist policy", () => {
  it.each([
    "What happens if the slots are already full?",
    "What if SKEAP scholarship slots are filled?",
    "What happens when capacity is reached?",
    "What if the scholarship slots are maxed out?",
    "Ano ang mangyayari kapag punô na ang slots?",
    "Napunon ti slot ti SKEAP?",
  ])("recognizes full-slot questions: %s", (question) => {
    expect(isSkeapSlotsFullQuestion(question)).toBe(true);
  });

  it.each([
    "How much is the SKEAP scholarship?",
    "Can I apply while receiving another scholarship?",
    "Are SKEAP slots open?",
  ])("does not mistake unrelated questions for full slots: %s", (question) => {
    expect(isSkeapSlotsFullQuestion(question)).toBe(false);
  });

  it("returns the exact waitlist policy in English, Filipino, and Ilocano", () => {
    expect(formatSkeapSlotsFullAnswer("ENGLISH")).toBe(
      "If all available scholarship slots are already filled, new applicants will be placed on a waitlist. Waitlisted applications are processed on a strict first-come, first-served basis should slots open up."
    );
    expect(formatSkeapSlotsFullAnswer("FILIPINO")).toBe(
      "Kapag punô na ang lahat ng available na scholarship slots, ang mga susunod na mag-a-apply ay ilalagay sa waitlist. Ang pagproseso sa mga nasa waitlist ay nakabatay sa strict first-come, first-served basis kung may mabubuksan na slot."
    );
    expect(formatSkeapSlotsFullAnswer("ILOCANO")).toBe(
      "Nu napunon dagiti amin a nakasagana a scholarship slots, maikabil iti waitlist dagiti sumaruno nga ag-apply. Maiturong ti panagproseso kadagiti adda iti waitlist babaen ti strict first-come, first-served basis nu adda agserra wenno aglukat a slot."
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

describe("payout mode", () => {
  it.each([
    "How will I receive my payout?",
    "How are payouts distributed?",
    "What is the mode of payout?",
    "Paano matatanggap ang payout?",
    "Kasano nga maawat ti payout?",
    "pano ko kukunin ang payout? saan?",
    "saan kukunin ang payout?",
    "kasano ti agala ti payout? sadinno?",
    "sadinno ti pangalaan ti payout?",
  ])("recognizes payout mode questions: %s", (question) => {
    expect(isPayoutModeQuestion(question)).toBe(true);
  });

  it.each([
    "Can someone else claim my payout?",
    "How can a representative claim my payout?",
    "I have not received my payout.",
    "How much is my payout?",
  ])("does not mistake proxy, missing, or amount questions for payout mode: %s", (question) => {
    expect(isPayoutModeQuestion(question)).toBe(false);
  });

  it("returns the specified payout method in English, Filipino, and Ilocano", () => {
    expect(formatPayoutModeAnswer("ENGLISH")).toBe(
      "Payouts are distributed in cash during the Katipunan ng Kabataan (KK) Assembly. If you cannot attend in person, an authorized representative may claim it on your behalf by bringing a signed Authorization Letter and valid IDs."
    );
    expect(formatPayoutModeAnswer("FILIPINO")).toBe(
      "Ang mga payout ay ipinamamahagi nang cash sa gaganaping Katipunan ng Kabataan (KK) Assembly. Kung hindi ka makakapunta nang personal, maaari itong kunin ng iyong kinatawan sa pamamagitan ng pagdadala ng pormal na Authorization Letter at mga valid ID."
    );
    expect(formatPayoutModeAnswer("ILOCANO")).toBe(
      "Maited dagiti payout iti cash ti pannakaisayangkat ti Katipunan ng Kabataan (KK) Assembly. Nu hanka makapan a mismo, mabalin nga ag-claim ti autorisado a kinatawam babaen ti pannakaisagana ti pormal a Authorization Letter ken dagiti valid ID."
    );
  });
});

describe("missing payout resolution", () => {
  it.each([
    "What happens if I have not received my payout?",
    "I haven't received my scholarship payout.",
    "I did not receive my SKEAP grant.",
    "Hindi ko pa natanggap ang payout ko.",
    "Haan nga naawat ti payout-ko.",
    "The disbursement is missing.",
    "The funds are missing.",
  ])("recognizes missing payout questions: %s", (question) => {
    expect(isMissingPayoutQuestion(question)).toBe(true);
  });

  it.each([
    "pano ko kukunin ang payout? saan?",
    "saan kukunin ang payout?",
    "kasano ti agala ti payout? sadinno?",
    "Where is my payout?",
    "Saan ang payout ko?",
  ])("does not mistake standard payout claiming questions for missing payouts: %s", (question) => {
    expect(isMissingPayoutQuestion(question)).toBe(false);
  });

  it.each([
    "How much is the SKEAP grant?",
    "When can I claim my payout?",
    "Can someone else claim my payout?",
  ])("does not mistake other payout or grant questions for a missing payout: %s", (question) => {
    expect(isMissingPayoutQuestion(question)).toBe(false);
  });

  it("returns payout-status guidance without mentioning offline records", () => {
    expect(formatMissingPayoutAnswer("ENGLISH")).toBe(
      "If you have not received your payout, please visit the Barangay Pico Hall (Mon-Fri, 8:00 AM - 5:00 PM) with a valid ID so SK officials can check your payout status, or submit a formal inquiry through our Portal Inquiry Form."
    );
    expect(formatMissingPayoutAnswer("FILIPINO")).toBe(
      "Kung hindi mo pa natatanggap ang iyong payout, maaari kang pumunta sa Barangay Pico Hall (Lunes hanggang Biyernes, 8:00 AM - 5:00 PM) dala ang iyong valid ID upang ma-verify ng mga opisyal ng SK ang status ng iyong payout, o mag-submit ng inquiry gamit ang Portal Inquiry Form."
    );
    expect(formatMissingPayoutAnswer("ILOCANO")).toBe(
      "Nu hanmo pay naawat ti payout-mo, agturongka iti Barangay Pico Hall (Lunes aginggana Biyernes, 8:00 AM - 5:00 PM) nga addaan ti valid ID tapno ma-check dagiti opisyal ti SK ti status ti payout-mo, wenno ag-submit ti inquiry babaen ti Portal Inquiry Form."
    );
    for (const language of ["ENGLISH", "FILIPINO", "ILOCANO"] as const) {
      expect(formatMissingPayoutAnswer(language).toLowerCase()).not.toContain("offline");
      expect(formatMissingPayoutAnswer(language).toLowerCase()).not.toContain("records");
    }
  });
});

describe("multilingual SKEAP requirements", () => {
  it.each([
    "What happens if my requirements are lacking?",
    "What if my documents are incomplete?",
    "What happens if the submitted document is wrong?",
    "Kulang ang requirements ko, ano ang mangyayari?",
    "Mali ang naipasa kong dokumento.",
    "Kurang ti requirements.",
    "Kasano nu adda kamali nga naipasak nga requirements?",
    "Mabaliktad ti naikabil a dokumento.",
  ])("recognizes incomplete or incorrect requirements questions: %s", (question) => {
    expect(isIncompleteRequirementsQuestion(question)).toBe(true);
  });

  it.each([
    "What are the SKEAP requirements?",
    "Where can I get the SKEAP requirements?",
  ])("does not mistake requirements-list questions for a document problem: %s", (question) => {
    expect(isIncompleteRequirementsQuestion(question)).toBe(false);
  });

  it("returns the specified document correction workflow in English, Filipino, and Ilocano", () => {
    expect(formatIncompleteRequirementsAnswer("ENGLISH")).toBe(
      "If your requirements are lacking, you will not be able to proceed with your application. However, if any submitted document is incorrect or needs updates, the SK Admin can return your application so you can edit and resubmit it."
    );
    expect(formatIncompleteRequirementsAnswer("FILIPINO")).toBe(
      "Kung kulang ang iyong mga requirements, hindi ka makakapagpatuloy sa iyong aplikasyon. Gayunpaman, kung may maling naisumiteng dokumento, maaari itong ibalik ng SK Admin sa iyo upang maiwasto at maipasa muli."
    );
    expect(formatIncompleteRequirementsAnswer("ILOCANO")).toBe(
      "Nu kurang dagiti requirements-mo, hanka makatultuloy iti aplikasyonmo. Ngem nu adda kamali wenno salungasing kadagiti naisumiter a dokumento, mabalin nga isubli ti SK Admin ti aplikasyonmo tapno ma-edit-mo ken maipasamo manen."
    );
  });

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
