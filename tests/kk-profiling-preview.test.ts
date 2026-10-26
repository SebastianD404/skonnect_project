import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { POST } from "../app/api/programs/kk-profiling/preview/route";

async function createPreview(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return POST(new Request("http://localhost/api/programs/kk-profiling/preview", {
    method: "POST",
    body: formData,
  }));
}

describe("POST /api/programs/kk-profiling/preview", () => {
  it("converts a valid image into a browser-friendly JPEG thumbnail", async () => {
    const png = await sharp({
      create: {
        width: 2,
        height: 2,
        channels: 3,
        background: { r: 30, g: 90, b: 150 },
      },
    }).png().toBuffer();

    const response = await createPreview(new File([png], "id.png", { type: "image/png" }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(0);
  });

  it("rejects non-image uploads", async () => {
    const response = await createPreview(new File(["not an image"], "id.txt", { type: "text/plain" }));

    expect(response.status).toBe(400);
  });

  it("rejects image files over the upload limit", async () => {
    const oversizedImage = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "id.png",
      { type: "image/png" }
    );
    const response = await createPreview(oversizedImage);

    expect(response.status).toBe(413);
  });

  it("returns a helpful error for image data that cannot be decoded", async () => {
    const response = await createPreview(new File(["invalid image bytes"], "id.png", { type: "image/png" }));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: "This image could not be prepared for preview.",
    });
  });
});
