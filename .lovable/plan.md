## Issue

The Admin → Products list crashes with `RangeError: Invalid time value` because `format(new Date(p.date_added), …)` and `format(new Date(p.updated_at), …)` are called unconditionally inside the row map. If any product row has a null/invalid `date_added` or `updated_at`, `date-fns` throws and React unmounts the whole admin tree, so the page goes blank.

(The CSP `connect-src` warnings from `googleadservices.com` / `google.com/ccm` are unrelated noise — Google Ads tag trying to ping conversion endpoints not whitelisted in `public/_headers`. They do not blank the page.)

## Fix

In `src/components/admin/ProductList.tsx` around lines 665 and 668, wrap each date format in a safe helper that returns `"—"` when the value is missing or `new Date(value)` produces `NaN`:

```ts
const safeFormat = (value: string | null | undefined, fmt: string) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d.getTime()) ? "—" : format(d, fmt);
};
```

Then:
- `Added {safeFormat(p.date_added, "MM/dd/yyyy")}`
- `Updated {safeFormat(p.updated_at, "MM/dd/yyyy h:mm a")}`

Single-file, presentation-only change. Restores the admin dashboard immediately.

## Optional follow-up (not in this plan)

If the user wants the Google Ads conversion pings to actually fire, add `https://www.google.com https://www.googleadservices.com https://www.googletagmanager.com` to `connect-src` in `public/_headers`. Skipping for now since it's unrelated to the blank screen.