import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchKKProfile } from "@/lib/kk-profile-client";

describe("fetchKKProfile", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the expected profiling gate for users without an approved profile", async () => {
    const responseBody = {
      profile: null,
      hasVerifiedKkProfile: false,
      requiresKkProfiling: true,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify(responseBody), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(fetchKKProfile()).resolves.toEqual(responseBody);
  });

  it("continues to reject unexpected server errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "Database unavailable" }), {
          status: 500,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    await expect(fetchKKProfile()).rejects.toThrow("Database unavailable");
  });
});
