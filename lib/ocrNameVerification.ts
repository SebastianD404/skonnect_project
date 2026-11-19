import { compareTwoStrings } from "string-similarity";

export function normalizeForOcrComparison(value: string) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
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

  const averageScore = (tokens: string[]) => {
    const scores = tokens.map((token) => getBestNameMatchScore(token, ocrWords));
    return scores.reduce((total, score) => total + score, 0) / scores.length;
  };

  const relaxedThreshold = Math.min(threshold, 0.65);
  const firstPass = averageScore(firstTokens) >= relaxedThreshold;
  const lastPass = averageScore(lastTokens) >= relaxedThreshold;

  return firstPass && lastPass;
}

function getLevenshteinDistance(left: string, right: string) {
  const previousRow = Array.from({ length: right.length + 1 }, (_, index) => index);

  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const currentRow = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      currentRow[rightIndex] = Math.min(
        currentRow[rightIndex - 1] + 1,
        previousRow[rightIndex] + 1,
        previousRow[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previousRow.splice(0, previousRow.length, ...currentRow);
  }

  return previousRow[right.length];
}

function doesNameTokenMatchOcr(nameToken: string, ocrWords: string[]) {
  const normalizedToken = normalizeForOcrComparison(nameToken).toLowerCase();
  return ocrWords.some((ocrWord) => {
    const normalizedOcrWord = ocrWord.toLowerCase();
    if (normalizedToken === normalizedOcrWord) return true;
    return normalizedToken.length >= 4 &&
      getLevenshteinDistance(normalizedToken, normalizedOcrWord) <= 1;
  });
}

export function doesOcrTextMatchNameTokens(
  firstName: string,
  lastName: string,
  text: string,
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

  return [...firstTokens, ...lastTokens].every((token) =>
    doesNameTokenMatchOcr(token, ocrWords)
  );
}

export type OcrNameVerificationStatus =
  | "verified"
  | "name_mismatch"
  | "for_verification";

export function getOcrNameVerificationStatus(
  firstName: string,
  lastName: string,
  text: string,
): OcrNameVerificationStatus {
  const readableCharacterCount = String(text).replace(/[^a-z0-9]/gi, "").length;
  if (readableCharacterCount < 15 || !firstName.trim() || !lastName.trim()) {
    return "for_verification";
  }

  return doesOcrTextMatchNameTokens(firstName, lastName, text)
    ? "verified"
    : "name_mismatch";
}
