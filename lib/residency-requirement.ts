export const MINIMUM_RESIDENCY_MONTHS = 6;

export const MINIMUM_RESIDENCY_MONTHS_TEXT = `${MINIMUM_RESIDENCY_MONTHS} months`;

const RESIDENCY_NUMBER_WORDS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  a: 1,
  an: 1,
};

const NUMBER_WORD_PATTERN = Object.keys(RESIDENCY_NUMBER_WORDS).join("|");
const RESIDENCY_DURATION_PATTERN = new RegExp(
  `\\b(\\d{1,3}|${NUMBER_WORD_PATTERN})(?:\\s*\\(\\s*(\\d{1,3}|${NUMBER_WORD_PATTERN})\\s*\\))?\\s*(months?|mos\\.?|years?|yrs?)(?![a-z])`,
  "i",
);

export type ResidencyDuration = {
  text: string;
  months: number;
};

function parseDurationAmount(value: string) {
  const normalized = value.toLowerCase();
  if (Object.hasOwn(RESIDENCY_NUMBER_WORDS, normalized)) {
    return RESIDENCY_NUMBER_WORDS[normalized];
  }
  return Number(normalized);
}

export function extractResidencyDuration(text: string): ResidencyDuration | null {
  const match = RESIDENCY_DURATION_PATTERN.exec(text);
  if (!match) return null;
  const precedingText = text.slice(0, match.index);
  if (/(?:less than|under|below|up to|at most|not more than)\s*$/i.test(precedingText)) {
    return null;
  }

  const amount = parseDurationAmount(match[2] ?? match[1]);
  const unit = match[3].toLowerCase();
  const months = unit.startsWith("year") || unit.startsWith("yr")
    ? amount * 12
    : amount;

  return { text: match[0], months };
}

export function hasBarangayPicoIssuer(text: string) {
  return /\b(?:barangay|brgy\.?)\s+pico\b/i.test(text) && /\bla\s+trinidad\b/i.test(text);
}
