type ImageCompressionOptions = {
  maxWidth?: number;
  quality?: number;
};

export async function compressImageForUpload(
  file: File,
  options: ImageCompressionOptions = {},
): Promise<File> {
  if (file.type === "application/pdf" || !file.type.startsWith("image/")) {
    return file;
  }

  const maxWidth = options.maxWidth ?? 1600;
  const quality = options.quality ?? 0.8;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("A selected image could not be processed. Please choose another image and try again.");
  }

  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));

  try {
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Unable to prepare a selected image for upload.");
    }

    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob
          ? resolve(blob)
          : reject(new Error("Unable to compress a selected image.")),
        "image/jpeg",
        quality,
      );
    });
    if (compressedBlob.size >= file.size) return file;

    const baseName = file.name.replace(/\.[^.]+$/, "") || "document";
    return new File([compressedBlob], `${baseName}.jpg`, {
      type: "image/jpeg",
      lastModified: file.lastModified,
    });
  } finally {
    bitmap.close();
    canvas.width = 0;
    canvas.height = 0;
  }
}
