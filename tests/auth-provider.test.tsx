// @vitest-environment jsdom

import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/app/components/AuthProvider";

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ refresh: vi.fn() }),
}));

vi.mock("@/lib/supabase/browser", () => ({
  createBrowserClient: () => ({
    auth: {
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
  }),
}));

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

  it("renders a server-provided profile without waiting for the session endpoint", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const profile = { id: "user-2", email: "server@example.com", role: "YOUTH" as const };

    render(
      <AuthProvider initialUser={profile}>
        <AuthState />
      </AuthProvider>,
    );

    expect(screen.getByTestId("auth-state")).toHaveTextContent(
      JSON.stringify(profile),
    );
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
