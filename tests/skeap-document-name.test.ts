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

  it("matches an adult registered voter by applicant name without requiring a precinct location", () => {
    const result = verifyOcrDocumentName(
      "COMMISSION ON ELECTIONS VOTER CERTIFICATE SEBASTIAN LANGAOAN DAMUGO",
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
      "COMELEC VOTER CERTIFICATE HOLDER JUAN DE LA CRUZ BARANGAY",
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
      "COMELEC CERTIFICATE MARIA SANTOS",
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

  it("does not accept an applicant name when an adult is marked as not registered", () => {
    expect(verifyOcrDocumentName(
      "COMELEC VOTER CERTIFICATE SEBASTIAN LANGAOAN DAMUGO",
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE,
      {
        applicant,
        isRegisteredVoter: false,
        age: 20,
        confidence: 90,
      },
    ).status).toBe("NAME_MISMATCH");
  });
});
