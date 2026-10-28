import type { Language } from "@prisma/client";

const PERSONAL_DATA_CONTEXT =
  /\b(personal\s+(?:information|data|details?)|information|data|details?|impormasyon|datos|impormasyonko|datosko)\b/i;
const PRIVACY_CONCERN =
  /\b(safe|secure|security|private|privacy|protected|protection|ligtas|safe|secure|pribado|protektado|protektaran|natalged|na-protektaran)\b/i;

export function isDataPrivacyQuestion(question: string) {
  return PERSONAL_DATA_CONTEXT.test(question) && PRIVACY_CONCERN.test(question);
}

export function formatDataPrivacyAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Oo, ligtas ang iyong personal na impormasyon sa SKonnect. Ang lahat ng datos ay mahigpit na pinoprotektahan alinsunod sa Data Privacy Act of 2012 (RA 10173) at eksklusibong maa-access lamang ng mga awtorisadong opisyal ng SK ng Barangay Pico para sa opisyal na pagproseso.";
  }
  if (language === "ILOCANO") {
    return "Wen, natalged ti personal nga impormasyon mo ditoy SKonnect. Dagiti amin a datos ket sibubukel a naprotektaran babaen ti Data Privacy Act of 2012 (RA 10173) ken naitured laeng kadagiti autorisado nga opisyal ti SK ti Barangay Pico para iti opisial a pagproseso.";
  }
  return "Yes, your personal information is safe in SKonnect. All data collected is strictly protected in compliance with the Data Privacy Act of 2012 (RA 10173) and is accessible only to authorized Barangay Pico SK officials for official program processing.";
}
