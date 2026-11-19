// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DocumentUploadCard } from "@/app/components/DocumentOCRValidationExample";
import { scanDocument } from "@/lib/ocrValidation";

vi.mock("@/lib/ocrValidation", () => ({
  scanDocument: vi.fn(),
}));

describe("document upload feedback", () => {
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

  it("keeps a successful ID OCR scan in the For Verification state", async () => {
    vi.mocked(scanDocument).mockResolvedValue({
      success: true,
      status: "success",
      badgeText: "Verified",
      message: "ID text verified.",
      isValid: true,
      matchedKeywords: ["Identification"],
      text: "REPUBLIC OF THE PHILIPPINES IDENTIFICATION CARD MARIA SANTOS",
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:valid-id"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    const file = new File(["id"], "id-front.png", { type: "image/png" });
    const onOcrStateChange = vi.fn();
    const { container } = render(
      <DocumentUploadCard
        title="Front"
        acceptedFormats="JPG, PNG, WebP"
        accept="image/jpeg,image/png,image/webp"
        maxSize={10 * 1024 * 1024}
        ocrStrategy="validIdFront"
        compact
        onUpload={vi.fn()}
        onOcrStateChange={onOcrStateChange}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("ID upload input not found");

    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(scanDocument).toHaveBeenCalledWith(file, "validIdFront", expect.any(Object));
      expect(screen.getByText("For Verification")).toBeTruthy();
      expect(onOcrStateChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: "success", badgeText: "For Verification" }),
      );
    });
    expect(screen.queryByText("Verified")).toBeNull();
    expect(container.firstElementChild?.className).toContain("border border-slate-200");
    expect(container.firstElementChild?.className).not.toContain("border-dashed");
  });

  it("shows a clear re-upload warning when ID OCR cannot read the image", async () => {
    vi.mocked(scanDocument).mockResolvedValue({
      success: false,
      status: "needs_review",
      badgeText: "For Verification",
      message: "This image will be checked by an SK Admin because its text could not be verified automatically.",
      isValid: false,
      matchedKeywords: [],
      text: "",
      errorCode: "LOW_CONFIDENCE",
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:unreadable-id"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });

    const { container } = render(
      <DocumentUploadCard
        title="Front"
        acceptedFormats="JPG, PNG, WebP"
        accept="image/jpeg,image/png,image/webp"
        maxSize={10 * 1024 * 1024}
        ocrStrategy="validIdFront"
        compact
        onUpload={vi.fn()}
      />,
    );
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("ID upload input not found");

    fireEvent.change(input, {
      target: { files: [new File(["id"], "unreadable.png", { type: "image/png" })] },
    });

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "We couldn't clearly read this ID. Please re-upload a clear, well-lit image.",
    );
    expect(screen.getByText("For Verification")).toBeTruthy();
  });
});
