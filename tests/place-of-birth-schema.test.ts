import { describe, expect, it } from "vitest";
import {
  getPlaceOfBirthSuggestion,
  PLACE_OF_BIRTH_ERROR_MESSAGE,
  placeOfBirthSchema,
  validatePlaceOfBirth,
} from "@/lib/place-of-birth-schema";

describe("placeOfBirthSchema", () => {
  it.each(["Baguio City", "La Trinidad, Benguet", "Itogon", "Tublay"])("accepts %s", (value) => {
    expect(placeOfBirthSchema.parse(value)).toBe(value);
  });

  it.each(["L.T.B", "L.T.B.", "LTB", "B.C.", "BGH", "bgh", "BC", "TRP", "BAGUIO"])(
    "rejects abbreviated values such as %s",
    (value) => {
      expect(placeOfBirthSchema.safeParse(value).success).toBe(false);
      expect(validatePlaceOfBirth(value)).toBe(PLACE_OF_BIRTH_ERROR_MESSAGE);
    },
  );

  it.each([
    ["B.C.", "Baguio City"],
    ["BGH", "Baguio City"],
  ])("suggests %s as %s", (value, suggestion) => {
    expect(getPlaceOfBirthSuggestion(value)).toBe(suggestion);
  });

  it.each(["L.T.B", "L.T.B.", "LTB", "LT"])("does not suggest a replacement for %s", (value) => {
    expect(getPlaceOfBirthSuggestion(value)).toBeNull();
  });

  it("accepts full place names with repeated whitespace", () => {
    expect(validatePlaceOfBirth("  La   Trinidad, Benguet  ")).toBeNull();
  });

  it("returns the requested message for invalid values", () => {
    expect(validatePlaceOfBirth("L.T.B")).toBe(
      "Enter your full birth city/municipality without abbreviations (e.g., La Trinidad, Benguet).",
    );
  });

  it("trims surrounding whitespace", () => {
    expect(placeOfBirthSchema.parse("  Baguio City  ")).toBe("Baguio City");
  });
});
