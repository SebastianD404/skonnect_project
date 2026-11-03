import "dotenv/config";
import { Prisma } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/prisma";

const PRIVATE_BUCKET = "private-documents";
const LEGACY_BUCKET = "public image";
const APPLY = process.argv.includes("--apply");
const SENSITIVE_PREFIXES = new Set(["kk-verification", "skeap-applications"]);

function createStorageAdminClient() {
  const projectUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!projectUrl || !serviceRoleKey) {
    throw new Error("Supabase URL and server admin key are required.");
  }
  return createClient(projectUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

type SensitiveReference =
  | {
      kind: "profiling";
      id: string;
      field: "idFrontFileUrl" | "idBackFileUrl" | "idSingleFileUrl";
      value: string;
      authId: string;
      path: string;
    }
  | {
      kind: "skeap";
      id: string;
      key: string;
      value: string;
      authId: string;
      path: string;
    };

function parseLegacyPath(value: string, authId: string) {
  const projectUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!projectUrl) throw new Error("Supabase URL is not configured.");

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (url.origin !== new URL(projectUrl).origin) return null;

  const parts = url.pathname.split("/").slice(1).map((part) => decodeURIComponent(part));
  if (parts[0] !== "storage" || parts[1] !== "v1" || parts[2] !== "object" ||
      parts[3] !== "public" || parts[4] !== LEGACY_BUCKET) {
    return null;
  }

  const objectPath = parts.slice(5);
  if (!SENSITIVE_PREFIXES.has(objectPath[0])) return null;
  if (objectPath.length < 3) throw new Error("A sensitive document reference has an incomplete path.");
  if (objectPath.some((part) => !part || part === "." || part === ".." || /[\\/]/.test(part))) {
    throw new Error("A sensitive document reference has invalid path segments.");
  }
  if (objectPath[1] !== authId) {
    throw new Error("A sensitive document reference does not match its database owner.");
  }
  return objectPath.join("/");
}

function privateDocumentUrl(path: string) {
  return `/api/private-documents/${path.split("/").map(encodeURIComponent).join("/")}`;
}

async function loadReferences() {
  const references: SensitiveReference[] = [];
  const registrations = await prisma.profilingRegistration.findMany({
    select: {
      id: true,
      idFrontFileUrl: true,
      idBackFileUrl: true,
      idSingleFileUrl: true,
      user: { select: { authId: true } },
    },
  });

  for (const registration of registrations) {
    if (!registration.user?.authId) continue;
    for (const field of ["idFrontFileUrl", "idBackFileUrl", "idSingleFileUrl"] as const) {
      const value = registration[field];
      if (!value) continue;
      const path = parseLegacyPath(value, registration.user.authId);
      if (path) references.push({
        kind: "profiling",
        id: registration.id,
        field,
        value,
        authId: registration.user.authId,
        path,
      });
    }
  }

  const applications = await prisma.skeapApplication.findMany({
    select: { id: true, user: { select: { authId: true } }, uploadedFiles: true },
  });
  for (const application of applications) {
    if (!application.user.authId || !application.uploadedFiles ||
        typeof application.uploadedFiles !== "object" || Array.isArray(application.uploadedFiles)) {
      continue;
    }
    for (const [key, file] of Object.entries(application.uploadedFiles)) {
      if (!file || typeof file !== "object" || Array.isArray(file) ||
          !("url" in file) || typeof file.url !== "string") {
        continue;
      }
      const path = parseLegacyPath(file.url, application.user.authId);
      if (path) references.push({
        kind: "skeap",
        id: application.id,
        key,
        value: file.url,
        authId: application.user.authId,
        path,
      });
    }
  }
  return references;
}

async function updateReference(reference: SensitiveReference) {
  const url = privateDocumentUrl(reference.path);
  if (reference.kind === "profiling") {
    await prisma.profilingRegistration.update({
      where: { id: reference.id },
      data: { [reference.field]: url },
    });
    return;
  }

  const application = await prisma.skeapApplication.findUnique({
    where: { id: reference.id },
    select: { uploadedFiles: true },
  });
  if (!application?.uploadedFiles ||
      typeof application.uploadedFiles !== "object" || Array.isArray(application.uploadedFiles)) {
    throw new Error("A SKEAP application document record changed during migration.");
  }
  const uploadedFiles = application.uploadedFiles as Record<string, unknown>;
  const file = uploadedFiles[reference.key];
  if (!file || typeof file !== "object" || Array.isArray(file) ||
      !("url" in file) || file.url !== reference.value) {
    throw new Error("A SKEAP document reference changed during migration.");
  }
  uploadedFiles[reference.key] = { ...file, url };
  await prisma.skeapApplication.update({
    where: { id: reference.id },
    data: { uploadedFiles: uploadedFiles as Prisma.InputJsonValue },
  });
}

async function listLegacySensitiveObjects(storage: ReturnType<typeof createStorageAdminClient>["storage"]) {
  const paths: string[] = [];
  for (const prefix of SENSITIVE_PREFIXES) {
    const directories = [prefix];
    while (directories.length > 0) {
      const directory = directories.pop();
      if (!directory) continue;

      let offset = 0;
      while (true) {
        const { data, error } = await storage.from(LEGACY_BUCKET).list(directory, {
          limit: 1000,
          offset,
        });
        if (error) throw error;

        for (const entry of data ?? []) {
          const path = `${directory}/${entry.name}`;
          if (entry.id === null) directories.push(path);
          else paths.push(path);
        }
        if (!data || data.length < 1000) break;
        offset += 1000;
      }
    }
  }
  return paths;
}

async function main() {
  const references = await loadReferences();
  const storage = createStorageAdminClient().storage;
  const objects = new Map<string, SensitiveReference[]>();
  for (const reference of references) {
    objects.set(reference.path, [...(objects.get(reference.path) ?? []), reference]);
  }
  for (const path of await listLegacySensitiveObjects(storage)) {
    if (!objects.has(path)) objects.set(path, []);
  }

  if (!APPLY) {
    console.log(
      `Dry run: ${objects.size} public sensitive document object(s) referenced by ${references.length} record(s). Re-run with --apply to move them into private storage and remove public copies.`
    );
    return;
  }

  let migrated = 0;
  let failed = 0;
  for (const [path, objectReferences] of objects) {
    try {
      const { data: legacyData, error: downloadError } = await storage.from(LEGACY_BUCKET).download(path);
      if (legacyData) {
        const { error: uploadError } = await storage.from(PRIVATE_BUCKET).upload(path, legacyData, {
          contentType: legacyData.type || "application/octet-stream",
          cacheControl: "0",
          upsert: true,
        });
        if (uploadError) throw uploadError;
      } else {
        const { data: privateData, error: privateError } = await storage.from(PRIVATE_BUCKET).download(path);
        if (privateError) throw privateError;
        if (!privateData) throw downloadError ?? new Error("Document could not be found in either bucket.");
      }

      const { error: removeError } = await storage.from(LEGACY_BUCKET).remove([path]);
      if (removeError && removeError.statusCode !== "404") throw removeError;

      for (const reference of objectReferences) await updateReference(reference);
      migrated += 1;
    } catch (error) {
      failed += 1;
      const status = error && typeof error === "object" && "statusCode" in error
        ? String(error.statusCode)
        : "unknown";
      console.error(`Could not migrate one sensitive document object (storage status: ${status}).`);
    }
  }

  console.log(`Migrated ${migrated} object(s); ${failed} object(s) failed.`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error("Sensitive document migration failed:", error instanceof Error ? error.message : "Unknown error");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
