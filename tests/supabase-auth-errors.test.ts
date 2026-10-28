import { describe, expect, it } from "vitest";
import { isRefreshTokenMissingError } from "@/lib/supabase/auth-errors";

describe("isRefreshTokenMissingError", () => {
  it("recognizes Supabase's invalid refresh-token response", () => {
    expect(
      isRefreshTokenMissingError({
        message: "Invalid Refresh Token: Refresh Token Not Found",
        status: 400,
        code: "refresh_token_not_found",
      }),
    ).toBe(true);
  });

  it("recognizes the error by message when no code is provided", () => {
    expect(
      isRefreshTokenMissingError({
        message: "Invalid Refresh Token: Refresh Token Not Found",
      }),
    ).toBe(true);
  });

  it("does not suppress unrelated authentication errors", () => {
    expect(
      isRefreshTokenMissingError({
        message: "User not found",
        code: "user_not_found",
      }),
    ).toBe(false);
  });
});
