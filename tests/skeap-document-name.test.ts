import { describe, expect, it } from "vitest";
import { SKEAP_UPLOAD_KEY } from "@/lib/skeap-upload";
import { matchesPersonName, verifyOcrDocumentName } from "@/lib/skeap-document-ocr";

const applicant = {
  firstName: "Sebastian",
  middleName: "Langaoan",
  lastName: "Damugo",
};

describe("SKEAP OCR name verification", () => {
  it("matches names regardless of order and tolerates accents and common OCR confusion", () => {
    const result = verifyOcrDocumentName(
      "CERTIFICATE DAMUG0, SEBASTIÁN L.",
      SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
      { applicant, confidence: 90 },
    );

    expect(result).toEqual({
      status: "MATCHED_APPLICANT",
      matchedName: "Sebastian Langaoan Damugo",
      message: "Applicant name matched the document.",
    });
    expect(matchesPersonName("SEBASTIAN LANGAOAN DAMUGO", applicant)).toBe(true);
  });

  it("accepts a listed parent's name for a low-income certificate", () => {
    const result = verifyOcrDocumentName(
      "CERTIFICATE OF LOW INCOME JUAN DE LA CRUZ",
      SKEAP_UPLOAD_KEY.FAMILY_INCOME,
      { applicant, fatherName: "Juan Dela Cruz", confidence: 90 },
    );

    expect(result.status).toBe("MATCHED_PARENT");
    expect(result.matchedName).toBe("Juan Dela Cruz");
  });

  it("does not accept a parent's name for an enrollment certificate", () => {
    const result = verifyOcrDocumentName(
      "CERTIFICATE OF ENROLLMENT JUAN DE LA CRUZ",
      SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
      { applicant, fatherName: "Juan Dela Cruz", confidence: 90 },
    );

    expect(result.status).toBe("NAME_MISMATCH");
  });

  it("distinguishes low readability from a clear name mismatch", () => {
    expect(verifyOcrDocumentName(
      "",
      SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
      { applicant, confidence: 10 },
    ).status).toBe("LOW_READABILITY");

    expect(verifyOcrDocumentName(
      "CERTIFICATE OF ENROLLMENT MARIA SANTOS",
      SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
      { applicant, confidence: 90 },
    ).status).toBe("NAME_MISMATCH");
  });

  it("matches an adult applicant by name when the certificate identifies Barangay Pico", () => {
    const result = verifyOcrDocumentName(
      "COMMISSION ON ELECTIONS VOTER CERTIFICATE BARANGAY PICO SEBASTIAN LANGAOAN DAMUGO",
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      {
        applicant,
        isRegisteredVoter: true,
        age: 20,
        confidence: 90,
      },
    );

    expect(result.status).toBe("MATCHED_APPLICANT");
    expect(result.matchedName).toBe("Sebastian Langaoan Damugo");
  });

  it("matches a minor's registered parent or guardian using significant name tokens", () => {
    const result = verifyOcrDocumentName(
      "COMELEC VOTER CERTIFICATE HOLDER JUAN DE LA CRUZ BARANGAY PICO",
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      {
        applicant,
        isRegisteredVoter: false,
        age: 17,
        parentVoterName: "Juan Dela Cruz",
        confidence: 90,
      },
    );

    expect(result.status).toBe("MATCHED_PARENT");
    expect(result.matchedName).toBe("Juan Dela Cruz");
  });

  it("falls back to family background names for a minor's voter certificate", () => {
    const result = verifyOcrDocumentName(
      "COMELEC CERTIFICATE BARANGAY PICO MARIA SANTOS",
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      {
        applicant,
        isRegisteredVoter: false,
        age: 16,
        fatherName: "Maria Santos",
        confidence: 90,
      },
    );

    expect(result.status).toBe("MATCHED_PARENT");
    expect(result.matchedName).toBe("Maria Santos");
  });

  it("matches an adult by applicant name regardless of the registered voter answer", () => {
    expect(verifyOcrDocumentName(
      "COMELEC VOTER CERTIFICATE BARANGAY PICO SEBASTIAN LANGAOAN DAMUGO",
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      {
        applicant,
        isRegisteredVoter: false,
        age: 20,
        confidence: 90,
      },
    ).status).toBe("MATCHED_APPLICANT");
  });

  it("matches a minor voter certificate by the applicant surname", () => {
    const result = verifyOcrDocumentName(
      "COMELEC VOTER CERTIFICATE BARANGAY PICO HOLDER DAMUGO",
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      { applicant, age: 17, confidence: 90 },
    );

    expect(result.status).toBe("MATCHED_PARENT");
    expect(result.matchedName).toBe("Damugo");
  });

  it("matches the entered guardian's full name on a valid Pico certificate", () => {
    const result = verifyOcrDocumentName(
      "COMELEC VOTER CERTIFICATE BARANGAY PICO HOLDER MARIA SANTOS",
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      {
        applicant,
        age: 16,
        parentVoterName: "Maria Santos",
        confidence: 90,
      },
    );

    expect(result).toEqual({
      status: "MATCHED_PARENT",
      matchedName: "Maria Santos",
      message: "Parent or guardian name matched the document.",
    });
  });

  it("marks a Pico certificate with a different surname for relationship verification", () => {
    const result = verifyOcrDocumentName(
      "COMELEC VOTER CERTIFICATE BARANGAY PICO HOLDER ELENA REYES",
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      { applicant, age: 17, parentVoterName: "Maria Santos", confidence: 90 },
    );

    expect(result.status).toBe("FOR_VERIFICATION");
    expect(result.message).toBe("Uploaded for SK Admin verification of parent/guardian relationship.");
  });

  it("does not auto-verify a voter certificate without a Barangay Pico reference", () => {
    const result = verifyOcrDocumentName(
      "COMELEC VOTER CERTIFICATE SEBASTIAN LANGAOAN DAMUGO",
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      { applicant, age: 20, confidence: 90 },
    );

    expect(result.status).toBe("FOR_VERIFICATION");
    expect(result.message).toContain("Barangay Pico");
  });
});
