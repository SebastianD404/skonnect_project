import type { Language } from "@prisma/client";

const PAYOUT_TERMS = /\b(payouts?|pay\s*out|scholarship\s+money|grant\s+money|allowance)\b/i;
const MISSING_PAYOUT_CONTEXT =
  /\b(payout|pay\s*out|disbursement|funds?|scholarship|grant|allowance)\b/i;
const MISSING_PAYOUT_TERMS =
  /\b(did\s+not\s+receive|didn't\s+receive|have\s+not\s+received|haven't\s+received|has\s+not\s+received|hasn't\s+received|not\s+received|did\s+not\s+get|didn't\s+get|haven't\s+gotten|unreceived|missing|hindi\s+(?:ko\s+)?(?:pa\s+)?natanggap|di\s+(?:ko\s+)?(?:pa\s+)?natanggap|hindi\s+pa\s+nakuha|wala\s+pa|haan\s+(?:nga\s+)?naawat|haan\s+pay\s+naawat|hanto\s+pay\s+naawat|awan\s+pay)\b/i;
const PROXY_TERMS =
  /\b(someone\s+else|another\s+person|other\s+person|on\s+my\s+behalf|representative|proxy|sabali|ibang\s+tao|iba\s+ang\s+kukuha|hindi\s+ako|di\s+ako|maited|agawat|siyak)\b/i;
const PAYOUT_MODE_QUESTION =
  /\b(mode\s+of\s+(?:the\s+)?payout|how\s+(?:(?:will|do|can|would)\s+)?(?:i|we|you|grantees?)?\s*(?:receive|get|collect)|how\s+(?:are|is)\s+(?:the\s+)?payouts?\s+(?:distributed|given|paid)|paano\b.*\b(?:matatanggap|matanggap|makukuha|natatanggap|ipinamamahagi|ibinibigay)|kasano\b.*\b(?:maawat|maited|maala))\b/i;
const STANDARD_CLAIM_QUESTION =
  /\b(?:how|where|pano|paano|saan|sadinno|kasano)\b.*\b(?:claim|receive|get|collect|kunin|kukunin|kuha|ag-?ala|pangalaan|maawat|maala)\b.*\b(?:payout|grant|money)\b|\b(?:how|where)\b.*\b(?:claim|receive|get|collect)\b.*\b(?:payout|grant|money)\b/i;

export function isMissingPayoutQuestion(question: string) {
  return MISSING_PAYOUT_CONTEXT.test(question) && MISSING_PAYOUT_TERMS.test(question);
}

export function isPayoutModeQuestion(question: string) {
  return PAYOUT_TERMS.test(question)
    && (PAYOUT_MODE_QUESTION.test(question) || STANDARD_CLAIM_QUESTION.test(question))
    && !PROXY_TERMS.test(question);
}

export function formatPayoutModeAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Ang mga payout ay ipinamamahagi nang cash sa gaganaping Katipunan ng Kabataan (KK) Assembly. Kung hindi ka makakapunta nang personal, maaari itong kunin ng iyong kinatawan sa pamamagitan ng pagdadala ng pormal na Authorization Letter at mga valid ID.";
  }
  if (language === "ILOCANO") {
    return "Maited dagiti payout iti cash ti pannakaisayangkat ti Katipunan ng Kabataan (KK) Assembly. Nu hanka makapan a mismo, mabalin nga ag-claim ti autorisado a kinatawam babaen ti pannakaisagana ti pormal a Authorization Letter ken dagiti valid ID.";
  }
  return "Payouts are distributed in cash during the Katipunan ng Kabataan (KK) Assembly. If you cannot attend in person, an authorized representative may claim it on your behalf by bringing a signed Authorization Letter and valid IDs.";
}

export function formatMissingPayoutAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Kung hindi mo pa natatanggap ang iyong payout, maaari kang pumunta sa Barangay Pico Hall (Lunes hanggang Biyernes, 8:00 AM - 5:00 PM) dala ang iyong valid ID upang ma-verify ng mga opisyal ng SK ang status ng iyong payout, o mag-submit ng inquiry gamit ang Portal Inquiry Form.";
  }
  if (language === "ILOCANO") {
    return "Nu hanmo pay naawat ti payout-mo, agturongka iti Barangay Pico Hall (Lunes aginggana Biyernes, 8:00 AM - 5:00 PM) nga addaan ti valid ID tapno ma-check dagiti opisyal ti SK ti status ti payout-mo, wenno ag-submit ti inquiry babaen ti Portal Inquiry Form.";
  }
  return "If you have not received your payout, please visit the Barangay Pico Hall (Mon-Fri, 8:00 AM - 5:00 PM) with a valid ID so SK officials can check your payout status, or submit a formal inquiry through our Portal Inquiry Form.";
}

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
