export type SitioSexGroup = {
  purok: string;
  sex: string;
  count: number;
};

export type DemographicDistributionRow = {
  sitio: string;
  male: number;
  female: number;
  total: number;
};

export function buildDemographicDistributionRows(
  groups: SitioSexGroup[],
  officialSitios: readonly string[],
): DemographicDistributionRow[] {
  const rowsBySitio = new Map<string, DemographicDistributionRow>();
  const officialNames = new Map(officialSitios.map((sitio) => [sitio.toLowerCase(), sitio]));

  for (const sitio of officialSitios) {
    rowsBySitio.set(sitio.toLowerCase(), { sitio, male: 0, female: 0, total: 0 });
  }

  for (const group of groups) {
    const rawSitio = group.purok.trim() || "Unspecified sitio";
    const canonicalName = officialNames.get(rawSitio.toLowerCase()) ?? rawSitio;
    const key = canonicalName.toLowerCase();
    const row = rowsBySitio.get(key) ?? {
      sitio: canonicalName,
      male: 0,
      female: 0,
      total: 0,
    };
    const count = group.count;

    if (group.sex === "MALE") row.male += count;
    if (group.sex === "FEMALE") row.female += count;
    row.total += count;
    rowsBySitio.set(key, row);
  }

  const officialKeys = new Set(officialSitios.map((sitio) => sitio.toLowerCase()));
  const unlistedRows = [...rowsBySitio.entries()]
    .filter(([key]) => !officialKeys.has(key))
    .map(([, row]) => row)
    .sort((a, b) => a.sitio.localeCompare(b.sitio));

  return [
    ...officialSitios.map((sitio) => rowsBySitio.get(sitio.toLowerCase())!),
    ...unlistedRows,
  ];
}
