import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const SYSTEM_BACKUP_BUCKET = "system-backups";

function getStorage() {
  return createAdminClient().storage;
}

async function ensurePrivateBackupBucket() {
  const storage = getStorage();
  const { data: buckets, error: listError } = await storage.listBuckets();
  if (listError) throw listError;

  const bucket = buckets.find((item) => item.name === SYSTEM_BACKUP_BUCKET);
  if (!bucket) {
    const { error } = await storage.createBucket(SYSTEM_BACKUP_BUCKET, {
      public: false,
      fileSizeLimit: "100MB",
      allowedMimeTypes: ["application/json"],
    });
    if (error) throw error;
    return storage;
  }

  if (bucket.public) {
    const { error } = await storage.updateBucket(SYSTEM_BACKUP_BUCKET, {
      public: false,
      fileSizeLimit: "100MB",
      allowedMimeTypes: ["application/json"],
    });
    if (error) throw error;
  }

  return storage;
}

function isMissingBackupBucketError(error: { message: string; statusCode?: string }) {
  const message = error.message.toLowerCase();
  return error.statusCode === "404" ||
    message.includes("bucket not found") ||
    message.includes("no such bucket");
}

export async function persistScheduledBackup(fileName: string, jsonString: string) {
  let storage = await ensurePrivateBackupBucket();
  const path = `scheduled/${fileName}`;
  const uploadOptions = {
    contentType: "application/json",
    upsert: true,
  };
  let { error } = await storage.from(SYSTEM_BACKUP_BUCKET).upload(
    path,
    Buffer.from(jsonString, "utf8"),
    uploadOptions,
  );
  if (error && isMissingBackupBucketError(error)) {
    storage = await ensurePrivateBackupBucket();
    ({ error } = await storage.from(SYSTEM_BACKUP_BUCKET).upload(
      path,
      Buffer.from(jsonString, "utf8"),
      uploadOptions,
    ));
  }
  if (error) throw error;
  return path;
}

export async function downloadScheduledBackup(fileName: string, storagePath?: string | null) {
  const storage = getStorage();
  const path = storagePath ?? `scheduled/${fileName}`;
  if (!/^scheduled\/[a-zA-Z0-9._-]+\.json$/.test(path)) {
    throw new Error("Stored backup path is invalid.");
  }
  const { data, error } = await storage
    .from(SYSTEM_BACKUP_BUCKET)
    .download(path);
  if (error) throw error;
  return data;
}

export async function removeScheduledBackupFiles(paths: string[]) {
  const uniquePaths = [...new Set(paths)];
  if (uniquePaths.length === 0) return;
  if (uniquePaths.some((path) => !/^scheduled\/[a-zA-Z0-9._-]+\.json$/.test(path))) {
    throw new Error("Stored backup path is invalid.");
  }

  const { error } = await getStorage()
    .from(SYSTEM_BACKUP_BUCKET)
    .remove(uniquePaths);
  if (error && !isMissingBackupBucketError(error)) throw error;
}
