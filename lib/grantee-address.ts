export type PermanentAddressParts = {
  sitio?: string | null;
  barangay?: string | null;
  municipality?: string | null;
  province?: string | null;
};

type SkeapPermanentAddressParts = PermanentAddressParts & {
  addressLine?: string | null;
};

function splitAddressParts(value: string | null | undefined) {
  return (value ?? "")
    .split(",")
    .map((part) => part.trim().replace(/^[\s,;]+|[\s,;]+$/g, "").replace(/\s+/g, " "))
    .filter(Boolean);
}

function isBarangay(value: string) {
  return /^(?:barangay\s+)?pico$/i.test(value);
}

function isMunicipality(value: string) {
  return /^la trinidad$/i.test(value);
}

function isProvince(value: string) {
  return /^benguet$/i.test(value);
}

export function formatSkeapPermanentAddress(
  address: SkeapPermanentAddressParts,
  fallbackAddress?: string | null
) {
  const sources = [
    ...splitAddressParts(address.sitio),
    ...splitAddressParts(address.barangay),
    ...splitAddressParts(address.municipality),
    ...splitAddressParts(address.province),
    ...splitAddressParts(address.addressLine),
    ...splitAddressParts(fallbackAddress),
  ];
  const uniqueParts = sources.filter(
    (part, index) => sources.findIndex((candidate) => candidate.toLocaleLowerCase() === part.toLocaleLowerCase()) === index
  );
  const barangay = splitAddressParts(address.barangay).find(isBarangay)
    ?? uniqueParts.find(isBarangay);
  const municipality = splitAddressParts(address.municipality).find(isMunicipality)
    ?? uniqueParts.find(isMunicipality);
  const province = splitAddressParts(address.province).find(isProvince)
    ?? uniqueParts.find(isProvince);
  const excluded = new Set([barangay, municipality, province].filter(Boolean).map((part) => part!.toLocaleLowerCase()));
  const otherParts = uniqueParts.filter((part) => !excluded.has(part.toLocaleLowerCase()));

  return [
    ...otherParts,
    barangay,
    municipality,
    province,
  ].filter((part): part is string => Boolean(part)).join(", ") || "Not specified";
}

export function formatPermanentAddress(address: PermanentAddressParts) {
  return formatSkeapPermanentAddress(address);
}
