export const BARANGAY_PICO = "Pico";

const DEFAULT_PUROKS = [
  "Purok 1",
  "Purok 2",
  "Purok 3",
  "Purok 4",
  "Purok 5",
  "Purok 6",
  "Purok 7",
  "Purok 8",
  "Purok 9",
  "Purok 10",
] as const;

const DEFAULT_SITIOS = [
  "Balangabang",
  "Bayabas",
  "Cogcoga",
  "Dreamland - Piripin Bato",
  "Km 4",
  "Km 5",
  "Shamolog",
  "Toyong",
] as const;

function loadPuroksFromEnv() {
  const raw = process.env.OFFICIAL_PUROKS_CSV;
  if (!raw) return null;

  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : null;
}

export const OFFICIAL_PUROKS = (loadPuroksFromEnv() ?? [...DEFAULT_PUROKS]) as readonly string[];

function loadSitiosFromEnv() {
  const raw = process.env.OFFICIAL_SITIOS_CSV;
  if (!raw) return null;

  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : null;
}

export const OFFICIAL_SITIOS = (loadSitiosFromEnv() ?? [...DEFAULT_SITIOS]) as readonly string[];

export function normalizePurok(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isOfficialPurok(value: string) {
  const normalized = normalizePurok(value).toLowerCase();
  return OFFICIAL_PUROKS.some((purok) => purok.toLowerCase() === normalized);
}

export function normalizeSitio(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

export function isOfficialSitio(value: string) {
  const normalized = normalizeSitio(value).toLowerCase();
  return OFFICIAL_SITIOS.some((sitio) => sitio.toLowerCase() === normalized);
}

export function splitFullName(fullName: string) {
  const normalized = fullName.trim().replace(/\s+/g, " ");
  const parts = normalized.split(" ").filter(Boolean);
  const firstName = parts[0] ?? "";
  const lastName = parts.length > 1 ? parts[parts.length - 1] : firstName;
  const middle = parts.slice(1, -1).join(" ");

  return {
    firstName,
    middleName: middle || null,
    lastName,
    fullName: normalized,
  };
}

export function buildTemporaryPassword(lastName: string, birthDate: Date) {
  const birthYear = birthDate.getFullYear();
  const cleanedLastName = lastName.replace(/[^a-zA-Z]/g, "") || "User";
  return `Pico-${cleanedLastName}-${birthYear}`;
}
