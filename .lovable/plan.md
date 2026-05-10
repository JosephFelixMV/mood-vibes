## Goal

Add **Google Tag Manager (GTM)** as the central tag container so future marketing tags can be deployed without code changes, then use it to:

1. Fire structured events for affiliate-link clicks (and product views) so they can be forwarded to GA4, Pinterest, Google Ads, etc.
2. Deploy the **Pinterest Tag** (base tag + conversion events) for advertising.
3. Keep everything **gated behind Enzuzo consent** like the existing GA4 / Hotjar / Google Ads loaders.

The implementation will be done in Claude Code on the `Lovable-Dev` branch. This document is the spec.

---

## Current state (relevant references)

- `index.html` — Enzuzo `auto-blocking` script is the first tag in `<head>`. No GTM, no Pinterest tag today.
- `src/components/AnalyticsLoader.tsx` — loads GA4, Hotjar, and Google Ads. Reads IDs from `site_config` table, gates injection on `hasAnalyticsConsent()` (checks `window.__enzuzo` API + `cookies-analytics=true` cookie + listens for `enzuzo:consent` events + 500 ms poll fallback).
- `src/components/admin/SiteConfiguration.tsx` — admin UI with "Analytics & Tracking" section storing `google_analytics_id`, `hotjar_id` in `site_config`. New IDs need to be added here.
- `src/lib/track-event.ts` — writes `view` / `click` rows to Supabase `product_events`. Bot-filtered, session-deduped for views. Used by `ProductCard`, `DiscoveryTile`, `ProductDrawer`, `ProductDetail`, etc.
- `src/lib/track-click.ts` — separate insert into `product_clicks`. Called from affiliate-link click handlers (e.g. `ExternalCTA`).
- `src/components/ExternalCTA.tsx` — the actual "Buy Now" button that opens the affiliate URL. This is where the click event for marketing tags should fire.

---

## Plan

### 1. Add GTM configuration to admin

In `site_config` add two new keys (no migration needed — admin upserts by key):

| Key | Purpose |
|---|---|
| `gtm_container_id` | e.g. `GTM-XXXXXXX` |
| `pinterest_tag_id` | e.g. `2613xxxxxxxxx` (numeric Pinterest Tag ID) |

In `src/components/admin/SiteConfiguration.tsx`, extend the `Analytics & Tracking` section:
- Add both keys to `keys` and `helpTexts`.
- Help text for GTM: "Find in Google Tag Manager → workspace → top-right container ID."
- Help text for Pinterest: "Find in Pinterest Ads → Conversions → Tag Manager."

### 2. Inject GTM through the existing consent gate

Add `injectGTM(containerId)` and `injectPinterest(tagId)` to `AnalyticsLoader.tsx` and call them from `injectAll()`.

GTM snippet (gated):
```ts
function injectGTM(id: string) {
  if (!id || !/^GTM-[A-Z0-9]+$/i.test(id)) return;
  if (document.getElementById("gtm-loader")) return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const s = document.createElement("script");
  s.id = "gtm-loader";
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`;
  document.head.appendChild(s);
}
```

Pinterest base tag (gated; advertising consent — see §6):
```ts
function injectPinterest(tagId: string) {
  if (!tagId || !/^\d+$/.test(tagId)) return;
  if ((window as any).pintrk) return;
  // Standard Pinterest base tag
  !function(e){...}(window);
  window.pintrk("load", tagId);
  window.pintrk("page");
}
```

GTM `<noscript>` iframe fallback should be added to `<body>` of `index.html` (per project rule that noscript pixels go in body, not head). It is unconditional — no PII — but if you want strict consent purity, conditionally inject from JS instead and skip the noscript.

### 3. Affiliate-link event tagging via dataLayer

Create `src/lib/track-marketing.ts` with thin helpers that push to `dataLayer` and `pintrk`. Safe to call before consent — if `dataLayer` / `pintrk` aren't loaded, calls are no-ops.

```ts
export function trackAffiliateClick(args: {
  productId: string;
  productName: string;
  vendor?: string;
  category?: string;
  price?: number;
  affiliateUrl: string;
}) {
  (window as any).dataLayer?.push({
    event: "affiliate_click",
    ecommerce: {
      currency: "USD",
      value: args.price ?? 0,
      items: [{
        item_id: args.productId,
        item_name: args.productName,
        item_brand: args.vendor,
        item_category: args.category,
        price: args.price,
        affiliation: args.vendor,
      }],
    },
    affiliate_url_domain: new URL(args.affiliateUrl).hostname,
  });
  (window as any).pintrk?.("track", "lead", {
    lead_type: "affiliate_click",
    line_items: [{ product_id: args.productId, product_name: args.productName, product_category: args.category, product_price: args.price }],
  });
}

