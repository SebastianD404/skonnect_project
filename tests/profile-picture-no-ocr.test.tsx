// @vitest-environment jsdom

import { fireEvent, render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentUploadCard } from "@/app/components/DocumentOCRValidationExample";
import { scanDocument } from "@/lib/ocrValidation";

vi.mock("@/lib/ocrValidation", () => ({
  scanDocument: vi.fn(),
}));

describe("KK profile picture uploads", () => {
  it("validates the image file without running OCR", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:profile-picture"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    const onUpload = vi.fn();
    const onOcrStateChange = vi.fn();
    const photo = new File(["portrait image"], "profile-picture.png", {
      type: "image/png",
    });
    const { container } = render(
      <DocumentUploadCard
        title="Profile Picture (2x2)"
        acceptedFormats="JPG, PNG, WebP"
        accept="image/jpeg,image/png,image/webp"
        maxSize={10 * 1024 * 1024}
        ocrStrategy="none"
        onUpload={onUpload}
        onOcrStateChange={onOcrStateChange}
      />,
    );

    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Profile picture upload input not found");
    fireEvent.change(input, { target: { files: [photo] } });

    await waitFor(() => {
      expect(onOcrStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: "success", badgeText: "File validated", file: photo }),
      );
    });
    expect(onUpload).toHaveBeenCalledWith(photo);
    expect(scanDocument).not.toHaveBeenCalled();
  });
});
