import { z } from "zod";

export const PLACE_OF_BIRTH_ERROR_MESSAGE =
  "Enter your full birth city/municipality without abbreviations (e.g., La Trinidad, Benguet).";

const PLACE_ABBREVIATIONS = new Set([
  "LTB",
  "BGH",
  "BC",
  "BEGH",
  "SLU",
  "BSU",
  "UC",
  "UB",
  "CAR",
  "NCR",
  "QC",
  "MNL",
  "BAGUIO",
  "LT",
]);

export function normalizePlaceOfBirthKey(value: string) {
  return value.trim().replace(/\s+/g, " ").replace(/[.\s,-]+/g, "").toUpperCase();
}

export function validatePlaceOfBirth(value: string): string | null {
  const trimmed = value.trim().replace(/\s+/g, " ");
  const compact = normalizePlaceOfBirthKey(trimmed);
  const isDottedInitialism = /^(?:[A-Za-z]\.){2,}[A-Za-z]?\.?$/.test(trimmed);
  const isKnownAbbreviation = PLACE_ABBREVIATIONS.has(compact);
  const isShortConsonantAcronym = /^[A-Z]{2,4}$/.test(compact) && !/[AEIOU]/.test(compact);

  if (!trimmed || isDottedInitialism || isKnownAbbreviation || isShortConsonantAcronym) {
    return PLACE_OF_BIRTH_ERROR_MESSAGE;
  }

  return null;
}

export function getPlaceOfBirthSuggestion(value: string): string | null {
  const compact = normalizePlaceOfBirthKey(value);
  if (compact === "BC" || compact === "BGH") return "Baguio City";
  return null;
}

export const placeOfBirthSchema = z
  .string()
  .trim()
  .min(1, PLACE_OF_BIRTH_ERROR_MESSAGE)
  .refine((value) => validatePlaceOfBirth(value) === null, {
    message: PLACE_OF_BIRTH_ERROR_MESSAGE,
  });

export function getPlaceOfBirthError(value: string) {
  return validatePlaceOfBirth(value);
}
