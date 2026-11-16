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

export async function persistScheduledBackup(fileName: string, jsonString: string) {
  const storage = await ensurePrivateBackupBucket();
  const path = `scheduled/${fileName}`;
  const { error } = await storage.from(SYSTEM_BACKUP_BUCKET).upload(
    path,
    Buffer.from(jsonString, "utf8"),
    { contentType: "application/json", upsert: true },
  );
  if (error) throw error;
  return path;
}

export async function downloadScheduledBackup(fileName: string) {
  const storage = getStorage();
  const { data, error } = await storage
    .from(SYSTEM_BACKUP_BUCKET)
    .download(`scheduled/${fileName}`);
  if (error) throw error;
  return data;
}
