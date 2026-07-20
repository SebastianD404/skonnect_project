type DocumentType = "front_id" | "back_id" | "certificate";

export async function scanDocument(file: File, documentType: DocumentType) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("documentType", documentType);

  const response = await fetch("/api/validate-document", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error || "Document validation failed.");
  }

  return response.json();
}
