import { OFFICIAL_SITIOS } from "@/lib/kk";

export function normalizeAddressText(value?: string | null) {
  return String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
}

export function formatAddressParts(parts: Array<string | undefined | null>) {
  return normalizeAddressText(parts.filter(Boolean).join(", "));
}

function isBarangayPico(value: string) {
  const normalized = value.trim().toLowerCase().replace(/\./g, "").replace(/\s+/g, " ");
  return normalized === "pico" || normalized === "barangay pico" || normalized === "brgy pico";
}

function findOfficialSitioSegment(parts: string[]) {
  return parts.find((part) => OFFICIAL_SITIOS.some((sitio) => part.toLowerCase() === sitio.toLowerCase()));
}

export function formatKkAddress(value?: string | null) {
  const parts = String(value ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return "";
  }

  const sitio = findOfficialSitioSegment(parts);
  const barangayIndex = parts.findIndex((part) => isBarangayPico(part));

  if (!sitio) {
    return normalizeAddressText(parts.join(", "));
  }

  const remaining = parts.filter((part) => part !== sitio && !isBarangayPico(part));
  const barangay = barangayIndex >= 0 ? parts[barangayIndex] : "Pico";

  return normalizeAddressText([sitio, barangay, ...remaining].join(", "));
}