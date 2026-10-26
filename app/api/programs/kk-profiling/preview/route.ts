import { NextResponse } from "next/server";
import sharp from "sharp";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40_000_000;

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose an image file to preview." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || !file.type.toLowerCase().startsWith("image/")) {
    return NextResponse.json({ error: "Choose a JPG or PNG image to preview." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "Image must be smaller than 10MB to preview." },
      { status: 413 }
    );
  }

  try {
    const imageBuffer = Buffer.from(await file.arrayBuffer());
    const preview = await sharp(imageBuffer, { limitInputPixels: MAX_IMAGE_PIXELS })
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();

    return new Response(new Uint8Array(preview), {
      headers: {
        "Content-Type": "image/jpeg",
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.warn("KK Profiling image preview conversion failed.", {
      fileName: file.name,
      error,
    });
    return NextResponse.json(
      { error: "This image could not be prepared for preview." },
      { status: 422 }
    );
  }
}
