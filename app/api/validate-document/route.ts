import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { parseOcrWorkerOutput } from "../../../lib/ocrWorker";
import { doesOcrTextMatchName } from "../../../lib/ocrNameVerification";
import { verifyBackIdBirthdate } from "../../../lib/verifyBackIdBirthdate";
import { SKEAP_UPLOAD_KEY } from "@/lib/skeap-upload";
import {
  extractDocxEmbeddedImages,
  extractDocxTextFromBuffer,
  getSkeapDocumentKeywordMatches,
} from "@/lib/skeap-document-keywords";

export const runtime = "nodejs";

type DocumentType = "front_id" | "back_id" | "certificate";
const SKEAP_BIRTH_CERTIFICATE_DOCUMENT_TYPE = SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE;
const MAX_SKEAP_VALIDATION_FILE_SIZE = 15 * 1024 * 1024;
const SKEAP_MANUAL_REVIEW_MESSAGE = "We couldn't verify this document automatically. If your uploaded file is clear and correct, you can safely proceed anyway.";
const SKEAP_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "jfif", "png", "webp"]);
const SKEAP_IMAGE_MIME_TYPES = new Set(["", "application/octet-stream", "image/jpeg", "image/jpg", "image/png", "image/webp", "image/jfif"]);
const MAX_DOCX_EMBEDDED_IMAGES_TO_SCAN = 10;

type ValidationResponse = {
  success: boolean;
  status: "success" | "error" | "needs_review";
  badgeText: string;
  message: string;
  isValid: boolean;
  matchedKeywords: string[];
  text: string;
  nameMatched?: boolean;
  error?: string;
};

const execFileAsync = promisify(execFile);

