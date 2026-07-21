import { compareTwoStrings } from "string-similarity";

export function normalizeForOcrComparison(value: string) {
  return String(value)
    .toUpperCase()
    .replace(/,/g, " ")
    .replace(/[^A-Z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getWordsFromOcrText(text: string) {
  return normalizeForOcrComparison(text).split(" ").filter(Boolean);
}

export function getBestNameMatchScore(nameToken: string, ocrWords: string[]) {
  const normalizedName = normalizeForOcrComparison(nameToken);
  if (!normalizedName || ocrWords.length === 0) {
    return 0;
  }

  return Math.max(
    ...ocrWords.map((ocrWord) => compareTwoStrings(normalizedName, ocrWord))
  );
}

export function doesOcrTextMatchName(
  firstName: string,
  lastName: string,
  text: string,
  threshold = 0.8
) {
  const ocrWords = getWordsFromOcrText(text);
  if (ocrWords.length === 0) {
    return false;
  }

  const firstTokens = normalizeForOcrComparison(firstName).split(" ").filter(Boolean);
  const lastTokens = normalizeForOcrComparison(lastName).split(" ").filter(Boolean);

  if (firstTokens.length === 0 || lastTokens.length === 0) {
    return false;
  }

  const firstPass = firstTokens.every(
    (token) => getBestNameMatchScore(token, ocrWords) >= threshold
  );
  const lastPass = lastTokens.every(
    (token) => getBestNameMatchScore(token, ocrWords) >= threshold
  );

  return firstPass && lastPass;
}
