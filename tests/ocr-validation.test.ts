import { describe, expect, it } from "vitest";
import {
  analyzeGradeReportText,
  hasBackIdVerificationEvidence,
  normalizeOcrText,
  validateRecognizedText,
} from "@/lib/ocrValidation";
import {
  isKKProfilingManualReview,
  KK_PROFILING_MANUAL_REVIEW_NOTE,
} from "@/lib/kk-profiling-review";

const validResidencyCertificate = (duration: string) =>
  `CERTIFICATE OF RESIDENCY. Barangay Pico, La Trinidad. Maria Santos has lived here for ${duration}.`;

describe("browser OCR document validation", () => {
  it("returns non-blocking grade scale, GWA, and failing-grade diagnostics", () => {
    const result = analyzeGradeReportText(
      "Course Units Final Grade\nGE 101 Communication Skills 3.00 74\nIT-202 Network Systems 3.00 88",
    );

    expect(result).toMatchObject({
      detectedScale: "PERCENTAGE_100",
      estimatedGwa: 81,
      gwaCheckStatus: "MEETS_REQUIREMENT",
      meetsGwaRequirement: true,
      hasPossibleFailingGrade: true,
      flaggedSubjects: ["GE 101 Communication Skills: 74"],
      flaggedGrades: ["GE 101 Communication Skills: 74"],
      possibleFailingGradeMessage:
        "Possible failing grade detected. An SK Admin will verify your official grade report.",
    });
  });

  it("recognizes a readable front ID and checks its name", () => {
    const result = validateRecognizedText(
      "front_id",
      "REPUBLIC OF THE PHILIPPINES IDENTITY CARD NAME MARIA SANTOS STUDENT",
      { firstName: "Maria", lastName: "Santos" },
    );

    expect(result.status).toBe("success");
    expect(result.isValid).toBe(true);
    expect(result.nameMatched).toBe(true);
  });

  it("normalizes letter-spaced OCR text before matching ID keywords", () => {
    expect(normalizeOcrText("BENGUET STATE COLLEGE S T U D E N T I D NO.")).toBe(
      "BENGUET STATE COLLEGE STUDENT ID NO.",
    );
    const result = validateRecognizedText(
      "front_id",
      "BENGUET STATE COLLEGE S T U D E N T I D NO. B R I A N O. C O N N E R",
      { firstName: "Brian", lastName: "Conner" },
    );

    expect(result.status).toBe("success");
    expect(result.nameMatched).toBe(true);
    expect(result.matchedKeywords).toContain("Student");
  });

  it("sends uncertain or low-text IDs for verification instead of blocking the upload", () => {
    const result = validateRecognizedText("front_id", "ID");
    const unrelated = validateRecognizedText(
      "front_id",
      "A menu of daily specials, soups, sandwiches and desserts.",
    );

    expect(result.status).toBe("needs_review");
    expect(result.errorCode).toBe("LOW_CONFIDENCE");
    expect(unrelated.status).toBe("needs_review");
    expect(unrelated.badgeText).toBe("For Verification");
  });

  it("accepts student IDs using academic keywords and a matching name token", () => {
    const result = validateRecognizedText(
      "front_id",
      "BENGUET STATE COLLEGE STUDENT Brian O. Conner ID NO 2025-1047",
      { firstName: "Brian", lastName: "Conner" },
    );

    expect(result.status).toBe("success");
    expect(result.nameMatched).toBe(true);
  });

  it("accepts readable back-of-ID text without requiring front-side fields or a readable birthdate", () => {
    const result = validateRecognizedText(
      "back_id",
      "IDENTIFICATION CARD. STUDENT ID No. Address: Barangay Pico. Birthdate. Signature. PERSON TO CONTACT IN CASE OF EMERGENCY. RULES ON THE USE OF THIS ID CARD. VALID ISSUED ID.",
      { profileBirthDate: "01/15/2005" },
    );
    const cardStructureResult = validateRecognizedText(
      "back_id",
      "IDENTIFICATION CARD. NAME: MARIA SANTOS. ADDRESS: BARANGAY PICO. SIGNATURE.",
    );

    expect(result.status).toBe("success");
    expect(result.isValid).toBe(true);
    expect(result.message).toBe("Document text verified.");
    expect(cardStructureResult.status).toBe("success");
  });

  it("uses the distinct validIdBack rule for back-side keywords without front-side or DOB checks", () => {
    const result = validateRecognizedText(
      "validIdBack",
      "PERSON TO CONTACT IN CASE OF EMERGENCY. SIGNATURE. RULES ON USE OF THIS ID. Birthdate: 12/31/2000.",
      { profileBirthDate: "01/15/2005" },
    );
    const specimenCard = validateRecognizedText(
      "validIdBack",
      "Specimen. Registrar. Address. Student Identification Card.",
    );
    const unrelatedCertificate = validateRecognizedText(
      "validIdBack",
      "CERTIFICATE OF RESIDENCY. Barangay Pico. Resident address details are listed here.",
    );

    expect(result.status).toBe("success");
    expect(specimenCard.status).toBe("success");
    expect(unrelatedCertificate.status).toBe("needs_review");
    expect(unrelatedCertificate.badgeText).toBe("For Verification");
  });

  it("recognizes back-side verification evidence from birth date, contact, address, or emergency text", () => {
    expect(hasBackIdVerificationEvidence("B I R T H D A T E: 01/15/2005")).toBe(true);
    expect(hasBackIdVerificationEvidence("PERSON TO CONTACT IN CASE OF EMERGENCY")).toBe(true);
    expect(hasBackIdVerificationEvidence("Address: Barangay Pico")).toBe(true);

    const result = validateRecognizedText(
      "back_id",
      "PERSON TO CONTACT IN CASE OF EMERGENCY. Address and Birth Date.",
    );
    expect(result.status).toBe("success");
  });

  it("routes unrelated back-side text to verification instead of hard-blocking it", () => {
    const result = validateRecognizedText(
      "back_id",
      "A menu of daily specials, soups, sandwiches and desserts.",
    );

    expect(result.status).toBe("needs_review");
    expect(result.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
    expect(result.badgeText).toBe("For Verification");
  });

  it("flags a readable but mismatched ID for SK Admin verification", () => {
    const result = validateRecognizedText(
      "front_id",
      "BENGUET STATE COLLEGE STUDENT ID NO 2025-1047",
      { firstName: "Brian", lastName: "Conner" },
    );

    expect(result.status).toBe("needs_review");
    expect(result.errorCode).toBe("NAME_MISMATCH");
  });

  it("rejects a low-income certificate even if it mentions residency and six months", () => {
    const result = validateRecognizedText(
      "certificate",
      "CERTIFICATE OF LOW-INCOME OF PARENTS OR GUARDIAN. Applicant is a resident of Barangay Pico for 6 months.",
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
  });

  it.each([
    "CERTIFICATE OF ENROLLMENT (COE). Maria Santos is a resident of Barangay Pico, La Trinidad and has lived here for 1 year.",
    "CLI. Maria Santos is a resident of Barangay Pico, La Trinidad and has lived here for 1 year.",
    "CERTIFICATE OF LOW INCOME. Maria Santos is a resident of Barangay Pico, La Trinidad and has lived here for 1 year.",
  ])("rejects a non-residency certificate that includes residency details: %s", (text) => {
    const result = validateRecognizedText("certificate", text);

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
  });

  it("requires residency-specific wording and the six-month requirement", () => {
    const genericCertificate = validateRecognizedText(
      "certificate",
      "CERTIFICATE OF GOOD MORAL CHARACTER. Applicant completed the program 6 months ago.",
    );
    const residencyCertificate = validateRecognizedText(
      "certificate",
      "CERTIFICATE OF RESIDENCY. This certifies that Maria Santos is a resident of Barangay Pico, La Trinidad and has lived here for 6 months.",
      { firstName: "Maria", lastName: "Santos" },
    );

    expect(genericCertificate.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
    expect(residencyCertificate.status).toBe("success");
    expect(residencyCertificate.isValid).toBe(true);
  });

  it("rejects a residency certificate that states only five months", () => {
    const result = validateRecognizedText(
      "certificate",
      "CERTIFICATE OF RESIDENCY. This certifies that Maria Santos is a resident of Barangay Pico, La Trinidad and has lived here for 5 months.",
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RESIDENCY_TOO_SHORT");
    expect(result.message).toBe(
      "This certificate shows less than the required 6 months of residency in Barangay Pico. Please upload an updated certificate.",
    );
  });

  it("does not accept a duration described as less than six months", () => {
    const result = validateRecognizedText(
      "certificate",
      validResidencyCertificate("less than 6 months"),
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RESIDENCY_DURATION_UNCONFIRMED");
  });

  it.each([
    "6 months",
    "seven (7) months",
    "1 year",
    "two years",
  ])("accepts a residency duration of %s", (duration) => {
    const result = validateRecognizedText("certificate", validResidencyCertificate(duration));

    expect(result.status).toBe("success");
    expect(result.isValid).toBe(true);
  });

  it("requests a manual check when the duration cannot be read from an issued residency certificate", () => {
    const result = validateRecognizedText(
      "certificate",
      "CERTIFICATE OF RESIDENCY. Barangay Pico, La Trinidad. Maria Santos is a resident of this barangay.",
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("RESIDENCY_DURATION_UNCONFIRMED");
    expect(result.badgeText).toBe("Needs Manual Check");
  });

  it("requires the residency certificate to identify Barangay Pico, La Trinidad", () => {
    const result = validateRecognizedText(
      "certificate",
      "CERTIFICATE OF RESIDENCY. Barangay Pico. Maria Santos has lived here for 6 months.",
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
  });
});

describe("KK profiling manual review marker", () => {
  it("recognizes the explicit scanner-failure review note", () => {
    expect(isKKProfilingManualReview(KK_PROFILING_MANUAL_REVIEW_NOTE)).toBe(true);
    expect(isKKProfilingManualReview(null)).toBe(false);
  });
});
