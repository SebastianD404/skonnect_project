import "dotenv/config";
import { prisma } from "@/lib/prisma";
import {
  getLegacySubmissionStorageObject,
  getSubmissionStorageObject,
} from "@/lib/ocr/storage";
import { createAdminClient } from "@/lib/supabase/admin";

const PRIVATE_BUCKET = "grantee-submissions";
const APPLY = process.argv.includes("--apply");

type FileColumn = "gradeFileUrl" | "coeFileUrl";
type FileReference = {
  submissionId: string;
  column: FileColumn;
  originalValue: string;
  authId: string;
  bucket: string;
  path: string;
};

function isPrivatePath(value: string) {
  return value.startsWith(`${PRIVATE_BUCKET}/`);
}

function safeStorageError(error: unknown) {
  if (!error || typeof error !== "object") return "Unknown storage error";
  const data = error as { statusCode?: unknown; message?: unknown };
  const status = typeof data.statusCode === "string" ? data.statusCode : "unknown status";
  const message = typeof data.message === "string"
    ? data.message.replace(/grantee-submissions\/[^\s"'?]*/g, "[submission path]")
    : "Unknown storage error";
  return `${status}: ${message}`;
}

function sanitizeDiagnostic(value: string) {
  return value
    .replace(/postgres(?:ql)?:\/\/[^@\s]+@/gi, "postgresql://[credentials]@")
    .replace(/\b(?:sb_secret|eyJ)[A-Za-z0-9._-]{20,}\b/g, "[redacted token]");
}

function formatErrorChain(error: unknown): string[] {
  if (!(error instanceof Error)) {
    return [`Non-Error rejection: ${sanitizeDiagnostic(String(error))}`];
  }

  const lines = [
    `${error.name}: ${sanitizeDiagnostic(error.message)}`,
    ...(error.stack ? [sanitizeDiagnostic(error.stack)] : []),
  ];
  if ("cause" in error && error.cause !== undefined) {
    lines.push("Caused by:", ...formatErrorChain(error.cause));
  }
  return lines;
}

async function loadReferences() {
  const submissions = await prisma.submission.findMany({
    select: {
      id: true,
      gradeFileUrl: true,
      coeFileUrl: true,
      grantee: { select: { user: { select: { authId: true } } } },
    },
  });

  const references: FileReference[] = [];
  let skippedInvalidPrivateReferences = 0;
  for (const submission of submissions) {
    const authId = submission.grantee.user.authId;
    if (!authId) {
      throw new Error("A submission owner is missing an authentication ID.");
    }

    for (const column of ["gradeFileUrl", "coeFileUrl"] as const) {
      const originalValue = submission[column];
      if (!originalValue) continue;
      if (isPrivatePath(originalValue)) {
        try {
          getSubmissionStorageObject(originalValue, authId);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          skippedInvalidPrivateReferences += 1;
          console.warn(
            `Skipping invalid private path for submission ${submission.id}, field ${column}: ${detail}`
          );
        }
        continue;
      }

      const object = getLegacySubmissionStorageObject(originalValue, authId);
      references.push({
        submissionId: submission.id,
        column,
        originalValue,
        authId,
        bucket: object.bucket,
        path: object.path,
      });
    }
  }
  return { references, skippedInvalidPrivateReferences };
}

async function main() {
  const initial = await loadReferences();
  const initialReferences = initial.references;
  if (!APPLY) {
    console.log(
      `Dry run: ${initialReferences.length} legacy submission file reference(s) need migration; ${initial.skippedInvalidPrivateReferences} invalid private reference(s) were skipped. Re-run with --apply to copy valid legacy files into private storage and remove their public copies.`
    );
    return;
  }

  const admin = createAdminClient();
  const grouped = new Map<string, FileReference[]>();
  for (const reference of initialReferences) {
    const key = `${reference.bucket}\0${reference.path}`;
    grouped.set(key, [...(grouped.get(key) ?? []), reference]);
  }

  let migratedReferences = 0;
  let failedObjects = 0;
  let failedDownloads = 0;
  let failedUploads = 0;
  let failedUpdates = 0;
  let failedRemovals = 0;
  for (const references of grouped.values()) {
    const source = references[0];
    const { data, error: downloadError } = await admin.storage
      .from(source.bucket)
      .download(source.path);
    if (downloadError || !data) {
      failedObjects += 1;
      failedDownloads += 1;
      continue;
    }

    const { error: uploadError } = await admin.storage
      .from(PRIVATE_BUCKET)
      .upload(source.path, data, {
        contentType: data.type || "application/octet-stream",
        upsert: true,
      });
    if (uploadError) {
      failedObjects += 1;
      failedUploads += 1;
      console.error(`Private bucket upload failed (${safeStorageError(uploadError)}).`);
      continue;
    }

    let allReferencesUpdated = true;
    for (const reference of references) {
      const result = await prisma.submission.updateMany({
        where: { id: reference.submissionId, [reference.column]: reference.originalValue },
        data: { [reference.column]: `${PRIVATE_BUCKET}/${reference.path}` },
      });
      if (result.count !== 1) allReferencesUpdated = false;
      else migratedReferences += 1;
    }

    if (!allReferencesUpdated) {
      failedObjects += 1;
      failedUpdates += 1;
      continue;
    }

    const { error: removeError } = await admin.storage
      .from(source.bucket)
      .remove([source.path]);
    if (removeError) {
      failedObjects += 1;
      failedRemovals += 1;
    }
  }

  const remaining = await loadReferences();
  const remainingReferences = remaining.references;
  const stillPublicPaths = new Set(
    remainingReferences.map((reference) => `${reference.bucket}\0${reference.path}`)
  );
  const privateReferences = await prisma.submission.findMany({
    select: {
      id: true,
      gradeFileUrl: true,
      coeFileUrl: true,
      grantee: { select: { user: { select: { authId: true } } } },
    },
  });
  const privatePaths = new Set<string>();
  for (const submission of privateReferences) {
    const authId = submission.grantee.user.authId;
    if (!authId) continue;
    for (const [column, filePath] of [
      ["gradeFileUrl", submission.gradeFileUrl],
      ["coeFileUrl", submission.coeFileUrl],
    ] as const) {
      if (isPrivatePath(filePath)) {
        try {
          const object = getSubmissionStorageObject(filePath, authId);
          const key = `public image\0${object.path}`;
          if (!stillPublicPaths.has(key)) privatePaths.add(object.path);
        } catch (error) {
          const detail = error instanceof Error ? error.message : String(error);
          console.warn(
            `Skipping public-copy cleanup for submission ${submission.id}, field ${column}: ${detail}`
          );
        }
      }
    }
  }

  for (const path of privatePaths) {
    const { error } = await admin.storage.from("public image").remove([path]);
    if (error) failedObjects += 1;
  }

  console.log(
    `Migration complete: ${migratedReferences} reference(s) moved; ${failedObjects} operation(s) failed (download: ${failedDownloads}, private upload: ${failedUploads}, database update: ${failedUpdates}, public cleanup: ${failedRemovals}); ${initial.skippedInvalidPrivateReferences} invalid private reference(s) skipped.`
  );
  if (
    remainingReferences.length > 0 ||
    remaining.skippedInvalidPrivateReferences > 0 ||
    failedObjects > 0
  ) {
    throw new Error("Some legacy submission files still need private-storage migration or public-copy cleanup.");
  }
}

main()
  .catch((error: unknown) => {
    console.error(["Submission file migration failed:", ...formatErrorChain(error)].join("\n"));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
