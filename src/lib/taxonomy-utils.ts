const normalizeTaxonomyKey = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();

export function dedupeTaxonomyValues(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();

  return values
    .map((value) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : ""))
    .filter((value) => {
      if (!value) return false;
      const key = normalizeTaxonomyKey(value);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function parseTaxonomyString(value?: string | null): string[] {
  return dedupeTaxonomyValues((value || "").split(","));
}

export function stringifyTaxonomyValues(values: Array<string | null | undefined>): string {
  return dedupeTaxonomyValues(values).join(", ");
}