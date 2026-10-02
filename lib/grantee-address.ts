export type PermanentAddressParts = {
  sitio?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
};

export function formatPermanentAddress(address: PermanentAddressParts) {
  const addressParts = [
    address.sitio,
    address.barangay,
    address.municipality,
    address.province,
  ]
    .map((part) => part?.trim().replace(/\s+/g, " "))
    .filter((part): part is string => Boolean(part));

  return addressParts.join(", ") || "Not specified";
}
