import { createAdminClient } from "@/lib/supabase/admin";

const PRIVATE_SUBMISSION_BUCKET = "grantee-submissions";
export const PRIVATE_SUBMISSION_DEMO_BUCKET = "private-documents";
const LEGACY_SUBMISSION_BUCKET = "public image";
const STORAGE_URL_PREFIX = "/storage/v1/object/";

export type SubmissionStorageObject = {
  bucket: string;
  path: string;
};

function getConfiguredSupabaseOrigin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  return supabaseUrl ? new URL(supabaseUrl).origin : null;
}

function parseSupabaseStorageUrl(filePathOrUrl: string) {
  let url: URL;
  try {
    url = new URL(filePathOrUrl);
  } catch {
    if (!filePathOrUrl.startsWith(STORAGE_URL_PREFIX)) return null;
    const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!supabaseUrl) throw new Error("Supabase URL is not configured.");
    url = new URL(filePathOrUrl, supabaseUrl);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;

  const supabaseOrigin = getConfiguredSupabaseOrigin();
  if (!supabaseOrigin || url.origin !== supabaseOrigin) return null;
  if (!url.pathname.startsWith(STORAGE_URL_PREFIX)) {
    throw new Error("The stored submission URL is not a Supabase Storage URL.");
  }

  const [accessType, encodedBucket, ...encodedPathParts] = url.pathname
    .slice(STORAGE_URL_PREFIX.length)
    .split("/");
  if (accessType !== "public" && accessType !== "sign") {
    throw new Error("The stored submission URL is not a supported Storage URL.");
  }

  let bucket: string;
  let pathParts: string[];
  try {
    bucket = decodeURIComponent(encodedBucket ?? "");
    pathParts = encodedPathParts.map((part) => decodeURIComponent(part));
  } catch {
    throw new Error("The stored submission URL contains an invalid storage path.");
  }
  if (
    !bucket ||
    pathParts.length === 0 ||
    pathParts.some((part) => !part || part === "." || part === ".." || /[\\/]/.test(part))
  ) {
    throw new Error("The stored submission URL contains an invalid storage path.");
  }
  return { bucket, path: pathParts.join("/") };
}

function isOwnedSubmissionPath(path: string, authId: string, bucket: string) {
  const isOwnerScoped =
    bucket === PRIVATE_SUBMISSION_DEMO_BUCKET
      ? path.startsWith(`${PRIVATE_SUBMISSION_BUCKET}/${authId}/`)
      : path.startsWith(`${PRIVATE_SUBMISSION_BUCKET}/${authId}/`) ||
        path.startsWith(`${authId}/`);
  return isOwnerScoped &&
    path.split("/").every((part) => part && part !== "." && part !== "..") &&
    !path.includes("\\");
}

function parseLegacyPublicSubmissionObject(filePathOrUrl: string, authId: string) {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("Supabase URL is not configured.");
  }

  let url: URL;
  try {
    url = new URL(filePathOrUrl);
  } catch {
    throw new Error("The legacy submission URL is invalid.");
  }
  if (url.origin !== new URL(supabaseUrl).origin || !url.pathname.startsWith(STORAGE_URL_PREFIX)) {
    throw new Error("The legacy submission file is not stored in the configured Supabase project.");
  }

  const [accessType, encodedBucket, ...encodedPathParts] = url.pathname
    .slice(STORAGE_URL_PREFIX.length)
    .split("/");
  if (accessType !== "public" || decodeURIComponent(encodedBucket ?? "") !== LEGACY_SUBMISSION_BUCKET) {
    throw new Error("The stored submission URL is not a recognized legacy submission URL.");
  }

  let pathParts: string[];
  try {
    pathParts = encodedPathParts.map((part) => decodeURIComponent(part));
  } catch {
    throw new Error("The legacy submission path is invalid.");
  }
  if (pathParts.some((part) => !part || part === "." || part === ".." || /[\\/]/.test(part))) {
    throw new Error("The legacy submission path is invalid.");
  }
  const path = pathParts.join("/");
  if (pathParts[0] !== "grantee-submissions" || pathParts[1] !== authId || pathParts.length < 3) {
    throw new Error("The legacy submission path is invalid.");
  }

  return { bucket: LEGACY_SUBMISSION_BUCKET, path };
}

export function getLegacySubmissionStorageObject(filePathOrUrl: string, authId: string) {
  return parseLegacyPublicSubmissionObject(filePathOrUrl, authId);
}

export function getSubmissionStorageObject(filePathOrUrl: string, authId: string): SubmissionStorageObject {
  const parsedUrlObject = parseSupabaseStorageUrl(filePathOrUrl);
  const privateDocumentPrefix = `${PRIVATE_SUBMISSION_DEMO_BUCKET}/`;
  const isPrivateDocumentReference = filePathOrUrl.startsWith(privateDocumentPrefix);
  const bucket = parsedUrlObject?.bucket ??
    (isPrivateDocumentReference ? PRIVATE_SUBMISSION_DEMO_BUCKET : PRIVATE_SUBMISSION_BUCKET);
  const path = parsedUrlObject?.path ??
    (isPrivateDocumentReference
      ? filePathOrUrl.slice(privateDocumentPrefix.length)
      : filePathOrUrl);
  if (
    (bucket !== PRIVATE_SUBMISSION_BUCKET &&
      bucket !== PRIVATE_SUBMISSION_DEMO_BUCKET &&
      bucket !== LEGACY_SUBMISSION_BUCKET) ||
    !isOwnedSubmissionPath(path, authId, bucket)
  ) {
    throw new Error("Submission files must be owner-scoped in a recognized storage bucket.");
  }
  return { bucket, path };
}

export async function createSignedSubmissionFileUrl(filePathOrUrl: string, authId: string) {
  let externalUrl: URL | null = null;
  try {
    externalUrl = new URL(filePathOrUrl);
  } catch {
    // Relative Storage paths are expected for newly uploaded submissions.
  }
  if (
    externalUrl &&
    (externalUrl.protocol === "http:" || externalUrl.protocol === "https:") &&
    externalUrl.origin !== getConfiguredSupabaseOrigin()
  ) {
    return filePathOrUrl;
  }

  const object = getSubmissionStorageObject(filePathOrUrl, authId);
  const { data, error } = await createAdminClient()
    .storage.from(object.bucket)
    .createSignedUrl(object.path, 3600, { download: false });
  if (error) throw error;
  if (!data.signedUrl) {
    throw new Error("Could not create a secure file link.");
  }
  return data.signedUrl;
}
