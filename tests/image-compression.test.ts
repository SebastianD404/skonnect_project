import { afterEach, describe, expect, it, vi } from "vitest";
import { compressImageForUpload } from "@/lib/image-compression";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("compressImageForUpload", () => {
  it("returns PDFs and non-image files unchanged", async () => {
    const pdf = new File(["pdf"], "id.pdf", { type: "application/pdf" });
    const text = new File(["text"], "note.txt", { type: "text/plain" });

    await expect(compressImageForUpload(pdf)).resolves.toBe(pdf);
    await expect(compressImageForUpload(text)).resolves.toBe(text);
  });

  it("returns a smaller JPEG and scales to the configured maximum width", async () => {
    const context = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      fillStyle: "",
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback, type?: string, quality?: number) => {
        expect(type).toBe("image/jpeg");
        expect(quality).toBe(0.8);
        callback(new Blob(["small"], { type: "image/jpeg" }));
      }),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
      width: 2000,
      height: 1000,
      close: vi.fn(),
    })));

    const original = new File([new Uint8Array(100)], "resident.png", { type: "image/png" });
    const compressed = await compressImageForUpload(original, { maxWidth: 1000 });

    expect(compressed).not.toBe(original);
    expect(compressed.name).toBe("resident.jpg");
    expect(compressed.type).toBe("image/jpeg");
    expect(canvas.width).toBe(0);
    expect(canvas.height).toBe(0);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1000, 500);
  });

  it("keeps the original when compression is not smaller and does not upscale", async () => {
    const context = {
      fillRect: vi.fn(),
      drawImage: vi.fn(),
      imageSmoothingEnabled: false,
      imageSmoothingQuality: "low",
      fillStyle: "",
    };
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback) =>
        callback(new Blob(["larger-than-source"], { type: "image/jpeg" })),
      ),
    } as unknown as HTMLCanvasElement;
    vi.stubGlobal("document", { createElement: vi.fn(() => canvas) });
    vi.stubGlobal("createImageBitmap", vi.fn(async () => ({
      width: 800,
      height: 400,
      close: vi.fn(),
    })));

    const original = new File(["tiny"], "small.jpg", { type: "image/jpeg" });
    const result = await compressImageForUpload(original);

    expect(result).toBe(original);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 800, 400);
  });
});
