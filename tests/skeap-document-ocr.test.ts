import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SKEAP_UPLOAD_KEY } from "../lib/skeap-upload";
import { validateDocumentOCR } from "../lib/skeap-document-ocr";
import { createWorker } from "tesseract.js";
import { getDocument } from "pdfjs-dist";
import PizZip from "pizzip";

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(),
  PSM: { AUTO: "3", SPARSE_TEXT: "11" },
}));

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument: vi.fn(),
}));

const mockedCreateWorker = vi.mocked(createWorker);
const mockedGetDocument = vi.mocked(getDocument);
const worker = {
  recognize: vi.fn(),
  setParameters: vi.fn().mockResolvedValue(undefined),
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

  it("keeps a successful verification if worker cleanup fails afterward", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "CERTIFICATE OF LIVE BIRTH PSA", confidence: 87 },
    });
    worker.terminate.mockRejectedValueOnce(new Error("worker already stopped"));
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result.status).toBe("verified");
    expect(warn).toHaveBeenCalledWith(
      "Could not cleanly stop the SKEAP OCR worker after validation.",
      expect.any(Error)
    );
  });

  it("shows the reader error when OCR initialization fails", async () => {
    mockedCreateWorker.mockRejectedValueOnce(new Error("Failed to fetch language data"));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const result = await validateDocumentOCR(
      { type: "image/jpeg", name: "birth-certificate.jpg" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      reason: expect.stringContaining("Error: Failed to fetch language data"),
    });
    expect(error).toHaveBeenCalledWith(
      "SKEAP upload could not be read automatically; manual review is available.",
      expect.objectContaining({ currentStep: "reading the document text" })
    );
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

  it("rejects a low-income certificate in the Certificate of Residency slot", async () => {
    worker.recognize.mockResolvedValue({
      data: {
        text: "CERTIFICATE OF LOW INCOME OF PARENTS OR GUARDIAN BARANGAY PICO",
        confidence: 87,
      },
    });

    const result = await validateDocumentOCR(
      { type: "image/webp", name: "CLI.webp" } as File,
      SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY
    );

    expect(result).toMatchObject({
      status: "review",
      reason: expect.stringContaining("not a Certificate of Residency"),
    });
  });

  it("accepts a clearly recognized birth-certificate heading at moderate OCR confidence", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "CERTIFICATE OF LIVE BIRTH PSA", confidence: 42 },
    });

    const result = await validateDocumentOCR(
      { type: "image/jpeg" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "verified",
      extractedText: "CERTIFICATE OF LIVE BIRTH PSA",
      confidence: 42,
    });
  });

  it("keeps a weak birth-certificate signal in manual review at moderate OCR confidence", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "LIVE BIRTH", confidence: 42 },
    });

    const result = await validateDocumentOCR(
      { type: "image/jpeg" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      reason: "The text may be too blurry or unclear to verify.",
    });
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

  it("matches common OCR character errors in a family-income certificate heading", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "CERTIFICAT OF LOW INCOME", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      { type: "image/webp" } as File,
      SKEAP_UPLOAD_KEY.FAMILY_INCOME
    );

    expect(result.status).toBe("verified");
  });

  it("does not accept an unrelated photo ID as a birth certificate", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "REPUBLIC OF THE PHILIPPINES DRIVER'S LICENSE NAME: SAMPLE APPLICANT", confidence: 87 },
    });
    const faceDetector = vi.fn();
    vi.stubGlobal("FaceDetector", faceDetector);

    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result.status).toBe("review");
    expect(faceDetector).not.toHaveBeenCalled();
  });

  it("sends an unrelated ID in a DOCX file for manual review", async () => {
    const result = await validateDocumentOCR(
      createDocxFile("valid-id.docx", "PHILIPPINE NATIONAL ID NAME: SAMPLE APPLICANT ADDRESS: LA TRINIDAD"),
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      extractedText: "PHILIPPINE NATIONAL ID NAME: SAMPLE APPLICANT ADDRESS: LA TRINIDAD",
      confidence: 100,
    });
    expect(mockedCreateWorker).not.toHaveBeenCalled();
  });

  it("sends generic ZIP documents with unrelated ID text for manual review", async () => {
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
      status: "review",
      extractedText: "Applicant Name BUREAU OF INTERNAL REVENUE DIGITAL TIN ID",
      confidence: 100,
    });
  });

  it("OCR-checks scanned DOCX images but does not accept an unrelated ID", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "PHILIPPINE NATIONAL ID NAME: SAMPLE APPLICANT ADDRESS: LA TRINIDAD", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      createDocxFile("scanned-id.docx", "Applicant Name", undefined, undefined, true),
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
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

  it("does not accept a Digital TIN ID as a birth certificate", async () => {
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
    expect(result.status).toBe("review");
  });

  it("does not accept local school ID wording as a birth certificate", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "LA TRINIDAD BENGUET SCHOOL ID NO: 12345", confidence: 87 },
    });
    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result.status).toBe("review");
  });

  it("matches common OCR character errors in birth-certificate headings", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "CERTIFICAT OF LIVE BIRTH P5A", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result.status).toBe("verified");
  });

  it.each([
    SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE,
    SKEAP_UPLOAD_KEY.FAMILY_INCOME,
    SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY,
    SKEAP_UPLOAD_KEY.ENROLLMENT_CERT,
    SKEAP_UPLOAD_KEY.GRADE_REPORT,
  ])("retries %s with sparse-text segmentation when the default pass misses its keywords", async (documentType) => {
    worker.recognize
      .mockResolvedValueOnce({ data: { text: "REPUBLIC OF THE PHILIPPINES", confidence: 80 } })
      .mockResolvedValueOnce({
        data: {
          text: documentType === SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
            ? "CERTIFICATE OF LIVE BIRTH PSA"
            : documentType === SKEAP_UPLOAD_KEY.FAMILY_INCOME
              ? "CERTIFICATE OF LOW INCOME"
              : documentType === SKEAP_UPLOAD_KEY.BARANGAY_RESIDENCY
                ? "BARANGAY CERTIFICATION OF RESIDENCY"
                : documentType === SKEAP_UPLOAD_KEY.ENROLLMENT_CERT
                  ? "CERTIFICATE OF ENROLLMENT"
                  : "FINAL GRADES",
          confidence: 87,
        },
      });

    const result = await validateDocumentOCR(
      { type: "image/png" } as File,
      documentType
    );

    expect(result.status).toBe("verified");
    expect(worker.setParameters).toHaveBeenCalledOnce();
    expect(worker.recognize).toHaveBeenCalledTimes(2);
  });

  it("keeps the initial OCR result when an optional layout retry fails", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "REPUBLIC OF THE PHILIPPINES", confidence: 82 },
    });
    worker.setParameters.mockRejectedValueOnce(new Error("Tesseract parameter update failed"));

    const result = await validateDocumentOCR(
      { type: "image/jpeg" } as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      extractedText: "REPUBLIC OF THE PHILIPPINES",
      reason: "The document text does not clearly match this upload slot.",
    });
    if (result.status === "review") {
      expect(result.reason).not.toContain("document reader ran into a problem");
    }
  });

  it("matches voter certificate terms without regard to letter case", async () => {
    worker.recognize.mockResolvedValue({
      data: {
        text: "VOTER CERTIFICATE",
        confidence: 87,
      },
    });

    const result = await validateDocumentOCR(
      { type: "image/png", name: "voters-certificate.png" } as File,
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
    );

    expect(result.status).toBe("verified");
  });

  it("runs OCR on WebP uploads", async () => {
    worker.recognize.mockResolvedValue({
      data: {
        text: "VOTER CERTIFICATE",
        confidence: 87,
      },
    });
    const imageData = {
      data: new Uint8ClampedArray([255, 0, 0, 255]),
      width: 1,
      height: 1,
    };
    const putImageData = vi.fn();
    const context = {
      drawImage: vi.fn(),
      getImageData: vi.fn().mockReturnValue(imageData),
      putImageData,
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue(context),
      toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["normalized"], { type: "image/png" }))),
    };
    vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(canvas) });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({
      width: 640,
      height: 480,
      close: vi.fn(),
    }));

    const result = await validateDocumentOCR(
      { type: "image/webp", name: "voters-certificate.webp" } as File,
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
    );

    expect(result.status).toBe("verified");
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.objectContaining({ type: "image/png" }));
    expect(context.getImageData).toHaveBeenCalledWith(0, 0, 640, 480);
    expect(putImageData).toHaveBeenCalledWith(imageData, 0, 0);
    expect([...imageData.data]).toEqual([50, 50, 50, 255]);
    expect(worker.recognize).toHaveBeenCalledOnce();
  });

  it("retries the original image when preprocessing hides the voter keywords", async () => {
    const imageData = {
      data: new Uint8ClampedArray([255, 255, 255, 255]),
      width: 640,
      height: 480,
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn().mockReturnValue({
        drawImage: vi.fn(),
        getImageData: vi.fn().mockReturnValue(imageData),
        putImageData: vi.fn(),
      }),
      toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["enhanced"], { type: "image/png" }))),
    };
    vi.stubGlobal("document", { createElement: vi.fn().mockReturnValue(canvas) });
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue({
      width: 640,
      height: 480,
      close: vi.fn(),
    }));
    worker.recognize
      .mockResolvedValueOnce({ data: { text: "CERTIFICATION OF REGISTRATION", confidence: 90 } })
      .mockResolvedValueOnce({ data: { text: "VOTER CERTIFICATE", confidence: 45 } });

    const result = await validateDocumentOCR(
      { type: "image/png", name: "voters-certificate.png" } as File,
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
    );

    expect(result.status).toBe("verified");
    expect(result.extractedText).toBe("VOTER CERTIFICATE");
    expect(worker.recognize).toHaveBeenCalledTimes(2);
  });

  it("matches normalized voter keywords even when OCR includes spaces and punctuation", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "C.O.M.M.I.S.S.I.O.N  on  ELECTIONS", confidence: 10 },
    });

    const result = await validateDocumentOCR(
      { type: "image/png", name: "voters-certificate.png" } as File,
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
    );

    expect(result.status).toBe("verified");
  });

  it("matches the normalized vote keyword even when OCR confidence is low", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "V O T E", confidence: 10 },
    });

    const result = await validateDocumentOCR(
      { type: "image/png", name: "voters-certificate.png" } as File,
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
    );

    expect(result.status).toBe("verified");
  });

  it("does not treat a removed legacy keyword as a voter-certificate match", async () => {
    worker.recognize.mockResolvedValue({
      data: { text: "VIN", confidence: 10 },
    });

    const result = await validateDocumentOCR(
      { type: "image/png", name: "voters-certificate.png" } as File,
      SKEAP_UPLOAD_KEY.VOTER_CERTIFICATE
    );

    expect(result.status).toBe("review");
  });

  it("validates searchable PDFs in non-birth-certificate document slots", async () => {
    const page = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: "FINAL GRADE: 95" }] }),
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
      { type: "application/pdf", name: "grades.pdf", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File,
      SKEAP_UPLOAD_KEY.GRADE_REPORT
    );

    expect(result).toMatchObject({
      status: "verified",
      extractedText: "FINAL GRADE: 95",
      confidence: 100,
    });
    expect(mockedCreateWorker).not.toHaveBeenCalled();
    expect(page.cleanup).toHaveBeenCalledOnce();
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
      reason: expect.stringContaining("Upload the original JPG, PNG, or WebP photo"),
    });
  });

  it("sends an unrelated valid-ID PDF in the birth-certificate slot for manual review", async () => {
    const firstPage = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: "Name: Sample Applicant" }] }),
      getViewport: vi.fn().mockReturnValue({ width: 300, height: 400 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
      cleanup: vi.fn(),
    };
    const secondPage = {
      getTextContent: vi.fn().mockResolvedValue({
        items: [{ str: "BUREAU OF INTERNAL REVENUE DIGITAL TIN ID TAXPAYER IDENTIFICATION NUMBER" }],
      }),
      getViewport: vi.fn().mockReturnValue({ width: 300, height: 400 }),
      render: vi.fn().mockReturnValue({ promise: Promise.resolve() }),
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
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({})),
        toBlob: vi.fn((callback: BlobCallback) => callback(new Blob(["rendered page"], { type: "image/png" }))),
      })),
    });
    worker.recognize.mockResolvedValue({
      data: { text: "UNRELATED ID CONTENT", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      { type: "application/pdf", name: "digital-tin-id.pdf", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      confidence: 87,
    });
    expect(result.extractedText).toContain("BUREAU OF INTERNAL REVENUE DIGITAL TIN ID");
    expect(mockedCreateWorker).toHaveBeenCalledOnce();
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
      data: { text: "Linux Mint and Ubuntu Act. This text discusses identification.", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      { type: "application/pdf", name: "unrelated.pdf", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File,
      SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
    );

    expect(result).toMatchObject({
      status: "review",
      reason: "The document text does not clearly match this upload slot.",
    });
    expect(page.render).toHaveBeenCalledOnce();
    expect(pdfDocument.destroy).toHaveBeenCalledOnce();
  });

  it("OCRs a scanned PDF page when selectable text exists but does not match the upload slot", async () => {
    const page = {
      getTextContent: vi.fn().mockResolvedValue({ items: [{ str: "Applicant: Sample Person" }] }),
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
      data: { text: "CERTIFICATE OF LOW INCOME", confidence: 87 },
    });

    const result = await validateDocumentOCR(
      { type: "application/pdf", name: "income-certificate.pdf", arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)) } as unknown as File,
      SKEAP_UPLOAD_KEY.FAMILY_INCOME
    );

    expect(result).toMatchObject({
      status: "verified",
      extractedText: "Applicant: Sample Person\nCERTIFICATE OF LOW INCOME",
      confidence: 87,
    });
    expect(page.render).toHaveBeenCalledOnce();
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
    const imageData = {
      data: new Uint8ClampedArray([255, 255, 255, 255]),
      width: 20,
      height: 10,
    };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    vi.stubGlobal("document", {
      createElement: vi.fn(() => ({
        width: 0,
        height: 0,
        getContext: vi.fn(() => ({
          drawImage: vi.fn(),
          getImageData: vi.fn(() => imageData),
          putImageData: vi.fn(),
        })),
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
