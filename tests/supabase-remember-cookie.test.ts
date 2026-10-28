import { describe, expect, it } from "vitest";
import { getSessionCookieOptions } from "@/lib/supabase/remember-cookie";

describe("getSessionCookieOptions", () => {
  it("preserves persistent cookie lifetime when remember me is enabled", () => {
    const options = { path: "/", maxAge: 400 * 24 * 60 * 60 };

    expect(getSessionCookieOptions(options, true)).toEqual(options);
  });

  it("uses a browser-session cookie when remember me is disabled", () => {
    expect(
      getSessionCookieOptions({ path: "/", maxAge: 400 * 24 * 60 * 60 }, false),
    ).toEqual({ path: "/" });
  });

  it("preserves cookie deletion options regardless of remember me", () => {
    expect(getSessionCookieOptions({ path: "/", maxAge: 0 }, false)).toEqual({
      path: "/",
      maxAge: 0,
    });
  });
});
