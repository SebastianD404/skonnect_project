import { describe, expect, it } from "vitest";
import PizZip from "pizzip";
import { POST } from "../app/api/validate-document/route";
import {
  extractDocxEmbeddedImages,
  getSkeapDocumentKeywordMatches,
  getKkProfilingValidIdMatches,
} from "../lib/skeap-document-keywords";
import { SKEAP_UPLOAD_KEY } from "../lib/skeap-upload";

function createDocxFile(text: string, name = "application.docx") {
  const zip = new PizZip();
  zip.file("word/document.xml", `<w:document><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:document>`);
  const buffer = zip.generate({ type: "uint8array" }).slice().buffer as ArrayBuffer;
  return new File([buffer], name, {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

function createDocxBufferWithImages() {
  const zip = new PizZip();
  zip.file("word/document.xml", "<w:document><w:p><w:r><w:t>Applicant</w:t></w:r></w:p></w:document>");
  zip.file("word/media/image1.jpeg", new Uint8Array([1, 2, 3]));
  zip.file("word/media/image2.png", new Uint8Array([4, 5, 6]));
  zip.file("word/media/image3.emf", new Uint8Array([7, 8, 9]));
  return zip.generate({ type: "uint8array" });
}

async function validate(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE);
  const response = await POST(new Request("http://localhost/api/validate-document", {
    method: "POST",
    body: formData,
  }));
  return response.json();
}

describe("POST /api/validate-document SKEAP DOCX validation", () => {
  it.each([
    ["Family Income Certificate", "family income certificate"],
    ["Income Certificate - Annual Income", "income certificate"],
    ["Gross Total Income", "gross total income"],
    ["Bureau of Internal Revenue BIR Form 2316", "form 2316"],
    ["Income Tax Return Form 1701", "income tax return"],
    ["Certificate of Tax Exemption", "certificate of tax exemption"],
    ["Certificate of Indigence - DSWD Social Welfare", "certificate of indigence"],
  ])("matches family income documents containing %s", (text, keyword) => {
    expect(getSkeapDocumentKeywordMatches(text, SKEAP_UPLOAD_KEY.FAMILY_INCOME))
      .toContain(keyword);
  });

  it.each([
    ["PSA Birth Certificate", "psa"],
  ])("verifies DOCX text matching %s", async (text, keyword) => {
    const result = await validate(createDocxFile(text));

    expect(result).toMatchObject({
      success: true,
      status: "verified",
      isValid: true,
    });
    expect(result.matchedKeywords).toContain(keyword);
    expect(result.text).toBe(text);
  });

  it("sends unrelated DOCX content for manual review", async () => {
    const result = await validate(createDocxFile("Linux Mint and Ubuntu Act"));

    expect(result).toMatchObject({
      success: true,
      status: "needs_review",
      isValid: false,
      matchedKeywords: [],
      message: "We couldn't verify this document automatically. If your uploaded file is clear and correct, you can safely proceed anyway.",
    });

  });

  it("keeps birth certificate matching separate from the KK Profiling valid-ID rules", () => {
    const validSchoolIdText = "King's College of the Philippines Student ID No. 12345 La Trinidad Benguet";
    const birthCertificateText = "Certificate of Live Birth issued by PSA";

    expect(getKkProfilingValidIdMatches(validSchoolIdText).length).toBeGreaterThan(0);
    expect(getSkeapDocumentKeywordMatches(validSchoolIdText, SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE))
      .toHaveLength(0);
    expect(getSkeapDocumentKeywordMatches("Date of Birth: 2000-01-01", SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE))
      .toHaveLength(0);
    expect(getSkeapDocumentKeywordMatches(birthCertificateText, SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE))
      .toContain("certificate of live birth");
  });

  it("matches birth-certificate keywords despite common OCR character errors", () => {
    expect(
      getSkeapDocumentKeywordMatches(
        "CERTIFICAT OF LIVE BIRTH P5A",
        SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
      )
    ).toContain("certificate of live birth");
  });

  it("extracts supported images from the DOCX word/media folder", () => {
    const images = extractDocxEmbeddedImages(createDocxBufferWithImages());

    expect(images).toHaveLength(2);
    expect(images.map(({ name, extension }) => ({ name, extension }))).toEqual([
      { name: "word/media/image1.jpeg", extension: "jpeg" },
      { name: "word/media/image2.png", extension: "png" },
    ]);
    expect(Array.from(images[0].data)).toEqual([1, 2, 3]);
    expect(Array.from(images[1].data)).toEqual([4, 5, 6]);
  });

  it("does not apply KK Profiling valid-ID rules to a SKEAP birth-certificate upload", async () => {
    const result = await validate(createDocxFile("Student Registrar ID No. 12345, La Trinidad, Benguet"));

    expect(result).toMatchObject({
      success: true,
      status: "needs_review",
      isValid: false,
    });
  });

  it("sends unreadable DOCX files for manual review", async () => {
    const result = await validate(new File(["not a DOCX archive"], "broken.docx"));

    expect(result).toMatchObject({
      success: true,
      status: "needs_review",
      isValid: false,
      matchedKeywords: [],
      message: "We couldn't verify this document automatically. If your uploaded file is clear and correct, you can safely proceed anyway.",
    });
  });

  it("recommends uploading the original photo when a DOCX has no extracted text", async () => {
    const result = await validate(createDocxFile(""));

    expect(result).toMatchObject({
      success: true,
      status: "needs_review",
      isValid: false,
      matchedKeywords: [],
      message: "We couldn't verify this document automatically. If your uploaded file is clear and correct, you can safely proceed anyway.",
    });
  });

  it("recommends uploading the original photo when a DOCX has very little text", async () => {
    const result = await validate(createDocxFile("ID"));

    expect(result).toMatchObject({
      success: true,
      status: "needs_review",
      isValid: false,
      matchedKeywords: [],
      message: "We couldn't verify this document automatically. If your uploaded file is clear and correct, you can safely proceed anyway.",
    });
  });
});
