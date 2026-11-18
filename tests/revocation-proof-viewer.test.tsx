// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import RevocationProofViewer from "@/app/admin/skeap/revoked/RevocationProofViewer";

const proofPayload = {
  signedUrl: "https://storage.example/signed-proof",
  fileName: "incident.pdf",
  proofType: "Police Report / Blotter",
  proofHash: "a".repeat(64),
  mimeType: "application/pdf",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("RevocationProofViewer", () => {
  it("renders a PDF from the signed URL and shows its integrity metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => proofPayload,
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RevocationProofViewer granteeId="grantee-1" onClose={vi.fn()} />);

    const frame = await screen.findByTitle("incident.pdf");
    expect(frame).toHaveAttribute("src", proofPayload.signedUrl);
    expect(screen.getByText("Police Report / Blotter")).toBeInTheDocument();
    expect(screen.getByText(/SHA-256 · a{12}…a{8}/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in New Tab/ })).toHaveAttribute(
      "href",
      proofPayload.signedUrl,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/grantees/grantee-1/revocation-proof",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("shows a readable error and retries the proof request", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, json: async () => null })
      .mockResolvedValueOnce({ ok: true, json: async () => proofPayload });
    vi.stubGlobal("fetch", fetchMock);

    render(<RevocationProofViewer granteeId="grantee-1" onClose={vi.fn()} />);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load the supporting proof document. Check your connection and try again.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(await screen.findByTitle("incident.pdf")).toHaveAttribute(
      "src",
      proofPayload.signedUrl,
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
