import { z } from "zod";

export const MAX_KK_PROFILE_FILE_SIZE = 10 * 1024 * 1024;
export const KK_PROFILE_DOCUMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

const imageFileSchema = z
  .file()
  .min(1, "The selected file is empty.")
  .max(MAX_KK_PROFILE_FILE_SIZE, "Each document must be no larger than 10 MB.")
  .mime(["image/jpeg", "image/png", "image/webp"], "Upload a JPG, PNG, or WebP image.");

const documentFileSchema = z
  .file()
  .min(1, "The selected file is empty.")
  .max(MAX_KK_PROFILE_FILE_SIZE, "Each document must be no larger than 10 MB.")
  .mime([...KK_PROFILE_DOCUMENT_MIME_TYPES], "Upload a JPG, PNG, WebP, or PDF file.");

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
