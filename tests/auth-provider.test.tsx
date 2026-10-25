// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/app/components/AuthProvider";

function AuthState() {
  const { user, loading } = useAuth();
  return (
    <div data-testid="auth-state">
      {loading ? "loading" : JSON.stringify(user)}
    </div>
  );
}

describe("AuthProvider", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads the signed-in profile from the session endpoint", async () => {
    const profile = { id: "user-1", email: "user@example.com", role: "YOUTH" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ user: profile }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider>
        <AuthState />
      </AuthProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId("auth-state")).toHaveTextContent(
        JSON.stringify(profile),
      );
    });
    expect(fetchMock).toHaveBeenCalledWith("/api/session", {
      cache: "no-store",
    });
  });
});
