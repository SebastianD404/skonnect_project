import { createAdminClient } from "@/lib/supabase/admin";

const PRIVATE_SUBMISSION_BUCKET = "grantee-submissions";
const LEGACY_SUBMISSION_BUCKET = "public image";
const STORAGE_URL_PREFIX = "/storage/v1/object/";

export type SubmissionStorageObject = {
  bucket: string;
  path: string;
};

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
  const pathPrefix = `${PRIVATE_SUBMISSION_BUCKET}/${authId}/`;
  if (!filePathOrUrl.startsWith(pathPrefix) || filePathOrUrl.includes("..") || filePathOrUrl.includes("\\")) {
    throw new Error("Submission files must be migrated to private storage.");
  }
  return { bucket: PRIVATE_SUBMISSION_BUCKET, path: filePathOrUrl };
}

export async function createSignedSubmissionFileUrl(filePathOrUrl: string, authId: string) {
  const object = getSubmissionStorageObject(filePathOrUrl, authId);
  const { data, error } = await createAdminClient()
    .storage.from(object.bucket)
    .createSignedUrl(object.path, 5 * 60);
  if (error) throw error;
  if (!data.signedUrl) {
    throw new Error("Could not create a secure file link.");
  }
  return data.signedUrl;
}
