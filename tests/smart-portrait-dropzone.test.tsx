// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SmartPortraitDropzone from "@/components/SmartPortraitDropzone";

describe("SmartPortraitDropzone", () => {
  it("shows a graceful placeholder when the uploaded photo preview cannot load", () => {
    render(
      <SmartPortraitDropzone
        uploadedUrl="https://example.com/photo.jpg"
        uploadedName="photo.jpg"
        onFileSelected={vi.fn()}
      />,
    );

    expect(screen.getByRole("link", { name: "View portrait photo" })).toHaveAttribute(
      "href",
      "https://example.com/photo.jpg",
    );

    fireEvent.error(screen.getByRole("img", { name: "Portrait preview" }));

    expect(screen.getByRole("img", { name: "Portrait preview unavailable" })).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: "Portrait preview" })).not.toBeInTheDocument();
  });

  it("falls back to the uploaded image URL when the local preview fails", async () => {
    const createObjectUrl = vi.fn(() => "blob:local-preview");
    const revokeObjectUrl = vi.fn();
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: createObjectUrl });
    Object.defineProperty(URL, "revokeObjectURL", { configurable: true, value: revokeObjectUrl });

    render(
      <SmartPortraitDropzone
        uploadedUrl="https://example.com/photo.jpg"
        uploadedName="photo.jpg"
        onFileSelected={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    const input = document.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("Photo upload input not found");
    fireEvent.change(input, {
      target: { files: [new File(["photo"], "photo.jpg", { type: "image/jpeg" })] },
    });

    const image = await screen.findByRole("img", { name: "Portrait preview" });
    expect(image).toHaveAttribute("src", "blob:local-preview");

    fireEvent.error(image);

    expect(screen.getByRole("img", { name: "Portrait preview" })).toHaveAttribute(
      "src",
      "https://example.com/photo.jpg",
    );

    vi.restoreAllMocks();
  });
});
