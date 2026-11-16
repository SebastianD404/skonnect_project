import type { Language } from "@prisma/client";

const SCHOLARSHIP_CONTEXT = /\b(skeap|scholarship|scholarships|iskolar|iskolarship|grant|grants)\b/i;
const OTHER_AWARD_TERMS =
  /\b(another|other|different|already|holding|receive|receiving|sabay|kasabay|iba(?:ng)?|mayroon|meron|dadduma|sabali|adda)\b/i;
const SKEAP_SLOT_CONTEXT = /\b(skeap|scholarship|scholarships|slot|slots|capacity)\b/i;
const FULL_CAPACITY_TERMS =
  /\b(full|filled|reached|reach|maximum|maxed|capacity|puno|napunon|naurnos)\b|punô/i;
const SLOT_OPENING_TERMS =
  /\b(open(?:s|ed|ing)?(?:\s+up)?|become\s+available|becomes\s+available|free(?:\s+up)?|vacant|vacancy|available|released|made\s+available|magkakaroon|mababakante|bakante|magbukas|mabuksan)\b|aglukat/i;
const SLOT_OPENING_QUESTION_TERMS = /\b(how|when|why|kailan|paano|kaano|kasano)\b/i;
const WAITLIST_SLOT_ACCESS_TERMS =
  /\b(?:get|receive|claim|offered|promoted?|makakakuha|makakuha|maala\w*|mangala\w*|makaala\w*|maipaay)\b/i;
const WAITLIST_TERMS = /\b(waitlist|wait-listed|waitlisted)\b/i;
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

export function isSkeapSlotOpeningQuestion(question: string) {
  const hasSlotContext = /\b(slot|slots|capacity)\b/i.test(question) || WAITLIST_TERMS.test(question);
  const asksHowSlotsOpen = SLOT_OPENING_TERMS.test(question);
  const asksAboutWaitlistAccess =
    WAITLIST_TERMS.test(question) && WAITLIST_SLOT_ACCESS_TERMS.test(question);
  return hasSlotContext &&
    !isSkeapSlotLimitQuestion(question) &&
    !FULL_CAPACITY_TERMS.test(question) &&
    ((SLOT_OPENING_QUESTION_TERMS.test(question) && asksHowSlotsOpen) ||
      asksAboutWaitlistAccess);
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
  return formatSkeapSlotOpeningAnswer(language);
}

export function formatSkeapSlotOpeningAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Nagkakaroon ng bakanteng SKEAP scholarship slot kapag nagtapos na sa programa ang kasalukuyang grantee o inalis siya dahil sa diskuwalipikasyon o pag-withdraw. Kapag may bakanteng slot, iaalok ito sa mga aplikanteng nasa waitlist ayon sa mahigpit na first-come, first-served na pagkakasunod-sunod.";
  }
  if (language === "ILOCANO") {
    return "Mabalin nga aglukat ti SKEAP scholarship slot no aggraduar dagiti agdama a grantee iti programa wenno maikkatda gapu iti diskwalipikasion wenno panag-withdraw. No adda slot a maluktan, maipaay daytoy kadagiti aplikante iti waitlist babaen iti nainget a first-come, first-served a panagsunod.";
  }
  return "SKEAP scholarship slots open up when current grantees graduate from the program or are removed due to disqualification or withdrawal. When a slot becomes available, it is offered to waitlisted applicants on a strict first-come, first-served basis.";
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