export function trackProductView(...) { /* event: "view_item" */ }
export function trackPageView(path: string) { /* event: "page_view" — fire on route change */ }
```

Wire-up:
- `src/lib/track-click.ts` — keep the Supabase insert, also call `trackAffiliateClick`. Pass product context from the existing call sites (`ProductCard`, `ExternalCTA` consumers, `ProductDrawer`, `ProductDetail`). Update the `trackProductClick` signature to accept the richer payload (or add a new `trackAffiliateClickFull` and migrate callers one at a time).
- `src/lib/track-event.ts` — when `eventType === "view"`, also call `trackProductView` so view_item fires for GA4/Pinterest.
- Add a tiny `useRouteAnalytics()` hook (or call inside the existing `useSEO` hook) to push `page_view` / `pintrk("page")` on every React Router location change. This is needed because GTM's automatic page-view tag only fires once on initial load in SPAs.

### 4. GTM container configuration (no code — done in tagmanager.google.com)

This is the work after the code lands. Document it for the Claude Code follow-up:

| Trigger | Tag(s) to fire |
|---|---|
| Custom Event = `affiliate_click` | GA4 Event (`select_item` or custom `affiliate_click`) → forward `ecommerce` object. Pinterest "Lead" or custom conversion. Google Ads conversion (move the existing `gtag('event','conversion', …)` from `injectGoogleAds` here so all conversions live in GTM). |
| Custom Event = `view_item` | GA4 Event `view_item`. Pinterest `pagevisit` with line_items. |
| History Change / `page_view` event | GA4 `page_view`, Pinterest `pintrk("page")`. |

After GTM is configured, **remove the Google Ads injection block from `AnalyticsLoader.tsx`** to avoid double-counting (GTM will own it). Leave GA4/Hotjar direct injection as-is, OR move them into GTM as well — recommended path: keep Hotjar direct (it ships its own consent integrations) and migrate GA4 into GTM.

### 5. Enzuzo consent gating

Two consent categories matter:
- **Analytics** — GA4, Hotjar, GTM container itself (because the container can fire arbitrary tags). Existing `hasAnalyticsConsent()` already covers this.
- **Marketing/Advertising** — Pinterest, Google Ads conversion. Enzuzo exposes this as a separate category (`cookies-marketing` / `marketing` / `advertising` depending on the bar config).

Action items:
1. Confirm category names in Enzuzo dashboard for this site (open https://app.enzuzo.com → Cookie Bar → Categories). Likely `analytics` and `marketing`.
2. Add `hasMarketingConsent()` mirroring `hasAnalyticsConsent()` (check `window.__enzuzo.getConsent()?.marketing` + `cookies-marketing=true` cookie).
3. Split `injectAll()` into `injectAnalytics()` + `injectMarketing()` and run each only when its category is granted. Re-run when consent changes (Enzuzo fires `enzuzo-consent-changed` on update).
4. Inside GTM, also configure **Consent Mode v2** (Google) so any Google tags fired by GTM respect `ad_storage` / `analytics_storage` defaults. Add a small consent-default snippet **before** the GTM loader that sets all storage to `denied`, then update to `granted` when Enzuzo signals consent. This is the safest pattern for GDPR/PIPEDA/CCPA regions you already handle.

Snippet outline (insert in `injectGTM` before the gtm.js script):
```ts
window.dataLayer.push(["consent", "default", {
  ad_storage: "denied", analytics_storage: "denied",
  ad_user_data: "denied", ad_personalization: "denied",
  wait_for_update: 500,
}]);
// later, when Enzuzo grants:
window.dataLayer.push(["consent", "update", { analytics_storage: "granted", ad_storage: hasMarketing ? "granted" : "denied", ... }]);
```

### 6. CSP / network considerations

`public/_headers` likely has a `Content-Security-Policy`. Add to `script-src`, `connect-src`, `img-src`, `frame-src` as appropriate:
- `https://www.googletagmanager.com`
- `https://*.google-analytics.com`, `https://*.analytics.google.com`
- `https://ct.pinterest.com`, `https://s.pinimg.com`
- (already present) `https://www.googleadservices.com`, `https://googleads.g.doubleclick.net`

Verify with `code--view public/_headers` before editing.

### 7. Testing checklist (for Claude Code)

1. Local dev with Enzuzo "reject all" → no `gtm.js`, `ct.pinterest.com`, GA4 requests in network tab.
2. Accept analytics only → GTM + GA4 load, Pinterest does NOT.
3. Accept all → Pinterest base tag fires `pagevisit`; clicking Buy Now fires `lead`.
4. GTM Preview mode (Tag Assistant) shows `affiliate_click`, `view_item`, `page_view` events with the `ecommerce` payload populated.
5. Pinterest Tag Helper extension confirms base + conversion events.
6. SPA navigation: confirm `page_view` fires on each route change, not only initial load.
7. Bot UA filter (`isLikelyBot`) still suppresses Supabase analytics — apply same filter at the top of `track-marketing.ts` so dataLayer isn't polluted by crawlers.

### 8. Out of scope

- The existing dual-Supabase split (`fqcc...` live vs `ztzt...` Lovable Cloud) — `site_config` lives on the live DB; admins already manage it there.
- Migrating Hotjar into GTM — keep direct injection unless you explicitly want it consolidated.
- Server-side GTM / first-party tagging.
- Pinterest enhanced match (hashed email) — only relevant if you start collecting emails for marketing; revisit later.

---

## Files Claude Code will touch

- `index.html` — optional GTM `<noscript>` in `<body>`; add Consent Mode default snippet **only if** you choose static injection over the JS path in `AnalyticsLoader`.
- `src/components/AnalyticsLoader.tsx` — new injectors, split analytics/marketing gates, Consent Mode update on grant.
- `src/components/admin/SiteConfiguration.tsx` — add `gtm_container_id`, `pinterest_tag_id` keys + help text.
- `src/lib/track-marketing.ts` — **new** dataLayer + pintrk helpers.
- `src/lib/track-click.ts` — call marketing helper alongside Supabase insert; widen signature.
- `src/lib/track-event.ts` — call `trackProductView` from view branch.
- Call sites passing richer product context to `trackProductClick`: `ProductCard.tsx`, `ProductDrawer.tsx`, `ProductDetail.tsx`, anywhere using `ExternalCTA` for affiliate URLs.
- New hook `src/hooks/useRouteAnalytics.ts` (or add to `useSEO`) for SPA page_view.
- `public/_headers` — extend CSP allowlist.
- `site_config` table — seed two new rows (one-time SQL or via admin UI after deploy).

No DB migrations required.
