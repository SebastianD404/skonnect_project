import type { Language } from "@prisma/client";

const GRANT_CONTEXT =
  /\b(skeap|grantee|grantees|scholarship|scholar|grant|allowance|stipend)\b/i;
const GRANT_AMOUNT_TERMS =
  /\b(amount|how much|money|receive|receives|allowance|grant|kwarta|magkano|manu)\b/i;
const ILOCANO_GRANT_AMOUNT_QUESTION = /\bmanu\s+ti\s+maalak\s+nga\s+kwarta\b/i;

export function isSkeapGrantAmountQuestion(question: string) {
  return ILOCANO_GRANT_AMOUNT_QUESTION.test(question)
    || (GRANT_CONTEXT.test(question) && GRANT_AMOUNT_TERMS.test(question));
}

export function formatSkeapGrantAmountAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Makakatanggap ng ₱5,000 na grant ang mga aprubadong SKEAP grantees.";
  }
  if (language === "ILOCANO") {
    return "Makaawat ti ₱5,000 a grant dagiti aprubado a SKEAP grantees.";
  }
  return "SKEAP grantees will receive a financial grant of ₱5,000.";
}
