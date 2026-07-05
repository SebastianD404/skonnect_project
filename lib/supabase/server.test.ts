import { describe, expect, it } from "vitest";
import { isRefreshTokenMissingError } from "./server";

describe("isRefreshTokenMissingError", () => {
  it("detects Supabase refresh-token-not-found errors", () => {
    const error = {
      message: "Invalid Refresh Token: Refresh Token Not Found",
      status: 400,
      code: "refresh_token_not_found",
    };

    expect(isRefreshTokenMissingError(error)).toBe(true);
  });

  it("ignores unrelated auth errors", () => {
    const error = {
      message: "User not found",
      status: 404,
      code: "user_not_found",
    };

    expect(isRefreshTokenMissingError(error)).toBe(false);
  });
});
