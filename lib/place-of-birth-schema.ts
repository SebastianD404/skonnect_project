import { z } from "zod";

export const placeOfBirthSchema = z
  .string()
  .trim()
  .min(4, "Enter your full city/municipality (do not abbreviate)")
  .refine((value) => !/^[A-Z]{2,5}$/.test(value), {
    message: "Do not use abbreviations (e.g., write 'La Trinidad, Benguet')",
  });
