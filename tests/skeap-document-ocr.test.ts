import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SKEAP_UPLOAD_KEY } from "../lib/skeap-upload";
import { validateDocumentOCR } from "../lib/skeap-document-ocr";
import { createWorker } from "tesseract.js";
import { getDocument } from "pdfjs-dist";
import PizZip from "pizzip";

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(),
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

const mockedCreateWorker = vi.mocked(createWorker);
const mockedGetDocument = vi.mocked(getDocument);
const worker = {
  recognize: vi.fn(),
  terminate: vi.fn(),
};

function createDocxFile(
  name: string,
  text: string,
  headerText?: string,
  type = "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  includeEmbeddedImage = false
): File {
  const zip = new PizZip();
  zip.file("word/document.xml", `<w:document><w:t>${text}</w:t></w:document>`);
  if (headerText) {
    zip.file("word/header1.xml", `<w:hdr><w:p><w:r><w:t>${headerText}</w:t></w:r></w:p></w:hdr>`);
  }
  if (includeEmbeddedImage) {
    zip.file("word/media/image1.png", new Uint8Array([1, 2, 3]));
  }
  const data = zip.generate({ type: "uint8array" });
  const buffer = data.slice().buffer as ArrayBuffer;

  return {
    type,
    name,
    arrayBuffer: vi.fn().mockResolvedValue(buffer),
  } as unknown as File;
}