async function runSkeapImageOcr(imageBuffer: Uint8Array, imageExtension: string) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skeap-ocr-"));
  const safeExtension = imageExtension.replace(/[^a-z0-9]/gi, "") || "img";
  const tempPath = path.join(tempDir, `upload-${Date.now()}-${Math.random().toString(16).slice(2)}.${safeExtension}`);

  try {
    fs.writeFileSync(tempPath, imageBuffer);
    const scriptPath = path.join(process.cwd(), "scripts", "ocr-worker.cjs");
    let stdout = "";
    try {
      const execResult = await execFileAsync(process.execPath, [scriptPath, tempPath, "skeap_valid_id"], {
        cwd: process.cwd(),
        timeout: 120000,
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = execResult.stdout || "";
    } catch (error: unknown) {
      const execError = error as { stdout?: string };
      stdout = execError.stdout || "";
      if (!stdout) throw error;
    }

    const result = parseOcrWorkerOutput(stdout);
    if (!result.success) throw new Error(result.error || "The image could not be read.");
    return result.text;
  } finally {
    try {
      fs.unlinkSync(tempPath);
    } catch {
      // Ignore cleanup failures.
    }
    try {
      fs.rmdirSync(tempDir);
    } catch {
      // Ignore cleanup failures.
    }
  }
}

function getFriendlyValidationResponse(documentType: DocumentType, result: { success: boolean; isValid: boolean; matchedKeywords: string[]; text: string; error?: string; }): ValidationResponse {
  const trimmedText = String(result.text || "").trim();
  const isUnreadable = !result.success || trimmedText.length < 20;

  if (result.isValid) {
    return {
      success: true,
      status: "success",
      badgeText: "Verified",
      message: "Document uploaded successfully.",
      isValid: true,
      matchedKeywords: result.matchedKeywords,
      text: result.text,
      error: result.error,
    };
  }

  if (isUnreadable) {
    return {
      success: false,
      status: "error",
      badgeText: "Unreadable Image",
      message: "The text in this photo is too blurry or dark. Please upload a clearer image.",
      isValid: false,
      matchedKeywords: result.matchedKeywords,
      text: result.text,
      error: result.error,
    };
  }

  if (documentType === "front_id" || documentType === "back_id") {
    return {
      success: false,
      status: "error",
      badgeText: "ID Not Found",
      message: "We couldn't verify this ID. Please upload the correct photo.",
      isValid: false,
      matchedKeywords: result.matchedKeywords,
      text: result.text,
      error: result.error,
    };
  }

  return {
    success: false,
    status: "error",
    badgeText: "Residency Details Missing",
    message: "Please upload your Certificate of Residency that states you have lived in Barangay Pico for at least 8 months.",
    isValid: false,
    matchedKeywords: result.matchedKeywords,
    text: result.text,
    error: result.error,
  };
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const documentType = formData.get("documentType");
    const firstName = String(formData.get("firstName") ?? "").trim();
    const lastName = String(formData.get("lastName") ?? "").trim();
    const profileBirthDate = String(formData.get("profileBirthDate") ?? formData.get("birthDate") ?? "").trim();

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          badgeText: "Unreadable Image",
          message: "The text in this photo is too blurry or dark. Please upload a clearer image.",
          isValid: false,
          matchedKeywords: [],
          text: "",
        },
        { status: 400 }
      );
    }

    const isSkeapBirthCertificate = documentType === SKEAP_BIRTH_CERTIFICATE_DOCUMENT_TYPE;
    if (!isSkeapBirthCertificate && documentType !== "front_id" && documentType !== "back_id" && documentType !== "certificate") {
      return NextResponse.json(
        {
          success: false,
          status: "error",
          badgeText: "Unreadable Image",
          message: "The text in this photo is too blurry or dark. Please upload a clearer image.",
          isValid: false,
          matchedKeywords: [],
          text: "",
        },
        { status: 400 }
      );
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (isSkeapBirthCertificate) {
      const isSkeapImage = SKEAP_IMAGE_EXTENSIONS.has(extension || "") &&
        (SKEAP_IMAGE_MIME_TYPES.has(file.type.toLowerCase()) || !file.type);
      if (extension !== "docx" && !isSkeapImage) {
        return NextResponse.json(
          {
            success: true,
            status: "needs_review",
            badgeText: "Needs Review",
            message: "Only DOCX text can be checked automatically. This document needs manual verification.",
            isValid: false,
            matchedKeywords: [],
            text: "",
          },
          { status: 200 }
        );
      }
      if (file.size === 0 || file.size > MAX_SKEAP_VALIDATION_FILE_SIZE) {
        return NextResponse.json(
          {
            success: false,
            status: "error",
            badgeText: "Unable to Check",
            message: file.size === 0
              ? "The selected file is empty."
              : "File size must not exceed 15MB.",
            isValid: false,
            matchedKeywords: [],
            text: "",
          },
          { status: 400 }
        );
      }

      try {
        let extractedText: string;
        if (extension === "docx") {
          const docxBuffer = new Uint8Array(await file.arrayBuffer());
          extractedText = extractDocxTextFromBuffer(docxBuffer);
          let matchedKeywords = getSkeapDocumentKeywordMatches(
            extractedText,
            SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
          );

          if (matchedKeywords.length === 0) {
            const embeddedImages = extractDocxEmbeddedImages(docxBuffer);
            const embeddedImageTexts: string[] = [];
            for (const image of embeddedImages.slice(0, MAX_DOCX_EMBEDDED_IMAGES_TO_SCAN)) {
              try {
                const imageText = await runSkeapImageOcr(image.data, image.extension);
                if (imageText.trim()) embeddedImageTexts.push(imageText.trim());
                matchedKeywords = getSkeapDocumentKeywordMatches(
                  [...embeddedImageTexts].join("\n"),
                  SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
                );
                if (matchedKeywords.length > 0) break;
              } catch (error) {
                console.warn("Could not OCR an embedded image in SKEAP DOCX upload.", {
                  imageName: image.name,
                  error,
                });
              }
            }
            extractedText = [extractedText, ...embeddedImageTexts].filter(Boolean).join("\n");
          }

          if (matchedKeywords.length > 0) {
            return NextResponse.json({
              success: true,
              status: "verified",
              badgeText: "Verified",
              message: "Document verified based on matching birth certificate or valid ID text.",
              isValid: true,
              matchedKeywords,
              text: extractedText,
            });
          }
        } else {
          extractedText = await runSkeapImageOcr(
            new Uint8Array(await file.arrayBuffer()),
            extension || "img"
          );
        }
        const matchedKeywords = getSkeapDocumentKeywordMatches(
          extractedText,
          SKEAP_UPLOAD_KEY.BIRTH_CERTIFICATE
        );
        if (matchedKeywords.length > 0) {
          return NextResponse.json({
            success: true,
            status: "verified",
            badgeText: "Verified",
            message: "Document verified based on matching birth certificate or valid ID text.",
            isValid: true,
            matchedKeywords,
            text: extractedText,
          });
        }

        return NextResponse.json({
          success: true,
          status: "needs_review",
          badgeText: "Needs Review",
          message: SKEAP_MANUAL_REVIEW_MESSAGE,
          isValid: false,
          matchedKeywords: [],
          text: extractedText,
        });
      } catch (error) {
        console.error("Failed to validate SKEAP birth certificate or valid ID document.", error);
        return NextResponse.json({
          success: true,
          status: "needs_review",
          badgeText: "Needs Review",
          message: SKEAP_MANUAL_REVIEW_MESSAGE,
          isValid: false,
          matchedKeywords: [],
          text: "",
        });
      }
    }

    if (extension === "doc" || extension === "docx") {
      return NextResponse.json({
        success: true,
        status: "needs_review",
        badgeText: "Needs Review",
        message: "Word document accepted. It will need manual verification.",
        isValid: false,
        matchedKeywords: [],
        text: "",
      });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ocr-"));
    const tempPath = path.join(tempDir, `upload-${Date.now()}-${Math.random().toString(16).slice(2)}.${file.name.split(".").pop() || "bin"}`);

    try {
      fs.writeFileSync(tempPath, fileBuffer);
      const scriptPath = path.join(process.cwd(), "scripts", "ocr-worker.cjs");
      let stdout = "";

      try {
        const execResult = await execFileAsync(process.execPath, [scriptPath, tempPath, documentType], {
          cwd: process.cwd(),
          timeout: 120000,
          maxBuffer: 10 * 1024 * 1024,
        });
        stdout = execResult.stdout || "";
      } catch (error: unknown) {
        const execError = error as { stdout?: string; stderr?: string; message?: string };
        stdout = execError.stdout || "";
        if (!stdout) {
          throw error;
        }
      }

      const result = parseOcrWorkerOutput(stdout);
      const response = getFriendlyValidationResponse(documentType, result);

      if (documentType === "front_id" && result.documentSide === "back") {
        return NextResponse.json(
          {
            ...response,
            success: false,
            status: "error",
            badgeText: "Wrong ID Side",
            message: "This appears to be the back of the ID. Please upload the front of your valid ID.",
            isValid: false,
          },
          { status: 400 },
        );
      }

      if (documentType === "front_id" && firstName && lastName && response.success && response.isValid) {
        const nameMatched = doesOcrTextMatchName(firstName, lastName, result.text, 0.8);
        if (!nameMatched) {
          return NextResponse.json(
              {
                ...response,
                success: false,
                status: "error",
                badgeText: "Name Mismatch",
                message: "Name mismatch — the name on this ID does not match the profile.",
                isValid: false,
                nameMatched: false,
              },
              { status: 400 }
            );
        }

        return NextResponse.json({ ...response, nameMatched: true });
      }

      // For Certificates (residency), verify the name if the client provided profile names
      if (documentType === "certificate" && firstName && lastName && response.success && response.isValid) {
        const nameMatched = doesOcrTextMatchName(firstName, lastName, result.text, 0.8);
        if (!nameMatched) {
          return NextResponse.json(
            {
              ...response,
              success: false,
              status: "error",
              badgeText: "Name Mismatch",
              message: "Name mismatch — the name on this document does not match the profile.",
              isValid: false,
              nameMatched: false,
              parsedDates: [],
            },
            { status: 400 }
          );
        }

        return NextResponse.json({ ...response, nameMatched: true });
      }

      // Back-side birthdate verification: if client provided a profile birthdate,
      // attempt to parse dates from the OCR text and verify a match.
      if (documentType === "back_id" && profileBirthDate && response.success && response.isValid) {
        const birthCheck = verifyBackIdBirthdate(result.text, profileBirthDate);
        if (!birthCheck.isValid) {
          return NextResponse.json(
            {
              ...response,
              success: false,
              status: "error",
              badgeText: "Birthdate Mismatch",
              message: birthCheck.message,
              isValid: false,
              error: undefined,
              parsedDates: birthCheck.parsedDates ?? [],
            },
            { status: 400 }
          );
        }

        return NextResponse.json({ ...response, birthdateMatched: true, parsedDates: birthCheck.parsedDates });
      }

      return NextResponse.json({ ...response, nameMatched: documentType === "front_id" ? Boolean(firstName && lastName) : undefined });
    } finally {
      try {
        fs.unlinkSync(tempPath);
      } catch {
        // Ignore cleanup failures.
      }

      try {
        fs.rmdirSync(tempDir);
      } catch {
        // Ignore cleanup failures.
      }
    }
  } catch (error: unknown) {
    return NextResponse.json(
      {
        success: false,
        status: "error",
        badgeText: "Unreadable Image",
        message: "The text in this photo is too blurry or dark. Please upload a clearer image.",
        isValid: false,
        matchedKeywords: [],
        text: "",
        error: String(error instanceof Error ? error.message : error),
      },
      { status: 500 }
    );
  }
}
