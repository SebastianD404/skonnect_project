import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getAppBaseUrl, getEmailAppBaseUrl } from "@/lib/app-url";
import { getSkeapDashboardUrl } from "@/lib/broadcast-email";

describe("getAppBaseUrl", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("APP_URL", "");
    vi.stubEnv("VERCEL_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("uses the configured public URL and removes trailing slashes", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://skonnect.example///");

    expect(getAppBaseUrl()).toBe("https://skonnect.example");
  });

  it("skips a localhost URL in production and ignores deployment-specific Vercel URLs", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("APP_URL", "https://skonnect.example/");
    vi.stubEnv("VERCEL_URL", "protected-deployment.vercel.app");

    expect(getAppBaseUrl()).toBe("https://skonnect.example");
  });

  it("uses the canonical production default when no public URL is configured", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("VERCEL_URL", "protected-deployment.vercel.app");

    expect(getAppBaseUrl()).toBe("https://skonnect-project-three.vercel.app");
    expect(getSkeapDashboardUrl()).toBe(
      "https://skonnect-project-three.vercel.app/grantee-dashboard",
    );
  });

  it("keeps the local app URL for non-email development redirects", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(getAppBaseUrl()).toBe("http://localhost:3000");
  });

  it("uses the canonical public URL for email links when no public URL is configured", () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(getEmailAppBaseUrl()).toBe("https://skonnect-project-three.vercel.app");
    expect(getSkeapDashboardUrl()).toBe(
      "https://skonnect-project-three.vercel.app/grantee-dashboard",
    );
  });

  it("never uses a configured localhost URL as an email link origin", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://localhost:3000");
    vi.stubEnv("APP_URL", "https://skonnect.example/");

    expect(getEmailAppBaseUrl()).toBe("https://skonnect.example");
  });
});
