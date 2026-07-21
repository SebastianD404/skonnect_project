type DocumentType = "front_id" | "back_id" | "certificate";

type OcrValidationOptions = {
  firstName?: string;
  lastName?: string;
  middleInitial?: string;
  profileBirthDate?: string;
};

type ScanResult = {
  success: boolean;
  status: "success" | "error";
  badgeText: string;
  message: string;
  isValid: boolean;
  matchedKeywords: string[];
  text: string;
  error?: string;
  nameMatched?: boolean;
  parsedDates?: string[];
  birthdateMatched?: boolean;
};

export async function scanDocument(file: File, documentType: DocumentType, options?: OcrValidationOptions): Promise<ScanResult> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  if (options?.firstName) {
    formData.append("firstName", options.firstName);
  }
  if (options?.lastName) {
    formData.append("lastName", options.lastName);
  }
  if (options?.middleInitial) {
    formData.append("middleInitial", options.middleInitial);
  }
  if (options?.profileBirthDate) {
    formData.append("profileBirthDate", options.profileBirthDate);
  }

  const response = await fetch("/api/validate-document", {
    method: "POST",
    body: formData,
  });

  // Prefer returning the server JSON payload even on HTTP error responses so
  // the client can display the server-provided badgeText/message (e.g.
  // "Name Mismatch") instead of a generic thrown error.
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    if (body) {
      return body as unknown as ScanResult;
    }
    throw new Error("Document validation failed.");
  }

  return body as unknown as ScanResult;
}
