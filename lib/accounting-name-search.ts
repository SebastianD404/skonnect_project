export function matchesAccountingNameQuery(query: string, names: readonly string[]) {
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;

  const searchableNames = names.join(" ").toLowerCase();
  return terms.every((term) => searchableNames.includes(term));
}
