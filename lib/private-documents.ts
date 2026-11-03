import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export const PRIVATE_DOCUMENT_BUCKET = "private-documents";

export type PrivateDocumentCategory = "kk-verification" | "skeap-applications";

export function getPrivateDocumentPath(fileUrl: string) {
  const prefix = "/api/private-documents/";
  if (!fileUrl.startsWith(prefix)) return null;

  const segments = fileUrl.slice(prefix.length).split("/");
  try {
    const path = segments.map((segment) => decodeURIComponent(segment));
    if (
      path.length < 3 ||
      !["kk-verification", "skeap-applications"].includes(path[0]) ||
      path.some((part) => !part || part === "." || part === ".." || /[\\/]/.test(part))
    ) {
      return null;
    }
    return path.join("/");
  } catch {
    return null;
  }
}

export async function downloadPrivateDocument(path: string) {
  const { data, error } = await createAdminClient()
    .storage.from(PRIVATE_DOCUMENT_BUCKET)
    .download(path);
  if (error) throw error;
  if (!data) throw new Error("Private document was not found.");
  return data;
}

export async function uploadPrivateDocument(
  authUserId: string,
  file: File,
  category: PrivateDocumentCategory,
  label?: string,
) {
  if (!authUserId || /[\\/]/.test(authUserId)) {
    throw new Error("Invalid document owner.");
  }

  const safeFileName = file.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 200) || "upload";
  const safeLabel = label ? `${label}-` : "";
  const path = `${category}/${authUserId}/${Date.now()}-${randomUUID()}-${safeLabel}${safeFileName}`;
  const { error } = await createAdminClient()
    .storage.from(PRIVATE_DOCUMENT_BUCKET)
    .upload(path, await file.arrayBuffer(), {
      contentType: file.type || "application/octet-stream",
      cacheControl: "0",
      upsert: false,
    });

  if (error) throw error;

  return {
    path,
    url: `/api/private-documents/${path.split("/").map(encodeURIComponent).join("/")}`,
  };
}

export async function removePrivateDocument(path: string) {
  const { error } = await createAdminClient()
    .storage.from(PRIVATE_DOCUMENT_BUCKET)
    .remove([path]);
  if (error) throw error;
}
