import type { Language } from "@prisma/client";

const SCHOLARSHIP_CONTEXT = /\b(skeap|scholarship|scholarships|iskolar|iskolarship|grant|grants)\b/i;
const OTHER_AWARD_TERMS =
  /\b(another|other|different|already|holding|receive|receiving|sabay|kasabay|iba(?:ng)?|mayroon|meron|dadduma|sabali|adda)\b/i;
const SKEAP_SLOT_CONTEXT = /\b(skeap|scholarship|scholarships|slot|slots|capacity)\b/i;
const FULL_CAPACITY_TERMS =
  /\b(full|filled|reached|reach|maximum|maxed|capacity|puno|napunon|naurnos)\b|punô/i;
const SKEAP_SLOT_LIMIT_CONTEXT =
  /\b(skeap|scholarships?|slots?|capacity|quota|limit|skolar)\b/i;
const SKEAP_SLOT_QUANTITY_TERMS =
  /\b(how\s+many|number|limit|quota|maximum|ilan|ilang|pila|manu|mano|kadami|karami)\b|slot\s+capacity|capacity\s+(?:of|for)\b/i;
const KK_PROFILING_CONTEXT =
  /\b(?:kk\s+profiling|katipunan\s+ng\s+kabataan(?:\s+profiling)?)\b/i;
const KK_PROFILING_INTENT =
  /\b(what|whats|meaning|define|purpose|why|required|explain|ano|anong|bakit|layunin|kailangan|para\s+saan|an-ania|ania|apay|panggep|kasapulan|masapul)\b/i;

export function isDualScholarshipQuestion(question: string) {
  return SCHOLARSHIP_CONTEXT.test(question) && OTHER_AWARD_TERMS.test(question);
}

export function isSkeapSlotsFullQuestion(question: string) {
  return SKEAP_SLOT_CONTEXT.test(question) && FULL_CAPACITY_TERMS.test(question);
}

export function isSkeapSlotLimitQuestion(question: string) {
  return SKEAP_SLOT_LIMIT_CONTEXT.test(question) && SKEAP_SLOT_QUANTITY_TERMS.test(question);
}

export function formatSkeapSlotLimitAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Mayroong limitasyon na 55 slots lamang para sa SKEAP scholarship bawat academic term.";
  }
  if (language === "ILOCANO") {
    return "Adda limitasion a 55 a slots ti SKEAP scholarship iti tunggal academic term.";
  }
  return "The SKEAP scholarship program has a limit of 55 slots per academic term.";
}

export function formatSkeapSlotsFullAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Kapag punô na ang lahat ng available na scholarship slots, ang mga susunod na mag-a-apply ay ilalagay sa waitlist. Ang pagproseso sa mga nasa waitlist ay nakabatay sa strict first-come, first-served basis kung may mabubuksan na slot.";
  }
  if (language === "ILOCANO") {
    return "Nu napunon dagiti amin a nakasagana a scholarship slots, maikabil iti waitlist dagiti sumaruno nga ag-apply. Maiturong ti panagproseso kadagiti adda iti waitlist babaen ti strict first-come, first-served basis nu adda agserra wenno aglukat a slot.";
  }
  return "If all available scholarship slots are already filled, new applicants will be placed on a waitlist. Waitlisted applications are processed on a strict first-come, first-served basis should slots open up.";
}

export function isKkProfilingInfoQuestion(question: string) {
  return KK_PROFILING_CONTEXT.test(question) && KK_PROFILING_INTENT.test(question);
}

export function formatKkProfilingInfoAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Ang KK Profiling (Katipunan ng Kabataan Profiling) ay isang opisyal na oryentasyon at pagtatala ng mga kabataang may edad 15 hanggang 30 taong gulang sa Barangay Pico. Layunin nitong makakolekta ng datos upang makabuo ang SK Council ng mga angkop na programa, scholarship, at proyekto para sa kabataan.";
  }
  if (language === "ILOCANO") {
    return "Ti KK Profiling (Katipunan ng Kabataan Profiling) ket maysa nga opisial a panagparehistro ken panag-sensus kadagiti amin a Agtutubo (15 aginggana 30 ti tawen) ditoy Barangay Pico. Masapul daytoy tapno makakolekta ti datos a mausar ti SK Council a mangaramid kadagiti babassit ken dadakkel a programa, scholarship, ken proyekto para kadagiti agtutubo.";
  }
  return "KK Profiling (Katipunan ng Kabataan Profiling) is an official youth census conducted by the Sangguniang Kabataan to register all youth residents aged 15 to 30 in Barangay Pico. It collects demographic data to help the SK Council plan targeted youth programs, scholarships, and community projects.";
}

export function formatDualScholarshipAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Ang pag-apply sa SKEAP habang mayroon ka nang ibang scholarship ay karaniwang hindi pinapayagan.";
  }
  if (language === "ILOCANO") {
    return "Ti panag-apply iti SKEAP bayat nga adda pay sabali a scholarship-mo ket sapasap a saan a maipalubos.";
  }
  return "Applying for SKEAP while already receiving another scholarship is generally not allowed.";
}
