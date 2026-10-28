import type { Language } from "@prisma/client";

const SCHOLARSHIP_CONTEXT = /\b(skeap|scholarship|scholarships|iskolar|iskolarship|grant|grants)\b/i;
const OTHER_AWARD_TERMS =
  /\b(another|other|different|already|holding|receive|receiving|sabay|kasabay|iba(?:ng)?|mayroon|meron|dadduma|sabali|adda)\b/i;

export function isDualScholarshipQuestion(question: string) {
  return SCHOLARSHIP_CONTEXT.test(question) && OTHER_AWARD_TERMS.test(question);
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
