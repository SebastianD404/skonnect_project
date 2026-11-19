import { describe, expect, it } from "vitest";
import {
  doesOcrTextMatchNameTokens,
  getOcrNameVerificationStatus,
  normalizeForOcrComparison,
} from "@/lib/ocrNameVerification";

describe("OCR name verification", () => {
  it("normalizes punctuation and matches surname-first and given-name-first formats", () => {
    expect(normalizeForOcrComparison("Mendoza, Althea M.")).toBe("mendoza althea m");
    expect(doesOcrTextMatchNameTokens("Althea", "Mendoza", "Mendoza, Althea Santos")).toBe(true);
    expect(doesOcrTextMatchNameTokens("Althea", "Mendoza", "Althea Santos Mendoza")).toBe(true);
  });

  it("tolerates one OCR character error in name tokens of at least four characters", () => {
    expect(doesOcrTextMatchNameTokens("Althea", "Mendoza", "Althia Mendoza")).toBe(true);
    expect(doesOcrTextMatchNameTokens("Ana", "Mendoza", "Anna Mendosa")).toBe(false);
  });

  it("flags readable text with a mismatched name and defers unreadable text for review", () => {
    expect(getOcrNameVerificationStatus("Althea", "Mendoza", "Althea Mendoza ID NO 123456")).toBe(
      "verified",
    );
    expect(getOcrNameVerificationStatus("Althea", "Mendoza", "Other Person ID NO 123456")).toBe(
      "name_mismatch",
    );
    expect(getOcrNameVerificationStatus("Althea", "Mendoza", "Althea")).toBe(
      "for_verification",
    );
    expect(getOcrNameVerificationStatus("", "Mendoza", "Other Person ID NO 123456")).toBe(
      "for_verification",
    );
  });
});
