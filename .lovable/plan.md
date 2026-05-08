## Issue

The Admin Products list crashes (admin tree unmounts → page goes blank) as soon as the user types in the search box. The previous `safeFormat` fix handled invalid dates in the row render, but the search filter itself is unguarded and throws on the first product whose `name` or `category` is null/undefined.

In `src/components/admin/ProductList.tsx` (lines 286–294):

```ts
const matchName = p.name.toLowerCase().includes(q);
const matchCompany = (p.company_name || "").toLowerCase().includes(q);
const matchCategory = p.category.toLowerCase().includes(q);
const matchVibe = (p.vibe_category || "").toLowerCase().includes(q);
```

`p.name` and `p.category` are dereferenced directly. When the live catalog contains any row where these are `null` (legacy/imported rows), `.toLowerCase()` throws `TypeError: Cannot read properties of null`, React unmounts the admin route, and the page disappears the instant the search query causes that row to be evaluated.

## Fix

Single-file, presentation-only change in `src/components/admin/ProductList.tsx`. Wrap every searched field with the same `(value || "")` guard already used for `company_name` and `vibe_category`:

```ts
if (searchQuery) {
  const q = searchQuery.toLowerCase();
  const matchName = (p.name || "").toLowerCase().includes(q);
  const matchCompany = (p.company_name || "").toLowerCase().includes(q);
  const matchCategory = (p.category || "").toLowerCase().includes(q);
  const matchVibe = (p.vibe_category || "").toLowerCase().includes(q);
  if (!matchName && !matchCompany && !matchCategory && !matchVibe) return false;
}
```

No other behaviour changes. Sort/render paths are already guarded (`safeFormat`, `countsMap[id] || 0`).

## Out of scope

- Pre-existing dual-Supabase TypeScript build errors (unrelated to this crash).
- The CSP `connect-src` warnings from Google Ads tag.
