import { Sex } from "@prisma/client";

export function parseSex(value: unknown): Sex | null {
  if (typeof value !== "string") return null;

  switch (value.trim().toLowerCase()) {
    case "male":
    case "m":
      return Sex.MALE;
    case "female":
    case "f":
      return Sex.FEMALE;
    case "not specified":
    case "not_specified":
    case "unspecified":
    case "unknown":
      return Sex.NOT_SPECIFIED;
    default:
      return null;
  }
}

export function formatSexLabel(value: Sex) {
  switch (value) {
    case Sex.MALE:
      return "Male";
    case Sex.FEMALE:
      return "Female";
    case Sex.NOT_SPECIFIED:
      return "Not specified";
  }
}
