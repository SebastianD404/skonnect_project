import { describe, expect, it } from "vitest";
import { validateRecognizedText } from "@/lib/ocrValidation";
import {
  isKKProfilingManualReview,
  KK_PROFILING_MANUAL_REVIEW_NOTE,
} from "@/lib/kk-profiling-review";

const validResidencyCertificate = (duration: string) =>
  `CERTIFICATE OF RESIDENCY. Barangay Pico, La Trinidad. Maria Santos has lived here for ${duration}.`;

describe("browser OCR document validation", () => {
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

  it("uses the non-blaming message when OCR returns too little text", () => {
    const result = validateRecognizedText("front_id", "ID");

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("LOW_CONFIDENCE");
    expect(result.message).toBe("Please Upload a Correct Valid ID.");
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
    expect(unrelatedCertificate.status).toBe("error");
    expect(unrelatedCertificate.message).toBe("Please Upload a Correct Valid ID.");
  });

  it("rejects unrelated back-side text with the requested ID feedback", () => {
    const result = validateRecognizedText(
      "back_id",
      "A menu of daily specials, soups, sandwiches and desserts.",
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
    expect(result.message).toBe("Please Upload a Correct Valid ID.");
  });

  it("flags a readable but mismatched document for correction", () => {
    const result = validateRecognizedText(
      "front_id",
      "CERTIFICATE OF RESIDENCY FOR BARANGAY PICO RESIDENT",
    );

    expect(result.status).toBe("error");
    expect(result.errorCode).toBe("UNRECOGNIZED_DOCUMENT");
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
