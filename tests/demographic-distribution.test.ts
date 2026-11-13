import { describe, expect, it } from "vitest";
import { buildDemographicDistributionRows } from "../lib/demographic-distribution";
import { Sex } from "@prisma/client";
import { parseSex } from "../lib/sex";

describe("buildDemographicDistributionRows", () => {
  it("includes every verified profile in totals, including unspecified sex and unlisted sitios", () => {
    const rows = buildDemographicDistributionRows(
      [
        { purok: "Balangabang", sex: "MALE", count: 125 },
        { purok: "balangabang", sex: "FEMALE", count: 127 },
        { purok: "Balangabang", sex: "NOT_SPECIFIED", count: 3 },
        { purok: "New sitio", sex: "FEMALE", count: 2 },
      ],
      ["Balangabang", "Bayabas"],
    );

    expect(rows).toEqual([
      { sitio: "Balangabang", male: 125, female: 127, total: 255 },
      { sitio: "Bayabas", male: 0, female: 0, total: 0 },
      { sitio: "New sitio", male: 0, female: 2, total: 2 },
    ]);
  });

  it("normalizes supported sex labels and rejects unknown values", () => {
    expect(parseSex("Male")).toBe(Sex.MALE);
    expect(parseSex("F")).toBe(Sex.FEMALE);
    expect(parseSex("Not specified")).toBe(Sex.NOT_SPECIFIED);
    expect(parseSex("another value")).toBeNull();
  });
});
