import "server-only";

import { gunzipSync, gzipSync } from "node:zlib";
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
      fileSizeLimit: 52428800,
      allowedMimeTypes: ["application/json", "application/gzip"],
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

  const { error } = await storage.updateBucket(SYSTEM_BACKUP_BUCKET, {
    public: false,
    fileSizeLimit: 52428800,
    allowedMimeTypes: ["application/json", "application/gzip"],
  });
  if (error) throw error;

  return storage;
}

function isMissingBackupBucketError(error: { message: string; statusCode?: string }) {
  const message = error.message.toLowerCase();
  return error.statusCode === "404" ||
    message.includes("bucket not found") ||
    message.includes("no such bucket");
}

async function uploadBackup(path: string, jsonInput: string | Buffer) {
  let storage = await ensurePrivateBackupBucket();
  const uploadOptions = {
    contentType: "application/gzip",
    upsert: true,
  };
  const jsonBuffer = typeof jsonInput === "string"
    ? Buffer.from(jsonInput, "utf8")
    : jsonInput;
  const compressedBuffer = gzipSync(jsonBuffer, { level: 9 });
  const compressedPath = `${path}.gz`;
  let { error } = await storage.from(SYSTEM_BACKUP_BUCKET).upload(
    compressedPath,
    compressedBuffer,
    uploadOptions,
  );
  if (error && isMissingBackupBucketError(error)) {
    storage = await ensurePrivateBackupBucket();
    ({ error } = await storage.from(SYSTEM_BACKUP_BUCKET).upload(
      compressedPath,
      compressedBuffer,
      uploadOptions,
    ));
  }
  if (error) throw error;
  return compressedPath;
}

export async function persistSystemBackup(
  type: SystemBackupType,
  phtDate: string,
  fileName: string,
  jsonBuffer: string | Buffer,
) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(phtDate)) {
    throw new Error("Backup date is invalid.");
  }
  const path = `${type.toLowerCase()}/${phtDate}/${fileName}`;
  return uploadBackup(path, jsonBuffer);
}

export async function persistScheduledBackup(fileName: string, jsonBuffer: string | Buffer) {
  const path = `scheduled/${fileName}`;
  return uploadBackup(path, jsonBuffer);
}

export async function downloadScheduledBackup(fileName: string, storagePath?: string | null) {
  const path = storagePath ?? `scheduled/${fileName}`;
  return downloadStoredBackup(path, /^scheduled\/(?:\d{4}-\d{2}-\d{2}\/)?[a-zA-Z0-9._-]+\.json(?:\.gz)?$/);
}

export async function downloadSystemBackup(storagePath: string) {
  return downloadStoredBackup(
    storagePath,
    /^(?:manual\/\d{4}-\d{2}-\d{2}|scheduled\/(?:\d{4}-\d{2}-\d{2}\/)?)[a-zA-Z0-9._-]+\.json(?:\.gz)?$/,
  );
}

async function downloadStoredBackup(path: string, allowedPath: RegExp) {
  if (!allowedPath.test(path)) {
    throw new Error("Stored backup path is invalid.");
  }
  const { data, error } = await getStorage()
    .from(SYSTEM_BACKUP_BUCKET)
    .download(path);
  if (error) throw error;
  const storedBuffer = Buffer.from(await data.arrayBuffer());
  return path.endsWith(".gz") ? gunzipSync(storedBuffer) : storedBuffer;
}

export async function createSystemBackupSignedUrl(storagePath: string, fileName: string) {
  if (!/^(?:manual\/\d{4}-\d{2}-\d{2}|scheduled\/(?:\d{4}-\d{2}-\d{2}\/)?)[a-zA-Z0-9._-]+\.json(?:\.gz)?$/.test(storagePath)) {
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
  if (uniquePaths.some((path) => !/^scheduled\/(?:\d{4}-\d{2}-\d{2}\/)?[a-zA-Z0-9._-]+\.json(?:\.gz)?$/.test(path))) {
    throw new Error("Stored backup path is invalid.");
  }

  const { error } = await getStorage()
    .from(SYSTEM_BACKUP_BUCKET)
    .remove(uniquePaths);
  if (error && !isMissingBackupBucketError(error)) throw error;
}
