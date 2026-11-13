// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentUploadCard } from "@/app/components/DocumentOCRValidationExample";
import { scanDocument } from "@/lib/ocrValidation";

vi.mock("@/lib/ocrValidation", () => ({
  scanDocument: vi.fn(),
}));

describe("residency document upload feedback", () => {
  it("shows the specific short-residency message from OCR validation", async () => {
    const message =
      "This certificate shows less than the required 6 months of residency in Barangay Pico. Please upload an updated certificate.";
    vi.mocked(scanDocument).mockResolvedValue({
      success: false,
      status: "error",
      badgeText: "Residency Duration Too Short",
      message,
      isValid: false,
      matchedKeywords: [],
      text: "Certificate of Residency: 5 months",
      errorCode: "RESIDENCY_TOO_SHORT",
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:residency-certificate"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    const onOcrStateChange = vi.fn();
    const { container } = render(
      <DocumentUploadCard
        title="Certificate of Residency"
        acceptedFormats="JPG, PNG, WebP"
        accept="image/jpeg,image/png,image/webp"
        maxSize={10 * 1024 * 1024}
        ocrStrategy="residency"
        onUpload={vi.fn()}
        onOcrStateChange={onOcrStateChange}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Residency certificate upload input not found");

    fireEvent.change(input, {
      target: {
        files: [new File(["certificate"], "residency.png", { type: "image/png" })],
      },
    });

    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toBe(message);
      expect(onOcrStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: "error", errorCode: "RESIDENCY_TOO_SHORT", message }),
      );
    });
  });
});
