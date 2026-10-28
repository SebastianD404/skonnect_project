import type { Language } from "@prisma/client";

const FACILITY_MENTION = /\b(barangay hall|barangay pico hall|town hall|municipal hall)\b/i;

const HOURS_TERMS =
  /\b(hour|hours|time|times|open|opens|opening|close|closes|closed|operating|schedule|day|days|oras|araw|bukas|aglukat|sii-lukat|saan nga aldaw)\b/i;

export function isFacilityHoursQuestion(question: string) {
  return FACILITY_MENTION.test(question) && HOURS_TERMS.test(question);
}

export function formatFacilityHoursAnswer(language: Language) {
  if (language === "FILIPINO") {
    return "Bukas ang Barangay Hall mula Lunes hanggang Biyernes, 8:00 AM hanggang 5:00 PM, maliban tuwing holidays.";
  }
  if (language === "ILOCANO") {
    return "Sii-lukat ti Barangay Hall manipud Lunes aginggana Biyernes, 8:00 AM aginggana 5:00 PM, malaksid kadagiti holidays.";
  }
  return "The Barangay Hall is open from Monday to Friday, 8:00 AM to 5:00 PM, except on holidays.";
}
