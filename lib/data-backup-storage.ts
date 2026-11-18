import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const SYSTEM_BACKUP_BUCKET = "system-backups";

type SystemBackupType = "MANUAL" | "SCHEDULED";

function getStorage() {
  return createAdminClient().storage;
}

async function ensurePrivateBackupBucket() {
  const storage = getStorage();
  const { data: buckets, error: listError } = await storage.listBuckets();
  if (listError) throw listError;

  let bucket = buckets.find((item) => item.name === SYSTEM_BACKUP_BUCKET);
  if (!bucket) {
    const { error } = await storage.createBucket(SYSTEM_BACKUP_BUCKET, {
      public: false,
      fileSizeLimit: "100MB",
      allowedMimeTypes: ["application/json"],
    });
    if (error) {
      const { data: refreshedBuckets, error: refreshError } = await storage.listBuckets();
      if (refreshError) throw refreshError;
      bucket = refreshedBuckets.find((item) => item.name === SYSTEM_BACKUP_BUCKET);
      if (!bucket) throw error;
    } else {
      return storage;
    }
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

async function uploadBackup(path: string, jsonString: string) {
  let storage = await ensurePrivateBackupBucket();
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
}

export async function persistSystemBackup(
  type: SystemBackupType,
  phtDate: string,
  fileName: string,
  jsonString: string,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(phtDate)) {
    throw new Error("Backup date is invalid.");
  }
  const path = `${type.toLowerCase()}/${phtDate}/${fileName}`;
  await uploadBackup(path, jsonString);
  return path;
}

export async function persistScheduledBackup(fileName: string, jsonString: string) {
  const path = `scheduled/${fileName}`;
  await uploadBackup(path, jsonString);
  return path;
}

export async function downloadScheduledBackup(fileName: string, storagePath?: string | null) {
  const storage = getStorage();
  const path = storagePath ?? `scheduled/${fileName}`;
  if (!/^scheduled\/(?:\d{4}-\d{2}-\d{2}\/)?[a-zA-Z0-9._-]+\.json$/.test(path)) {
    throw new Error("Stored backup path is invalid.");
  }
  const { data, error } = await storage
    .from(SYSTEM_BACKUP_BUCKET)
    .download(path);
  if (error) throw error;
  return data;
}

export async function createSystemBackupSignedUrl(storagePath: string, fileName: string) {
  if (!/^(?:manual\/\d{4}-\d{2}-\d{2}|scheduled\/(?:\d{4}-\d{2}-\d{2}\/)?)[a-zA-Z0-9._-]+\.json$/.test(storagePath)) {
    throw new Error("Stored backup path is invalid.");
  }
  const { data, error } = await getStorage()
    .from(SYSTEM_BACKUP_BUCKET)
    .createSignedUrl(storagePath, 60, { download: fileName });
  if (error) throw error;
  if (!data.signedUrl) throw new Error("Supabase did not return a signed backup URL.");
  return data.signedUrl;
}

export async function removeScheduledBackupFiles(paths: string[]) {
  const uniquePaths = [...new Set(paths)];
  if (uniquePaths.length === 0) return;
  if (uniquePaths.some((path) => !/^scheduled\/(?:\d{4}-\d{2}-\d{2}\/)?[a-zA-Z0-9._-]+\.json$/.test(path))) {
    throw new Error("Stored backup path is invalid.");
  }

  const { error } = await getStorage()
    .from(SYSTEM_BACKUP_BUCKET)
    .remove(uniquePaths);
  if (error && !isMissingBackupBucketError(error)) throw error;
}
