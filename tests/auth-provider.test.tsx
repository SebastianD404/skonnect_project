// @vitest-environment jsdom

import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "@/app/components/AuthProvider";

const mockedRouter = vi.hoisted(() => ({
  refresh: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => mockedRouter,
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
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.clearAllMocks();
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

  it("redirects a signed-in youth to the grantee dashboard when their role is promoted", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        user: { id: "user-3", email: "applicant@example.com", role: "GRANTEE" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(
      <AuthProvider
        initialUser={{
          id: "user-3",
          email: "applicant@example.com",
          role: "YOUTH",
        }}
      >
        <AuthState />
      </AuthProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });

    expect(screen.getByTestId("auth-state")).toHaveTextContent('"role":"GRANTEE"');
    expect(mockedRouter.replace).toHaveBeenCalledWith("/grantee-dashboard");
  });
});