describe("validateDocumentOCR", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedCreateWorker.mockResolvedValue(worker as never);
    worker.terminate.mockResolvedValue(undefined);
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:document");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("verifies a readable image with matching document text", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "CERTIFICATE OF LIVE BIRTH PSA", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toEqual({
      status: "verified",
      extractedText: "CERTIFICATE OF LIVE BIRTH PSA",
      confidence: 87,
    });
    expect(worker.terminate).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:document");
  });

  it("requests manual review when image confidence is too low", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "BARANGAY CERTIFICATION", confidence: 42 },
    });

    const result = await validateDocumentOCR(
      { type: "image/jpeg" } as File,
      SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY
    );

    expect(result.status).toBe("review");
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("matches the singular grade keyword", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "FINAL GRADE: 95", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      SKEAP_UPLOAD_KEY.GRADE_REPORT
    );

    expect(result.status).toBe("verified");
  });

  it("verifies matching valid ID text without requiring face detection", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "REPUBLIC OF THE PHILIPPINES DRIVER'S LICENSE NAME: SAMPLE APPLICANT", confidence: 87 },
    });
    const faceDetector = vi.fn();
    vi.stubGlobal("FaceDetector", faceDetector);

    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result.status).toBe("verified");
    expect(faceDetector).not.toHaveBeenCalled();
  });

  it("verifies a DOCX file when its extracted text matches the upload slot", async () => {
    const result = await validateDocumentOCR(
      createDocxFile("valid-id.docx", "PHILIPPINE NATIONAL ID NAME: SAMPLE APPLICANT ADDRESS: LA TRINIDAD"),
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "verified",
      extractedText: "PHILIPPINE NATIONAL ID NAME: SAMPLE APPLICANT ADDRESS: LA TRINIDAD",
      confidence: 100,
    });
    expect(mockedCreateWorker).not.toHaveBeenCalled();
  });

  it("checks DOCX files with generic ZIP MIME types and reads document headers", async () => {
    const result = await validateDocumentOCR(
      createDocxFile(
        "valid-id.docx",
        "Applicant Name",
        "BUREAU OF INTERNAL REVENUE DIGITAL TIN ID",
        "application/zip"
      ),
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "verified",
      extractedText: "Applicant Name BUREAU OF INTERNAL REVENUE DIGITAL TIN ID",
      confidence: 100,
    });
  });

  it("OCR-checks scanned images embedded in DOCX files when body text does not match", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "PHILIPPINE NATIONAL ID NAME: SAMPLE APPLICANT ADDRESS: LA TRINIDAD", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      createDocxFile("scanned-id.docx", "Applicant Name", undefined, undefined, true),
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "verified",
      extractedText: "Applicant Name\nPHILIPPINE NATIONAL ID NAME: SAMPLE APPLICANT ADDRESS: LA TRINIDAD",
      confidence: 87,
    });
    expect(worker.recognize).toHaveBeenCalledOnce();
  });

  it("sends unrelated DOCX documents to manual review", async () => {
    const result = await validateDocumentOCR(
      createDocxFile("unrelated.docx", "Linux Mint and Ubuntu Act"),
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      reason: "The document text does not clearly match this upload slot.",
    });
  });

  it("sends legacy DOC files to manual review without attempting DOCX or image parsing", async () => {
    const result = await validateDocumentOCR(
      { type: "application/msword", name: "legacy-id.doc" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      extractedText: "",
      confidence: 0,
    });
    expect(mockedCreateWorker).not.toHaveBeenCalled();
  });

  it("verifies a Digital TIN ID from matching readable text", async () => {
    worker.recognize.mockResolvedValue({
      data: {
        text: "BUREAU OF INTERNAL REVENUE DIGITAL TIN ID TAXPAYER IDENTIFICATION NUMBER NAME: SAMPLE APPLICANT",
        confidence: 87,
      },
    });
    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );
    expect(result.status).toBe("verified");
    expect(result.status).toBe("verified");
  });

  it("matches local school ID wording without regard to letter case", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "LA TRINIDAD BENGUET SCHOOL ID NO: 12345", confidence: 87 },
    });
    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result.status).toBe("verified");
  });

  it("matches voter certificate terms without regard to letter case", async () => {
    worker.recognize.mockResolvedValue({
      data: {
        text: "COMMISSION ON ELECTIONS - CERTIFICATION OF REGISTRATION, PRECINCT 123",
        confidence: 87,
      },
    });

    const result = await validateDocumentOCR(
      { type: "image/png", name: "voters-certificate.png" } as File,
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
    );

    expect(result.status).toBe("verified");
  });

  it("requests manual review for PDFs in other document slots", async () => {
    const result = await validateDocumentOCR(
      { type: "application/pdf", name: "grades.pdf", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File,
      SKEAP_UPLOAD_KEY.GRADE_REPORT
    );

    expect(result.status).toBe("review");
    expect(mockedCreateWorker).not.toHaveBeenCalled();
    expect(mockedGetDocument).not.toHaveBeenCalled();
  });

  it("recommends uploading the original photo when a PDF has no readable text", async () => {
    const page = {
      getTextContent: vi.fn().mockResolvedValue({ items: [] }),
      cleanup: vi.fn(),
    };
    const pdfDocument = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(page),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    mockedGetDocument.mockReturnValue({
      promise: Promise.resolve(pdfDocument),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const result = await validateDocumentOCR(
      { type: "application/pdf", name: "scan.pdf", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      reason: expect.stringContaining("Upload the original JPG or PNG photo"),
    });
  });

  it("verifies a text-based Valid ID PDF across its pages", async () => {
    const firstPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: "Name: Sample Applicant" }] }),
      cleanup: vi.fn(),
    };
    const secondPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: "BUREAU OF INTERNAL REVENUE DIGITAL TIN ID TAXPAYER IDENTIFICATION NUMBER" }],
      }),
      cleanup: vi.fn(),
    };
    const pdfDocument = {
      numPages: 2,
      getPage: vi.fn()
        .mockResolvedValueOnce(firstPage)
        .mockResolvedValueOnce(secondPage),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    mockedGetDocument.mockReturnValue({
      promise: Promise.resolve(pdfDocument),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const result = await validateDocumentOCR(
      { type: "application/pdf", name: "digital-tin-id.pdf", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "verified",
      extractedText: "Name: Sample Applicant\nBUREAU OF INTERNAL REVENUE DIGITAL TIN ID TAXPAYER IDENTIFICATION NUMBER",
      confidence: 100,
    });
    expect(mockedCreateWorker).not.toHaveBeenCalled();
    expect(firstPage.cleanup).toHaveBeenCalledOnce();
    expect(secondPage.cleanup).toHaveBeenCalledOnce();
    expect(pdfDocument.destroy).toHaveBeenCalledOnce();
  });

  it("sends unrelated PDFs to manual review instead of verifying generic ID-related words", async () => {
    const page = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [{
          str: "Linux Mint and Ubuntu Act. This text discusses identification, Benguet, and a national statistics report.",
        }],
      }),
      cleanup: vi.fn(),
    };
    const pdfDocument = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(page),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    mockedGetDocument.mockReturnValue({
      promise: Promise.resolve(pdfDocument),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);

    const result = await validateDocumentOCR(
      { type: "application/pdf", name: "unrelated.pdf", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      reason: "The document text does not clearly match this upload slot.",
    });
    expect(pdfDocument.destroy).toHaveBeenCalledOnce();
  });

  it("runs OCR on scanned Birth Certificate PDF pages", async () => {
    const page = {
      getTextContent: vi.fn().mockResolvedValue({ items: [] }),
      getViewport: vi.fn().mockReturnValue({ width: 300, height: 400 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      cleanup: vi.fn(),
    };
    const pdfDocument = {
      numPages: 1,
      getPage: vi.fn().mockResolvedValue(page),
      destroy: vi.fn().mockResolvedValue(undefined),
    };
    mockedGetDocument.mockReturnValue({
      promise: Promise.resolve(pdfDocument),
      destroy: vi.fn().mockResolvedValue(undefined),
    } as never);
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({})),
        toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["rendered page"], { type: "image/png" }))),
      })),
    });
    worker.recognize.mockResolvedValue({
      data: { text: "CERTIFICATE OF LIVE BIRTH PSA", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      { type: "application/pdf", name: "scanned-birth-certificate.pdf", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "verified",
      extractedText: "CERTIFICATE OF LIVE BIRTH PSA",
      confidence: 87,
    });
    expect(mockedCreateWorker).toHaveBeenCalledOnce();
    expect(worker.recognize).toHaveBeenCalledWith("blob:document");
    expect(page.render).toHaveBeenCalledOnce();
    expect(page.cleanup).toHaveBeenCalledOnce();
    expect(pdfDocument.destroy).toHaveBeenCalledOnce();
  });

  it("accepts JFIF files with an unexpected MIME type and retries the original when normalized text is empty", async () => {
    const bitmap = { width: 20, height: 10, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({ drawImage: vi.fn() })),
        toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["image"], { type: "image/png" }))),
      })),
    });
    worker.recognize
      .mockResolvedValueOnce({ data: { text: "", confidence: 0 } })
      .mockResolvedValueOnce({
        data: { text: "CERTIFICATE OF LIVE BIRTH PSA", confidence: 87 },
      });

    const result = await validateDocumentOCR(
      { type: "application/octet-stream", name: "birth-record.jfif" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result.status).toBe("verified");
    expect(worker.recognize).toHaveBeenCalledTimes(2);
    expect(bitmap.close).toHaveBeenCalledOnce();
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(2);
  });

  it("returns manual review when an image produces no readable text", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "  ", confidence: 0 },
    });

    const result = await validateDocumentOCR(
      { type: "", name: "id.jfif" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      reason: "We couldn't read the text in this document. Please check the preview or proceed for review.",
    });
  });

  it("skips OCR for non-text upload slots", async () => {
    const result = await validateDocumentOCR(
      { type: "image/jpeg" } as File,
      SKEAP_UPLOAD_KEY.PHOTO
    );

    expect(result).toEqual({ status: "skipped", extractedText: "", confidence: 0 });
    expect(mockedCreateWorker).not.toHaveBeenCalled();
  });
});
