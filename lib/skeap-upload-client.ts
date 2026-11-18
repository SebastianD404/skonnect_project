import {
  MAX_SKEAP_UPLOAD_SIZE_BYTES,
  SKEAP_UPLOAD_TOO_LARGE_MESSAGE,
} from "@/lib/skeap-upload";

const IMAGE_COMPRESSION_THRESHOLD_BYTES = 1.5 * 1024 * 1024;
const MAX_COMPRESSED_IMAGE_SIZE_BYTES = 1 * 1024 * 1024;
const MAX_IMAGE_DIMENSION = 1800;

export function isSkeapRasterImage(file: Pick<File, "name" | "type">) {
  return /^image\/(png|jpe?g|jfif|webp)$/i.test(file.type) ||
    /\.(png|jpe?g|jfif|webp)$/i.test(file.name);
}

function blobFromCanvas(canvas: HTMLCanvasElement, type: string) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Could not compress the selected image."));
    }, type, 0.82);
  });
}

export async function compressImageForUpload(file: File): Promise<File> {
  const isJfif = file.type.toLowerCase() === "image/jfif" || /\.jfif$/i.test(file.name);
  const extension = file.name.split(".").pop()?.toLowerCase();
  const inferredType = extension === "png"
    ? "image/png"
    : extension === "webp"
      ? "image/webp"
      : extension === "jpg" || extension === "jpeg" || extension === "jfif"
        ? "image/jpeg"
        : file.type;
  if (
    !isSkeapRasterImage(file) ||
    (file.size <= IMAGE_COMPRESSION_THRESHOLD_BYTES && !isJfif)
  ) {
    return file.type === inferredType
      ? file
      : new File([file], file.name, { type: inferredType, lastModified: file.lastModified });
  }
  if (typeof document === "undefined") {
    throw new Error("Image compression is unavailable in this browser.");
  }

  let bitmap: ImageBitmap | null = null;
  let image: HTMLImageElement | null = null;
  let imageUrl: string | null = null;

  try {
    try {
      bitmap = await createImageBitmap(file);
    } catch {
      imageUrl = URL.createObjectURL(file);
      image = new Image();
      await new Promise<void>((resolve, reject) => {
        image!.onload = () => resolve();
        image!.onerror = () => reject(new Error("Could not read the selected image."));
        image!.src = imageUrl!;
      });
    }

    const source = bitmap ?? image;
    const sourceWidth = bitmap?.width ?? image?.naturalWidth ?? 0;
    const sourceHeight = bitmap?.height ?? image?.naturalHeight ?? 0;
    if (!source || !sourceWidth || !sourceHeight) {
      throw new Error("The selected image has invalid dimensions.");
    }

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare the selected image for upload.");

    const requestedType =
      inferredType === "image/webp"
        ? "image/webp"
        : "image/jpeg";
    let outputType = requestedType;
    let scale = Math.min(1, MAX_IMAGE_DIMENSION / Math.max(sourceWidth, sourceHeight));
    let compressed: Blob;

    while (true) {
      canvas.width = Math.max(1, Math.round(sourceWidth * scale));
      canvas.height = Math.max(1, Math.round(sourceHeight * scale));
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(source, 0, 0, canvas.width, canvas.height);

      compressed = await blobFromCanvas(canvas, outputType);
      if (compressed.type !== outputType) {
        outputType = "image/jpeg";
        compressed = await blobFromCanvas(canvas, outputType);
      }
      if (compressed.type !== outputType) {
        throw new Error("Your browser could not encode the selected image for upload.");
      }
      if (compressed.size <= MAX_COMPRESSED_IMAGE_SIZE_BYTES) break;

      scale *= 0.85;
    }

    const extension = outputType === "image/webp" ? ".webp" : ".jpg";
    const name = `${file.name.replace(/\.[^.]+$/, "")}${extension}`;
    return new File([compressed], name, {
      type: outputType,
      lastModified: file.lastModified,
    });
  } finally {
    bitmap?.close();
    if (imageUrl) URL.revokeObjectURL(imageUrl);
  }
}

export function ensureSkeapUploadWithinLimit(file: File) {
  if (file.size > MAX_SKEAP_UPLOAD_SIZE_BYTES) {
    throw new Error(SKEAP_UPLOAD_TOO_LARGE_MESSAGE);
  }
}

export async function getSkeapUploadErrorMessage(response: Response, fallback: string) {
  if (response.status === 413) return SKEAP_UPLOAD_TOO_LARGE_MESSAGE;

  let responseText: string;
  try {
    responseText = await response.text();
  } catch {
    return fallback;
  }

  if (/FUNCTION_PAYLOAD_TOO_LARGE/i.test(responseText)) {
    return SKEAP_UPLOAD_TOO_LARGE_MESSAGE;
  }

  try {
    const body: unknown = JSON.parse(responseText);
    if (
      typeof body === "object" &&
      body !== null &&
      "error" in body &&
      typeof body.error === "string" &&
      body.error.trim()
    ) {
      return body.error;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
