import { afterEach, describe, expect, it, vi } from "vitest";
import {
  compressImageForUpload,
  getSkeapUploadErrorMessage,
} from "@/lib/skeap-upload-client";
import { SKEAP_UPLOAD_TOO_LARGE_MESSAGE } from "@/lib/skeap-upload";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SKEAP upload client helpers", () => {
  it("compresses large raster images to a lossy format below 1 MB", async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => ({
        fillStyle: "",
        fillRect: vi.fn(),
        drawImage: vi.fn(),
      })),
      toBlob: vi.fn((callback: BlobCallback, type: string, quality?: number) => {
        expect(quality).toBe(0.82);
        const byteSize = canvas.width >= 1800 ? 1_200_000 : 900_000;
        callback(new Blob([new Uint8Array(byteSize)], { type }));
      }),
    };
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
      width: 4000,
      height: 3000,
      close: vi.fn(),
    })));

    const source = new File([new Uint8Array(1_600_000)], "screenshot.png", { type: "image/png" });
    const compressed = await compressImageForUpload(source);

    expect(compressed.size).toBeLessThanOrEqual(1_048_576);
    expect(compressed.type).toBe("image/jpeg");
    expect(compressed.name).toBe("screenshot.jpg");
    expect(canvas.width).toBeLessThanOrEqual(1800);
    expect(canvas.toBlob).toHaveBeenCalledTimes(2);
  });

  it("replaces 413 and Vercel payload traces with the friendly size message", async () => {
    expect(await getSkeapUploadErrorMessage(new Response("", { status: 413 }), "Upload failed"))
      .toBe(SKEAP_UPLOAD_TOO_LARGE_MESSAGE);
    expect(await getSkeapUploadErrorMessage(
      new Response("FUNCTION_PAYLOAD_TOO_LARGE sin1::trace-id", { status: 500 }),
      "Upload failed",
    )).toBe(SKEAP_UPLOAD_TOO_LARGE_MESSAGE);
  });

  it("preserves clean API errors and falls back for non-JSON responses", async () => {
    expect(await getSkeapUploadErrorMessage(
      new Response(JSON.stringify({ error: "The application is locked." }), { status: 409 }),
      "Upload failed",
    )).toBe("The application is locked.");
    expect(await getSkeapUploadErrorMessage(new Response("<html>error</html>", { status: 500 }), "Upload failed"))
      .toBe("Upload failed");
  });
});
