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

/**
 * Cap keyword tags at `max` (default 6) while preserving any "gift for ..." tag.
 * If a "gift for" phrase exists anywhere in the input, it's guaranteed to be kept
 * (the first one wins). Order is otherwise preserved.
 */
export function capKeywordsPreservingGiftFor(values: string[], max = 6): string[] {
  const deduped = Array.from(new Set(values.map((v) => v.toLowerCase().trim()).filter(Boolean)));
  if (deduped.length <= max) return deduped;

  const giftIdx = deduped.findIndex((k) => k.includes("gift for"));
  if (giftIdx === -1 || giftIdx < max) return deduped.slice(0, max);

  // "gift for" tag exists but would be cut off — swap it into the last slot.
  const kept = deduped.slice(0, max - 1);
  kept.push(deduped[giftIdx]);
  return kept;
}