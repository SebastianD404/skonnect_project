import type { Language } from "@prisma/client";

const PAYOUT_TERMS = /\b(payout|pay\s*out|scholarship\s+money|grant\s+money|allowance)\b/i;
const PROXY_TERMS =
  /\b(someone\s+else|another\s+person|other\s+person|on\s+my\s+behalf|representative|proxy|sabali|ibang\s+tao|iba\s+ang\s+kukuha|hindi\s+ako|di\s+ako|maited|agawat|agala|ag-ala|siyak)\b/i;

export function isPayoutProxyQuestion(question: string) {
  return PAYOUT_TERMS.test(question) && PROXY_TERMS.test(question);
}

export function formatPayoutProxyAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Oo, maaaring kunin ng ibang tao ang iyong payout sa pamamagitan ng pagdala ng pormal na Authorization Letter, kopya ng iyong valid ID, at valid ID ng taong kukuha.";
  }
  if (language === "ILOCANO") {
    return "Wen, mabalin nga agawat ti sabali para kenka babaen ti pannakaited ti pormal a surat ti autorisasion, kopia ti valid ID-mo, ken ti valid ID ti agala.";
  }
  return "Yes, someone else can claim your payout on your behalf by presenting a formal Authorization Letter, a copy of your valid ID, and the authorized person's valid ID.";
}
