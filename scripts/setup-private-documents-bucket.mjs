#!/usr/bin/env node

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const projectUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const bucketName = "private-documents";

if (!projectUrl || !serviceRoleKey) {
  console.error("Missing SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(projectUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function setupPrivateBucket() {
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();
  if (listError) throw listError;

  const bucket = buckets?.find((item) => item.name === bucketName);
  if (!bucket) {
    const { error } = await supabase.storage.createBucket(bucketName, {
      public: false,
      fileSizeLimit: "15MB",
      allowedMimeTypes: [
        "application/msword",
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
      ],
    });
    if (error) throw error;
    console.log(`Created private Supabase Storage bucket "${bucketName}".`);
    return;
  }

  if (bucket.public) {
    const { error } = await supabase.storage.updateBucket(bucketName, { public: false });
    if (error) throw error;
    console.log(`Changed Supabase Storage bucket "${bucketName}" to private.`);
  } else {
    console.log(`Supabase Storage bucket "${bucketName}" is already private.`);
  }
}

setupPrivateBucket().catch((error) => {
  console.error("Private document bucket setup failed:", error);
  process.exitCode = 1;
});
