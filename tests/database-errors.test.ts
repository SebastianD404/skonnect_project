import { describe, expect, it } from "vitest";
import { isDatabaseConnectionError } from "../lib/database-errors";

describe("isDatabaseConnectionError", () => {
  it("recognizes Prisma adapter connection timeouts", () => {
    expect(
      isDatabaseConnectionError({
        code: "P2039",
        message: "Database connection error",
      })
    ).toBe(true);
    expect(
      isDatabaseConnectionError({
        code: "P2039",
        message: "Database error",
        meta: {
          driverAdapterError: {
            cause: {
              code: "08006",
              message: "EAUTHTIMEOUT",
            },
          },
        },
      })
    ).toBe(true);
  });

  it("does not classify unrelated application errors as database outages", () => {
    expect(isDatabaseConnectionError(new Error("Invalid request"))).toBe(false);
  });
});
