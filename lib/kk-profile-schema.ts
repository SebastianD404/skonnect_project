import { z } from "zod";

export const MAX_KK_PROFILE_FILE_SIZE = 10 * 1024 * 1024;
export const KK_PROFILE_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/jfif",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

const JFIF_COMPATIBLE_TYPES = new Set([
  "",
  "application/octet-stream",
  "image/jpeg",
  "image/jfif",
]);

function isJfifFile(file: File) {
  return /\.jfif$/i.test(file.name) && JFIF_COMPATIBLE_TYPES.has(file.type.toLowerCase());
}

const imageFileSchema = z
  .file()
  .min(1, "The selected file is empty.")
  .max(MAX_KK_PROFILE_FILE_SIZE, "Each document must be no larger than 10 MB.")
  .refine(
    (file) =>
      ["image/jpeg", "image/jfif", "image/png", "image/webp"].includes(file.type.toLowerCase()) ||
      isJfifFile(file),
    "Upload a JPG, JFIF, PNG, or WebP image.",
  );

const documentFileSchema = z
  .file()
  .min(1, "The selected file is empty.")
  .max(MAX_KK_PROFILE_FILE_SIZE, "Each document must be no larger than 10 MB.")
  .refine(
    (file) =>
      KK_PROFILE_DOCUMENT_MIME_TYPES.includes(file.type.toLowerCase() as (typeof KK_PROFILE_DOCUMENT_MIME_TYPES)[number]) ||
      isJfifFile(file),
    "Upload a JPG, JFIF, PNG, WebP, or PDF file.",
  );

export const KKProfileSchema = z.object({
  profilePicture: imageFileSchema,
  birthCertificate: documentFileSchema,
  validId: z.object({
    front: documentFileSchema,
    back: documentFileSchema,
  }),
  certificateOfResidency: documentFileSchema,
});

export type KKProfileDocuments = z.infer<typeof KKProfileSchema>;
