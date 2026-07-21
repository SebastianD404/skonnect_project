import { execFile } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { promisify } from "util";
import { NextResponse } from "next/server";
import { parseOcrWorkerOutput } from "../../../lib/ocrWorker";
import { doesOcrTextMatchName } from "../../../lib/ocrNameVerification";
import { verifyBackIdBirthdate } from "../../../lib/verifyBackIdBirthdate";

export const runtime = "nodejs";

type DocumentType = "front_id" | "back_id" | "certificate";

type ValidationResponse = {
  success: boolean;
  status: "success" | "error";
  badgeText: string;
  message: string;
  isValid: boolean;
  matchedKeywords: string[];
  text: string;
  nameMatched?: boolean;
  error?: string;
};

const execFileAsync = promisify(execFile);

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

    if (documentType !== "front_id" && documentType !== "back_id" && documentType !== "certificate") {
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
