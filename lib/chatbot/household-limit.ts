import type { Language } from "@prisma/client";

const HOUSEHOLD_TERMS =
  /\b(household|family|families|home|per\s+house|bahay|pamilya|balay|pamilia)\b/i;
const HOUSEHOLD_QUANTITY_TERMS =
  /\b(how\s+many|number|limit|ilan|ilang|manu|mano|maysa|isa|one|scholar|iskolar|skolar)\b/i;

export function isHouseholdLimitQuestion(question: string) {
  return HOUSEHOLD_TERMS.test(question) && HOUSEHOLD_QUANTITY_TERMS.test(question);
}

export function formatHouseholdLimitAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Isang (1) iskolar lamang ang pinapayagan sa bawat bahay o pamilya.";
  }
  if (language === "ILOCANO") {
    return "Maysa (1) laeng a scholar ti mabalin iti tunggal balay wenno pamilia.";
  }
  return "Only one (1) scholar is allowed per household.";
}
