// @vitest-environment jsdom

import type { ComponentProps } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Avatar } from "@/components/ui/Avatar";

vi.mock("next/image", async () => {
  const { createElement } = await import("react");
  return {
    default: (props: ComponentProps<"img"> & { fill?: boolean; unoptimized?: boolean }) => {
      const { fill, unoptimized, ...imageProps } = props;
      void fill;
      void unoptimized;
      return createElement("img", imageProps);
    },
  };
});

describe("Avatar", () => {
  it("keeps the existing image when only its signed URL token changes", () => {
    const firstUrl = "https://storage.example/avatar.png?token=first";
    const { rerender } = render(<Avatar src={firstUrl} alt="Sebastian" />);

    rerender(<Avatar src="https://storage.example/avatar.png?token=second" alt="Sebastian" />);

    expect(screen.getByRole("img")).toHaveAttribute("src", firstUrl);
  });

  it("keeps the current image visible under the upload overlay", () => {
    render(<Avatar src="https://storage.example/avatar.png" alt="Sebastian" isUploading />);

    expect(screen.getByRole("img")).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Uploading profile picture" })).toBeInTheDocument();
  });

  it("shows initials only after the image reports a load error", () => {
    render(<Avatar src="https://storage.example/missing.png" alt="Sebastian" />);

    fireEvent.error(screen.getByRole("img"));

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.getByText("S")).toBeInTheDocument();
  });
});
