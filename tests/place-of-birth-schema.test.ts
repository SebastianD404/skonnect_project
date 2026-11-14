import { describe, expect, it } from "vitest";
import { placeOfBirthSchema } from "@/lib/place-of-birth-schema";

describe("placeOfBirthSchema", () => {
  it.each(["Baguio City", "La Trinidad, Benguet"])("accepts %s", (value) => {
    expect(placeOfBirthSchema.parse(value)).toBe(value);
  });

  it.each(["LTB", "BC", "ABCD"])("rejects abbreviated values such as %s", (value) => {
    expect(placeOfBirthSchema.safeParse(value).success).toBe(false);
  });

  it("trims surrounding whitespace", () => {
    expect(placeOfBirthSchema.parse("  Baguio City  ")).toBe("Baguio City");
  });
});
